//! ClickPowerUp: a hatched, bracketed button that arms on hover (a panel
//! wipes in and the corner brackets spread) and powers up on every click with
//! an accent flash and a bouncy bracket burst.

use gpui::{
    App, Bounds, BoxShadow, ClickEvent, Context, Corners, ElementId, FocusHandle, FontWeight, Hsla,
    InteractiveElement, IntoElement, ParentElement, PathBuilder, Pixels, RenderOnce, SharedString,
    StatefulInteractiveElement, Styled, Task, TextAlign, TextRun, Window, WindowAppearance, canvas,
    div, point, prelude::FluentBuilder, px, quad, size, transparent_black,
};
use std::rc::Rc;

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Duration, Easing, Instant, Transition};
use crate::surface::{ms, paint_focus_ring, rgb_a};

/// `{ type: "spring", stiffness: 320, damping: 22 }`, the default for every layer.
const SPRING: Cfg = Cfg::new(320.0, 22.0);
/// Brackets overshoot outward on power-up.
const BURST: Cfg = Cfg::new(600.0, 11.0);
/// The label pops back on power-up.
const POP: Cfg = Cfg::new(600.0, 12.0);
/// Letter spacing: `tracking-[0.18em]`.
const TRACKING: f32 = 0.18;

/// A bracketed button that arms on hover and powers up with an accent flash on click.
///
/// ```ignore
/// ClickPowerUp::new("launch", "Launch").on_click(|_, _, _| println!("Powered up"))
/// ```
#[derive(IntoElement)]
pub struct ClickPowerUp {
    id: ElementId,
    label: SharedString,
    tap_duration: Duration,
    accent_color: Hsla,
    background: Option<Hsla>,
    foreground: Option<Hsla>,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl ClickPowerUp {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            tap_duration: ms(500),
            accent_color: rgb_a(0x2cd4bd, 1.0),
            background: None,
            foreground: None,
            disabled: false,
            on_click: None,
        }
    }

    /// How long the powered-up flash lasts after a click. Defaults to 500ms.
    pub fn tap_duration(mut self, duration: Duration) -> Self {
        self.tap_duration = duration;
        self
    }

    /// Colour of the powered-up flash. Defaults to `#2CD4BD`.
    pub fn accent_color(mut self, color: impl Into<Hsla>) -> Self {
        self.accent_color = color.into();
        self
    }

    /// Face colour (your theme's background). Defaults to shadcn's
    /// `--background` for the window's light or dark appearance.
    pub fn background(mut self, color: impl Into<Hsla>) -> Self {
        self.background = Some(color.into());
        self
    }

    /// Ink colour for the label, brackets, hatching and armed panel (your
    /// theme's foreground). Defaults to shadcn's `--foreground`.
    pub fn foreground(mut self, color: impl Into<Hsla>) -> Self {
        self.foreground = Some(color.into());
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired on every click.
    pub fn on_click(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(handler));
        self
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Phase {
    Rest,
    Hover,
    Tap,
    Powered,
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct Cfg {
    stiffness: f32,
    damping: f32,
}

impl Cfg {
    const fn new(stiffness: f32, damping: f32) -> Self {
        Self { stiffness, damping }
    }
}

/// A motion-style spring whose config can change with each new target (motion
/// uses the transition of the variant being animated to).
#[derive(Clone, Copy, Debug)]
struct Spring {
    value: f32,
    velocity: f32,
    target: f32,
    cfg: Cfg,
    last: Instant,
}

impl Spring {
    fn new(value: f32) -> Self {
        Self {
            value,
            velocity: 0.0,
            target: value,
            cfg: SPRING,
            last: Instant::now(),
        }
    }

    fn settled(&self) -> bool {
        self.value == self.target && self.velocity == 0.0
    }

    fn advance(&mut self, now: Instant) -> f32 {
        let elapsed = now
            .saturating_duration_since(self.last)
            .as_secs_f32()
            .min(0.064);
        self.last = now;
        if self.settled() {
            return self.value;
        }
        const STEP: f32 = 1.0 / 240.0;
        let mut remaining = elapsed;
        while remaining > 0.0 {
            let h = remaining.min(STEP);
            let force =
                -self.cfg.stiffness * (self.value - self.target) - self.cfg.damping * self.velocity;
            self.velocity += force * h;
            self.value += self.velocity * h;
            remaining -= h;
        }
        if (self.value - self.target).abs() < 0.001 && self.velocity.abs() < 0.01 {
            self.value = self.target;
            self.velocity = 0.0;
        }
        self.value
    }

    fn set(&mut self, target: f32, cfg: Cfg) {
        self.advance(Instant::now());
        self.target = target;
        self.cfg = cfg;
    }
}

/// A colour that cross-fades to each new target (CSS `transition-colors`).
#[derive(Clone, Copy, Debug)]
struct ColorFade {
    from: Hsla,
    to: Hsla,
    mix: Transition,
}

impl ColorFade {
    fn value(&self, now: Instant) -> Hsla {
        mix(self.from, self.to, self.mix.value(now))
    }

    fn set(&mut self, to: Hsla, duration: Duration) {
        if self.to == to {
            return;
        }
        let now = Instant::now();
        self.from = self.value(now);
        self.to = to;
        self.mix.replay(0.0, 1.0, duration, Easing::STANDARD);
    }
}

/// Which ink the label uses in each phase; resolved to colours at render time.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Ink {
    Foreground,
    Background,
    Dark,
}

struct PowerUpState {
    hovered: bool,
    pressed: bool,
    powered: bool,
    focus_visible: bool,
    /// Bracket spread in px along each corner's diagonal, and bracket opacity.
    spread: Spring,
    bracket_opacity: Spring,
    /// Armed panel `scaleX`.
    panel: Spring,
    /// Label scale.
    label_scale: Spring,
    /// Accent flash opacity.
    flash: Transition,
    ink: Ink,
    label_color: Option<ColorFade>,
    tap_duration: Duration,
    task: Option<Task<()>>,
    focus: FocusHandle,
}

impl PowerUpState {
    fn phase(&self) -> Phase {
        // Pressing wins so every click, even mid power-up, snaps in then bursts out.
        if self.pressed {
            Phase::Tap
        } else if self.powered {
            Phase::Powered
        } else if self.hovered {
            Phase::Hover
        } else {
            Phase::Rest
        }
    }

    fn retarget(&mut self) {
        let phase = self.phase();
        let (spread, opacity, panel, scale, bracket_cfg, label_cfg, ink) = match phase {
            Phase::Rest => (0.0, 0.45, 0.0, 1.0, SPRING, SPRING, Ink::Foreground),
            Phase::Hover => (4.0, 1.0, 1.0, 1.0, SPRING, SPRING, Ink::Background),
            Phase::Tap => (-2.0, 1.0, 1.0, 0.94, SPRING, SPRING, Ink::Background),
            Phase::Powered => (6.0, 1.0, 1.0, 1.0, BURST, POP, Ink::Dark),
        };
        if self.spread.target != spread || self.spread.cfg != bracket_cfg {
            self.spread.set(spread, bracket_cfg);
        }
        if self.bracket_opacity.target != opacity {
            self.bracket_opacity.set(opacity, bracket_cfg);
        }
        if self.panel.target != panel {
            self.panel.set(panel, SPRING);
        }
        if self.label_scale.target != scale || self.label_scale.cfg != label_cfg {
            self.label_scale.set(scale, label_cfg);
        }
        self.ink = ink;
    }

    fn set_powered(&mut self, powered: bool) {
        self.powered = powered;
        let (to, duration) = if powered { (1.0, 80) } else { (0.0, 300) };
        // motion's default tween curve.
        self.flash
            .animate_to(to, ms(duration), Easing::CubicBezier(0.25, 0.1, 0.35, 1.0));
        self.retarget();
    }
}

impl Pressable for PowerUpState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        if self.hovered == hovered {
            return false;
        }
        self.hovered = hovered;
        if !hovered {
            self.pressed = false;
        }
        self.retarget();
        true
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.focus_visible = keyboard;
        if self.pressed {
            return false;
        }
        self.pressed = true;
        self.retarget();
        true
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        if !self.pressed {
            return false;
        }
        self.pressed = false;
        self.retarget();
        true
    }
}

