//! GlitchButton: a dark mono button whose label tears into RGB-split slices,
//! shakes and flickers in bursts, under a scanline overlay.

use gpui::{
    App, Bounds, ClickEvent, Context, Div, ElementId, FocusHandle, FontWeight, Hsla,
    InteractiveElement, IntoElement, ParentElement, Pixels, RenderOnce, SharedString,
    StatefulInteractiveElement, Styled, Task, Window, canvas, div, point, prelude::FluentBuilder,
    px, quad, transparent_black,
};
use std::{cell::Cell, rc::Rc};

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Duration, Instant, keyframes};
use crate::surface::{
    PressMotion, ms, paint_focus_ring, paint_graded_surface, rgb_a, scale_bounds, scaled_content,
    surface_text,
};

/// When the glitch fires.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum GlitchTrigger {
    /// Timed bursts on a jittered interval (and while hovered).
    Auto,
    /// Only while the pointer is over the button.
    #[default]
    Hover,
    /// Continuously.
    Always,
}

/// A button with randomized RGB-split glitch bursts, a scanline overlay and a
/// flickering label.
///
/// ```ignore
/// GlitchButton::new("deploy", "Deploy doom")
///     .trigger(GlitchTrigger::Auto)
///     .font_family("Geist Mono")
/// ```
#[derive(IntoElement)]
pub struct GlitchButton {
    id: ElementId,
    label: SharedString,
    glitch_interval: Duration,
    glitch_duration: Duration,
    colors: (Hsla, Hsla),
    intensity: f32,
    trigger: GlitchTrigger,
    scanlines: bool,
    radius: f32,
    font_family: Option<SharedString>,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl GlitchButton {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            glitch_interval: ms(3500),
            glitch_duration: ms(450),
            colors: (rgb_a(0xef4444, 1.0), rgb_a(0x22d3ee, 1.0)),
            intensity: 1.0,
            trigger: GlitchTrigger::Hover,
            scanlines: true,
            radius: 10.0,
            font_family: None,
            disabled: false,
            on_click: None,
        }
    }

    /// Base time between automatic bursts (±20% random jitter). Used with
    /// [`GlitchTrigger::Auto`]. Defaults to 3.5s.
    pub fn glitch_interval(mut self, interval: Duration) -> Self {
        self.glitch_interval = interval;
        self
    }

    /// Length of a single burst. Defaults to 450ms.
    pub fn glitch_duration(mut self, duration: Duration) -> Self {
        self.glitch_duration = duration;
        self
    }

    /// The two RGB-split channel colours. Defaults to red-500 / cyan-400.
    pub fn colors(mut self, channel_a: impl Into<Hsla>, channel_b: impl Into<Hsla>) -> Self {
        self.colors = (channel_a.into(), channel_b.into());
        self
    }

    /// Multiplier on the channel and shake displacement. Defaults to 1.
    pub fn intensity(mut self, intensity: f32) -> Self {
        self.intensity = intensity;
        self
    }

    /// When the glitch fires. Defaults to [`GlitchTrigger::Hover`].
    pub fn trigger(mut self, trigger: GlitchTrigger) -> Self {
        self.trigger = trigger;
        self
    }

    /// Toggle the scanline overlay. Defaults to `true`.
    pub fn scanlines(mut self, scanlines: bool) -> Self {
        self.scanlines = scanlines;
        self
    }

    /// Corner radius in pixels. Defaults to 10; use a large value for a pill.
    pub fn radius(mut self, radius: f32) -> Self {
        self.radius = radius;
        self
    }

    /// Font family for the label, e.g. your monospace font. Inherits by default.
    pub fn font_family(mut self, family: impl Into<SharedString>) -> Self {
        self.font_family = Some(family.into());
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    pub fn on_click(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(handler));
        self
    }
}

struct GlitchState {
    motion: PressMotion,
    hovered: bool,
    /// An automatic burst is running.
    bursting: bool,
    /// When the current glitch animation started (CSS animations restart when applied).
    active_since: Option<Instant>,
    trigger: GlitchTrigger,
    interval: Duration,
    duration: Duration,
    /// The auto-burst scheduler, while `trigger` is `Auto`.
    scheduler: Option<Task<()>>,
    rng: u32,
    focus: FocusHandle,
}

impl GlitchState {
    fn hover_driven(&self) -> bool {
        self.trigger != GlitchTrigger::Always
    }

    fn active(&self) -> bool {
        match self.trigger {
            GlitchTrigger::Always => true,
            GlitchTrigger::Hover => self.hovered,
            GlitchTrigger::Auto => self.bursting || self.hovered,
        }
    }