impl RenderOnce for ClickPowerUp {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let dark_window = matches!(
            window.appearance(),
            WindowAppearance::Dark | WindowAppearance::VibrantDark
        );
        let background = self
            .background
            .unwrap_or_else(|| rgb_a(if dark_window { 0x0a0a0a } else { 0xffffff }, 1.0));
        let foreground = self
            .foreground
            .unwrap_or_else(|| rgb_a(if dark_window { 0xfafafa } else { 0x0a0a0a }, 1.0));
        let accent = self.accent_color;
        let ink_color = move |ink: Ink| match ink {
            Ink::Foreground => foreground,
            Ink::Background => background,
            Ink::Dark => rgb_a(0x0a0a0a, 1.0),
        };

        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<PowerUpState>| {
                PowerUpState {
                    hovered: false,
                    pressed: false,
                    powered: false,
                    focus_visible: false,
                    spread: Spring::new(0.0),
                    bracket_opacity: Spring::new(0.45),
                    panel: Spring::new(0.0),
                    label_scale: Spring::new(1.0),
                    flash: Transition::new(0.0),
                    ink: Ink::Foreground,
                    label_color: None,
                    tap_duration: ms(500),
                    task: None,
                    focus: cx.focus_handle().tab_stop(true),
                }
            });

        let now = Instant::now();
        let tap_duration = self.tap_duration;
        let (phase, spread, bracket_opacity, panel, label_scale, flash, label_color, animating) =
            state.update(cx, |s, _| {
                s.tap_duration = tap_duration;
                let target = ink_color(s.ink);
                let fade = s.label_color.get_or_insert(ColorFade {
                    from: target,
                    to: target,
                    mix: Transition::new(1.0),
                });
                fade.set(target, ms(150));
                let label_color = fade.value(now);
                let fading = fade.mix.is_animating(now);
                let values = (
                    s.spread.advance(now),
                    s.bracket_opacity.advance(now),
                    s.panel.advance(now),
                    s.label_scale.advance(now),
                    s.flash.value(now),
                );
                let animating = fading
                    || !s.spread.settled()
                    || !s.bracket_opacity.settled()
                    || !s.panel.settled()
                    || !s.label_scale.settled()
                    || s.flash.is_animating(now);
                (
                    s.phase(),
                    values.0,
                    values.1,
                    values.2,
                    values.3,
                    values.4,
                    label_color,
                    animating,
                )
            });
        let (focus, focus_visible) = {
            let s = state.read(cx);
            (
                s.focus.clone(),
                (s.focus_visible || window.last_input_was_keyboard()) && s.focus.is_focused(window),
            )
        };
        if animating {
            window.request_animation_frame();
        }

        let dark = is_dark(background);
        let bracket_color = if phase == Phase::Powered {
            accent
        } else {
            foreground
        }
        .opacity(bracket_opacity.clamp(0.0, 1.0));
        let label = self.label.to_uppercase();

        let button = div()
            .id(self.id.clone())
            .relative()
            .flex()
            .flex_none()
            .items_center()
            .justify_center()
            .px(px(40.0))
            .py(px(12.0))
            .text_size(px(14.0))
            .line_height(px(20.0))
            .font_weight(FontWeight::MEDIUM)
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            // Face: shadowed, hatched surface with the armed panel and accent flash.
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| {
                        if focus_visible {
                            paint_focus_ring(
                                bounds,
                                px(0.0),
                                rgb_a(0xa1a1a1, 1.0),
                                background,
                                window,
                            );
                        }
                        paint_face(
                            bounds,
                            background,
                            foreground,
                            accent.opacity(flash.clamp(0.0, 1.0)),
                            panel.clamp(0.0, 1.0),
                            dark,
                            window,
                        );
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            // Corner brackets.
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| {
                        paint_brackets(bounds, spread, bracket_color, window);
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            // An invisible copy at scale 1 sizes the button, so the scaled label never reflows it.
            .child(tracked(&label, 14.0, label_color).opacity(0.0))
            .child(
                div()
                    .absolute()
                    .top_0()
                    .left_0()
                    .size_full()
                    .flex()
                    .items_center()
                    .justify_center()
                    .child(tracked(&label, 14.0 * label_scale, label_color)),
            );

        let button = wire(button, &state, &focus, self.disabled);
        if self.disabled {
            return button;
        }
        let click_state = state.clone();
        let on_click = self.on_click.clone();
        button.on_click(move |event, window, cx| {
            if let Some(handler) = on_click.as_ref() {
                handler(event, window, cx);
            }
            click_state.update(cx, |s, cx| {
                s.set_powered(true);
                let duration = s.tap_duration;
                s.task = Some(cx.spawn(async move |this, cx| {
                    cx.background_executor().timer(duration).await;
                    this.update(cx, |s, cx| {
                        s.set_powered(false);
                        cx.notify();
                    })
                    .ok();
                }));
                cx.notify();
            });
        })
    }
}

/// Text with CSS `letter-spacing` (GPUI has none): the label is laid out
/// invisibly for its natural width plus the spacing after every glyph (as CSS
/// adds it), and each glyph is painted at its kerned position plus the
/// spacing accumulated before it.
fn letter_spaced(
    label: SharedString,
    size: f32,
    line_height: f32,
    spacing: f32,
    color: Hsla,
) -> gpui::Div {
    let count = label.chars().count() as f32;
    let text = label.clone();
    div()
        .relative()
        .flex_none()
        .text_size(px(size))
        .line_height(px(line_height))
        .whitespace_nowrap()
        .child(div().invisible().mr(px(spacing * count)).child(label))
        .child(
            canvas(
                |_, _, _| {},
                move |bounds, _, window, cx| {
                    let font = window.text_style().font();
                    let run = |len: usize| TextRun {
                        len,
                        font: font.clone(),
                        color,
                        background_color: None,
                        underline: None,
                        strikethrough: None,
                    };
                    let font_size = px(size);
                    let line = window.text_system().shape_line(
                        text.clone(),
                        font_size,
                        &[run(text.len())],
                        None,
                    );
                    let positions: Vec<(usize, Pixels)> = line
                        .runs
                        .iter()
                        .flat_map(|r| r.glyphs.iter().map(|g| (g.index, g.position.x)))
                        .collect();
                    for (i, (byte, ch)) in text.char_indices().enumerate() {
                        let Some(&(_, x)) = positions.iter().find(|(index, _)| *index == byte)
                        else {
                            continue;
                        };
                        let glyph: SharedString = ch.to_string().into();
                        let shaped = window.text_system().shape_line(
                            glyph.clone(),
                            font_size,
                            &[run(glyph.len())],
                            None,
                        );
                        let origin = point(
                            bounds.origin.x + x + px(spacing * i as f32),
                            bounds.origin.y,
                        );
                        shaped
                            .paint(origin, px(line_height), TextAlign::Left, None, window, cx)
                            .ok();
                    }
                },
            )
            .absolute()
            .top_0()
            .left_0()
            .size_full(),
        )
}