    /// Uniform in `[0, 1)`.
    fn random(&mut self) -> f32 {
        // xorshift32
        let mut x = self.rng;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.rng = x;
        (x >> 8) as f32 / (1u32 << 24) as f32
    }

    fn next_delay(&mut self) -> Duration {
        let base = self.interval.as_secs_f32();
        let jitter = (self.random() - 0.5) * base * 0.4;
        Duration::from_secs_f32((base + jitter).max(0.0))
    }

    fn ensure_scheduler(&mut self, cx: &mut Context<Self>) {
        if self.trigger != GlitchTrigger::Auto {
            self.scheduler = None;
            self.bursting = false;
            return;
        }
        if self.scheduler.is_some() {
            return;
        }
        self.scheduler = Some(cx.spawn(async move |this, cx| {
            loop {
                let Ok(delay) = this.update(cx, |s, _| s.next_delay()) else {
                    return;
                };
                cx.background_executor().timer(delay).await;
                let Ok(Some(duration)) = this.update(cx, |s, cx| {
                    if s.hovered {
                        return None;
                    }
                    s.bursting = true;
                    cx.notify();
                    Some(s.duration)
                }) else {
                    continue;
                };
                cx.background_executor().timer(duration).await;
                if this
                    .update(cx, |s, cx| {
                        s.bursting = false;
                        cx.notify();
                    })
                    .is_err()
                {
                    return;
                }
            }
        }));
    }
}

impl Pressable for GlitchState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        if self.hover_driven() {
            self.hovered = hovered;
            if !hovered {
                self.bursting = false;
            }
        }
        self.motion.set_hovered(hovered);
        true
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.motion.focus_visible = keyboard;
        self.motion.press()
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        self.motion.release()
    }
}

/// `eb-glitch-1` / `eb-glitch-2`: `(offset, inset top, inset bottom, translate x)`,
/// stepped (`steps(1)`), so each frame holds until the next.
const CHANNEL_A: [(f32, f32, f32, f32); 5] = [
    (0.0, 0.31, 0.40, -3.0),
    (0.2, 0.76, 0.05, 3.0),
    (0.4, 0.10, 0.63, -2.0),
    (0.6, 0.55, 0.18, 4.0),
    (0.8, 0.02, 0.84, -3.0),
];
const CHANNEL_B: [(f32, f32, f32, f32); 5] = [
    (0.0, 0.60, 0.10, 2.0),
    (0.2, 0.14, 0.52, -4.0),
    (0.4, 0.82, 0.03, 2.0),
    (0.6, 0.25, 0.45, -3.0),
    (0.8, 0.06, 0.70, 3.0),
];

fn stepped(frames: &[(f32, f32, f32, f32)], t: f32) -> (f32, f32, f32) {
    let frame = frames.iter().rev().find(|f| t >= f.0).unwrap_or(&frames[0]);
    (frame.1, frame.2, frame.3)
}

/// `eb-glitch-shake` (linear): `(x, y)` in px before `intensity`.
fn shake(t: f32) -> (f32, f32) {
    let xs = [
        (0.0, 0.0),
        (0.15, -2.0),
        (0.35, 2.0),
        (0.55, -1.0),
        (0.75, 1.0),
        (0.9, -2.0),
        (1.0, 0.0),
    ];
    let ys = [
        (0.0, 0.0),
        (0.15, 1.0),
        (0.35, -1.0),
        (0.55, 2.0),
        (0.75, -2.0),
        (0.9, 0.0),
        (1.0, 0.0),
    ];
    (keyframes(t, &xs), keyframes(t, &ys))
}

/// `eb-glitch-flicker` (linear).
fn flicker(t: f32) -> f32 {
    keyframes(
        t,
        &[
            (0.0, 1.0),
            (0.18, 1.0),
            (0.19, 0.35),
            (0.22, 1.0),
            (0.23, 0.35),
            (0.25, 1.0),
            (0.53, 1.0),
            (0.54, 0.35),
            (0.56, 0.35),
            (0.57, 1.0),
            (1.0, 1.0),
        ],
    )
}

/// Line box of `text-xs` (`line-height: 1rem`).
const LINE: f32 = 16.0;
/// `tracking-widest` at 12px.
const TRACKING: f32 = 1.2;