/// The uppercase label with `tracking-[0.18em]`.
fn tracked(label: &str, size: f32, color: Hsla) -> gpui::Div {
    letter_spaced(label.to_string().into(), size, 20.0, TRACKING * size, color)
}

fn is_dark(color: Hsla) -> bool {
    color.l < 0.5
}

fn mix(a: Hsla, b: Hsla, t: f32) -> Hsla {
    let (a, b) = (gpui::Rgba::from(a), gpui::Rgba::from(b));
    let l = |x: f32, y: f32| x + (y - x) * t;
    gpui::Rgba {
        r: l(a.r, b.r),
        g: l(a.g, b.g),
        b: l(a.b, b.b),
        a: l(a.a, b.a),
    }
    .into()
}

fn shadow(x: f32, y: f32, blur: f32, spread: f32, color: Hsla, inset: bool) -> BoxShadow {
    BoxShadow {
        color,
        offset: point(px(x), px(y)),
        // CSS blur radius is 2σ; GPUI takes σ.
        blur_radius: px(blur / 2.0),
        spread_radius: px(spread),
        inset,
    }
}

fn paint_face(
    bounds: Bounds<Pixels>,
    background: Hsla,
    foreground: Hsla,
    flash: Hsla,
    panel: f32,
    dark: bool,
    window: &mut Window,
) {
    let square = Corners::all(px(0.0));
    let black = |a: f32| rgb_a(0x000000, a);
    if dark {
        // 0_1px_2px_rgb(0_0_0/0.4)
        window.paint_drop_shadows(
            bounds,
            square,
            &[shadow(0.0, 1.0, 2.0, 0.0, black(0.4), false)],
        );
    } else {
        // 0_1px_2px_rgb(0_0_0/0.05), 0_2px_6px_-3px_rgb(0_0_0/0.07)
        window.paint_drop_shadows(
            bounds,
            square,
            &[
                shadow(0.0, 2.0, 6.0, -3.0, black(0.07), false),
                shadow(0.0, 1.0, 2.0, 0.0, black(0.05), false),
            ],
        );
    }
    window.paint_quad(quad(
        bounds,
        square,
        background,
        px(0.0),
        transparent_black(),
        Default::default(),
    ));

    window.with_content_mask(Some(gpui::ContentMask { bounds }), |window| {
        // repeating-linear-gradient(315deg, hatch 0 1px, transparent 0 50%) on a 7px tile:
        // 1px "/" lines where x + y is a multiple of 7, in foreground at 10%.
        let (x0, y0) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
        let (w, h) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
        let band = std::f32::consts::SQRT_2;
        let mut hatch = PathBuilder::fill();
        let mut k = 7.0_f32;
        while k - band < w + h {
            // Points with x + y in [k - band, k], across the full height.
            let p = |s: f32, y: f32| point(px(x0 + s - y), px(y0 + y));
            hatch.add_polygon(
                &[p(k - band, 0.0), p(k, 0.0), p(k, h), p(k - band, h)],
                true,
            );
            k += 7.0;
        }
        if let Ok(path) = hatch.build() {
            window.paint_path(path, foreground.opacity(foreground.a * 0.1));
        }

        // The armed panel wipes in from the left (`scaleX`, origin-left).
        if panel > 0.0 {
            window.paint_quad(quad(
                Bounds::new(
                    bounds.origin,
                    size(bounds.size.width * panel, bounds.size.height),
                ),
                square,
                foreground,
                px(0.0),
                transparent_black(),
                Default::default(),
            ));
        }
        if flash.a > 0.001 {
            window.paint_quad(quad(
                bounds,
                square,
                flash,
                px(0.0),
                transparent_black(),
                Default::default(),
            ));
        }
    });

    let white = |a: f32| rgb_a(0xffffff, a);
    let inset = if dark {
        shadow(0.0, 1.0, 0.0, 0.0, white(0.05), true)
    } else {
        shadow(0.0, -1.0, 0.0, 0.0, black(0.03), true)
    };
    window.paint_inset_shadows(bounds, square, &[inset]);
}

/// Four 10px corner brackets (1px strokes), pushed `spread` px out along each diagonal.
fn paint_brackets(bounds: Bounds<Pixels>, spread: f32, color: Hsla, window: &mut Window) {
    if color.a <= 0.001 {
        return;
    }
    let (arm, stroke) = (px(10.0), px(1.0));
    let (left, top) = (bounds.origin.x, bounds.origin.y);
    let (right, bottom) = (bounds.right(), bounds.bottom());
    let d = px(spread);
    let mut rect = |x: Pixels, y: Pixels, w: Pixels, h: Pixels| {
        window.paint_quad(quad(
            Bounds::new(point(x, y), size(w, h)),
            Corners::all(px(0.0)),
            color,
            px(0.0),
            transparent_black(),
            Default::default(),
        ));
    };
    // Top-left, top-right, bottom-left, bottom-right.
    rect(left - d, top - d, arm, stroke);
    rect(left - d, top - d, stroke, arm);
    rect(right + d - arm, top - d, arm, stroke);
    rect(right + d - stroke, top - d, stroke, arm);
    rect(left - d, bottom + d - stroke, arm, stroke);
    rect(left - d, bottom + d - arm, stroke, arm);
    rect(right + d - arm, bottom + d - stroke, arm, stroke);
    rect(right + d - stroke, bottom + d - arm, stroke, arm);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn burst_spring_overshoots_and_settles() {
        let mut spring = Spring::new(0.0);
        spring.set(6.0, BURST);
        let mut now = Instant::now();
        let mut peak = 0.0_f32;
        for _ in 0..240 {
            now += Duration::from_millis(16);
            peak = peak.max(spring.advance(now));
        }
        assert!(peak > 6.5, "burst should overshoot, peaked at {peak}");
        assert!(spring.settled());
    }
}