/// Advance of every character of `text` in `font` at `size`, unrounded, taken
/// from one shaped line (per-character text elements round their width up,
/// which would widen the label).
fn char_advances(text: &str, font: &gpui::Font, size: f32, window: &Window) -> Rc<[f32]> {
    let run = gpui::TextRun {
        len: text.len(),
        font: font.clone(),
        color: gpui::black(),
        background_color: None,
        underline: None,
        strikethrough: None,
    };
    let line = window
        .text_system()
        .shape_line(text.to_string().into(), px(size), &[run], None);
    // Glyph x by the byte index of its character.
    let mut starts: Vec<(usize, f32)> = line
        .runs
        .iter()
        .flat_map(|r| r.glyphs.iter().map(|g| (g.index, g.position.x.as_f32())))
        .collect();
    starts.sort_by_key(|(index, _)| *index);
    let width = line.width.as_f32();
    let x_at = |byte: usize| {
        starts
            .iter()
            .find(|(index, _)| *index >= byte)
            .map(|(_, x)| *x)
            .unwrap_or(width)
    };
    let bytes: Vec<usize> = text.char_indices().map(|(i, _)| i).collect();
    bytes
        .iter()
        .enumerate()
        .map(|(n, &start)| {
            let end = bytes.get(n + 1).map_or(width, |&next| x_at(next));
            (end - x_at(start)).max(0.0)
        })
        .collect()
}

/// The label with CSS letter-spacing (after every character), every box sized
/// to its true advance plus `spacing`, all at scale `s`.
fn spaced(label: &SharedString, advances: &[f32], spacing: f32, s: f32) -> Div {
    div().flex().flex_none().whitespace_nowrap().children(
        label
            .chars()
            .zip(advances.iter().copied())
            .map(move |(c, advance)| {
                div()
                    .flex_none()
                    .w(px((advance + spacing) * s))
                    .child(c.to_string())
            }),
    )
}
impl RenderOnce for GlitchButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let seed = {
            let text = format!("{:?}", self.id);
            text.bytes()
                .fold(0x9e37_79b9_u32, |h, b| h.rotate_left(5) ^ b as u32)
                | 1
        };
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<GlitchState>| {
                GlitchState {
                    motion: PressMotion::new(),
                    hovered: false,
                    bursting: false,
                    active_since: None,
                    trigger: GlitchTrigger::Hover,
                    interval: ms(3500),
                    duration: ms(450),
                    scheduler: None,
                    rng: seed,
                    focus: cx.focus_handle().tab_stop(true),
                }
            });

        let now = Instant::now();
        let (trigger, interval, duration) =
            (self.trigger, self.glitch_interval, self.glitch_duration);
        let (frame, active_for, focus, focus_visible) = state.update(cx, |s, cx| {
            if s.trigger != trigger {
                s.trigger = trigger;
                s.scheduler = None;
                s.bursting = false;
                if trigger == GlitchTrigger::Always {
                    s.hovered = false;
                }
            }
            s.interval = interval;
            s.duration = duration;
            s.ensure_scheduler(cx);
            if s.active() && !self.disabled {
                s.active_since.get_or_insert(now);
            } else {
                s.active_since = None;
            }
            (
                s.motion.frame(now),
                s.active_since
                    .map(|since| now.saturating_duration_since(since)),
                s.focus.clone(),
                (s.motion.focus_visible || window.last_input_was_keyboard())
                    && s.focus.is_focused(window),
            )
        });
        if frame.animating || active_for.is_some() {
            window.request_animation_frame();
        }

        // Every glitch keyframe loops over 70% of the burst duration.
        let burst = (self.glitch_duration.as_secs_f32() * 0.7).max(0.001);
        let phase = active_for.map(|d| (d.as_secs_f32() / burst).fract());
        let intensity = self.intensity;
        let (shake_x, shake_y) = phase.map(shake).unwrap_or((0.0, 0.0));
        let label_opacity = phase.map(flicker).unwrap_or(1.0);
        let label: SharedString = self.label.to_uppercase().into();
        let mut font = window.text_style().font();
        if let Some(family) = self.font_family.clone() {
            font.family = family;
        }
        font.weight = FontWeight::SEMIBOLD;
        let advances = char_advances(&label, &font, 12.0, window);

        // Clamp so quads and shadows never get radii past a pill (h-9 = 36px).
        let radius = px(self.radius.clamp(0.0, 18.0));
        let scanlines = self.scanlines;
        let (color_a, color_b) = self.colors;

        let active = phase.is_some();
        let channel_a = phase.map(|t| stepped(&CHANNEL_A, t));
        let channel_b = phase.map(|t| stepped(&CHANNEL_B, t));
        let surface: Rc<Cell<Option<Bounds<Pixels>>>> = Rc::new(Cell::new(None));
        let surface_for_prepaint = surface.clone();

        // The text stack, at press scale `s`: two RGB channels (the label clipped to
        // a horizontal band and nudged sideways), the scanlines, then the label.
        let content = move |s: f32| {
            let line = LINE * s;
            let channel = |color: Hsla, frame: Option<(f32, f32, f32)>| {
                let (top, bottom, dx) = frame.unwrap_or((0.0, 0.0, 0.0));
                let band_top = top * line;
                let band_h = ((1.0 - top - bottom) * line).max(0.0);
                div()
                    .absolute()
                    .left(px(dx * intensity * s))
                    .top(px(band_top))
                    .w_full()
                    .h(px(band_h))
                    .overflow_hidden()
                    .child(
                        spaced(&label, &advances, TRACKING, s)
                            .absolute()
                            .left_0()
                            .top(px(-band_top))
                            .text_color(color),
                    )
            };
            let surface = surface.clone();
            div()
                .relative()
                .h(px(line))
                .text_size(px(12.0 * s))
                .line_height(px(line))
                .when(active, |el| {
                    el.child(channel(color_a, channel_a))
                        .child(channel(color_b, channel_b))
                })
                .when(scanlines, |el| {
                    el.child(
                        canvas(
                            |_, _, _| {},
                            move |_, _, window, _| {
                                if let Some(bounds) = surface.get() {
                                    paint_scanlines(
                                        scale_bounds(bounds, frame.scale),
                                        radius * frame.scale,
                                        window,
                                    );
                                }
                            },
                        )
                        .absolute()
                        .size_0(),
                    )
                })
                .child(
                    spaced(&label, &advances, TRACKING, s)
                        .relative()
                        .opacity(label_opacity),
                )
                .into_any_element()
        };

        let button = div()
            .id(self.id)
            .relative()
            .left(px(shake_x * intensity))
            .top(px(shake_y * intensity))
            .flex()
            .flex_none()
            .h(px(36.0))
            .px(px(24.0))
            .items_center()
            .justify_center()
            .font_weight(FontWeight::SEMIBOLD)
            .when_some(self.font_family, |el, family| el.font_family(family))
            .text_color(surface_text(frame.brightness))
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    move |bounds, _, _| surface_for_prepaint.set(Some(bounds)),
                    move |bounds, _, window, _| {
                        if focus_visible {
                            paint_focus_ring(
                                bounds,
                                radius,
                                rgb_a(0xa1a1a1, 1.0),
                                rgb_a(0x0a0a0a, 1.0),
                                window,
                            );
                        }
                        paint_graded_surface(bounds, frame, radius, window);
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            .child(scaled_content(frame.scale, content));

        let button = wire(button, &state, &focus, self.disabled);
        match self.on_click.filter(|_| !self.disabled) {
            Some(handler) => button.on_click(move |e, w, cx| handler(e, w, cx)),
            None => button,
        }
    }
}

/// `repeating-linear-gradient(0deg, transparent 0 2px, rgb(0 0 0 / 0.1) 2px 4px)`,
/// clipped to the rounded surface.
fn paint_scanlines(bounds: Bounds<Pixels>, radius: Pixels, window: &mut Window) {
    let (x0, y0) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
    let (w, h) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
    let r = radius.as_f32().min(w * 0.5).min(h * 0.5);
    let color = rgb_a(0x000000, 0.1);
    // Rows run up from the bottom edge: 2px clear, then 2px dark.
    let mut bottom = h - 2.0;
    while bottom > 0.0 {
        let top = (bottom - 2.0).max(0.0);
        // Narrowest horizontal span of the rounded rect over this row.
        let inset = |y: f32| {
            let dy = if y < r {
                r - y
            } else if y > h - r {
                y - (h - r)
            } else {
                0.0
            };
            if dy <= 0.0 {
                0.0
            } else {
                r - (r * r - dy.min(r) * dy.min(r)).sqrt()
            }
        };
        let left = inset(top).max(inset(bottom));
        if w - 2.0 * left > 0.5 {
            window.paint_quad(quad(
                Bounds {
                    origin: point(px(x0 + left), px(y0 + top)),
                    size: gpui::size(px(w - 2.0 * left), px(bottom - top)),
                },
                gpui::Corners::default(),
                color,
                px(0.0),
                transparent_black(),
                Default::default(),
            ));
        }
        bottom -= 4.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn channel_frames_step() {
        assert_eq!(stepped(&CHANNEL_A, 0.0), (0.31, 0.40, -3.0));
        assert_eq!(stepped(&CHANNEL_A, 0.39), (0.76, 0.05, 3.0));
        assert_eq!(stepped(&CHANNEL_B, 0.99), (0.06, 0.70, 3.0));
    }

    #[test]
    fn flicker_dips() {
        assert_eq!(flicker(0.0), 1.0);
        assert!((flicker(0.19) - 0.35).abs() < 1e-4);
        assert!((flicker(0.55) - 0.35).abs() < 1e-4);
    }
}
