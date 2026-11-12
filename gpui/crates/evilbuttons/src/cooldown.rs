//! CooldownButton: locks itself behind a draining radial timer after each
//! click, taunting you while you wait.

use gpui::{
    App, Bounds, ClickEvent, Context, ElementId, FocusHandle, FontWeight, Hsla, InteractiveElement,
    IntoElement, ParentElement, PathBuilder, Pixels, Point, RenderOnce, SharedString,
    StatefulInteractiveElement, Styled, Task, Window, canvas, div, point, prelude::FluentBuilder,
    px,
};
use std::rc::Rc;
use std::sync::atomic::{AtomicU32, Ordering};

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Duration, Easing, Instant, Timeline, Transition};
use crate::surface::{
    PressMotion, ms, paint_focus_ring, paint_graded_surface, rgb_a, scale_bounds, scaled_content,
};

const DEFAULT_TAUNTS: [&str; 5] = [
    "Patience.",
    "Again? Wait.",
    "Not so fast.",
    "Cool it.",
    "Hold your horses.",
];

/// Label swap: the old label exits up, then the new one enters from below.
const SWAP: Duration = Duration::from_millis(160);

/// A button that locks itself behind a draining radial timer after each click.
///
/// ```ignore
/// CooldownButton::new("send")
///     .cooldown(Duration::from_millis(3000))
///     .on_click(|_, _, _| send_request())
/// ```
#[derive(IntoElement)]
pub struct CooldownButton {
    id: ElementId,
    label: SharedString,
    cooldown: Duration,
    taunts: Rc<[SharedString]>,
    show_countdown: bool,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl CooldownButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: "Send it".into(),
            cooldown: ms(3000),
            taunts: DEFAULT_TAUNTS
                .iter()
                .map(|t| SharedString::from(*t))
                .collect(),
            show_countdown: true,
            disabled: false,
            on_click: None,
        }
    }

    /// Idle label. Defaults to "Send it".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Lockout after each click. `Duration::ZERO` disables the cooldown. Defaults to 3s.
    pub fn cooldown(mut self, cooldown: Duration) -> Self {
        self.cooldown = cooldown;
        self
    }

    /// Messages shown while locked; one is picked at random per cooldown.
    pub fn taunts<I, S>(mut self, taunts: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<SharedString>,
    {
        self.taunts = taunts.into_iter().map(Into::into).collect();
        self
    }

    /// Append the remaining whole seconds to the taunt. Defaults to `true`.
    pub fn show_countdown(mut self, show: bool) -> Self {
        self.show_countdown = show;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fires immediately on a valid click, before the cooldown begins.
    pub fn on_click(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(handler));
        self
    }
}

struct CooldownState {
    motion: PressMotion,
    hovered: bool,
    cooling: Option<Timeline>,
    cooldown: Duration,
    taunt: SharedString,
    /// Label crossfade: the label leaving and when the swap started.
    swap: Option<(Timeline, SharedString)>,
    /// 0 = idle text colour, 1 = dimmed (`text-neutral-50/55`).
    dim: Transition,
    rng: u32,
    task: Option<Task<()>>,
    focus: FocusHandle,
}

impl CooldownState {
    fn next_random(&mut self) -> u32 {
        // xorshift32
        let mut x = self.rng;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.rng = x;
        x
    }

    fn start(
        &mut self,
        taunts: &[SharedString],
        previous_label: SharedString,
        cx: &mut Context<Self>,
    ) {
        self.taunt = if taunts.is_empty() {
            SharedString::default()
        } else {
            taunts[self.next_random() as usize % taunts.len()].clone()
        };
        let cooldown = self.cooldown;
        self.cooling = Some(Timeline::start(cooldown));
        self.swap = Some((Timeline::start(SWAP * 2), previous_label));
        self.dim.animate_to(1.0, ms(300), Easing::SPRINGY);
        // `disabled` drops :hover and :active styling for the whole lockout.
        self.motion.set_hovered(false);
        self.motion.release();
        self.task = Some(cx.spawn(async move |this, cx| {
            cx.background_executor().timer(cooldown).await;
            this.update(cx, |s, cx| {
                let leaving = s.cooling_label(Instant::now(), true);
                s.cooling = None;
                s.swap = Some((Timeline::start(SWAP * 2), leaving));
                s.dim.animate_to(0.0, ms(300), Easing::SPRINGY);
                s.motion.set_hovered(s.hovered);
                cx.notify();
            })
            .ok();
        }));
    }

    fn remaining_secs(&self, now: Instant) -> u64 {
        self.cooling.map_or(0, |t| {
            let left = self.cooldown.as_secs_f32() * (1.0 - t.progress(now));
            // The original refreshes this on a 200ms interval, so it never shows 0s.
            left.max(0.0).ceil().max(1.0) as u64
        })
    }

    fn cooling_label(&self, now: Instant, show_countdown: bool) -> SharedString {
        let remaining = self.remaining_secs(now);
        if show_countdown && remaining > 0 {
            format!("{} {remaining}s", self.taunt).into()
        } else {
            self.taunt.clone()
        }
    }
}

impl Pressable for CooldownState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        self.hovered = hovered;
        if self.cooling.is_some() {
            return false;
        }
        self.motion.set_hovered(hovered)
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        if self.cooling.is_some() {
            return false;
        }
        self.motion.focus_visible = keyboard;
        self.motion.press()
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        self.motion.release()
    }
}

static SEED: AtomicU32 = AtomicU32::new(0x9e37_79b9);

impl RenderOnce for CooldownButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<CooldownState>| {
                let seed = SEED.fetch_add(0x6d2b_79f5, Ordering::Relaxed)
                    ^ web_time::SystemTime::now()
                        .duration_since(web_time::UNIX_EPOCH)
                        .map_or(0, |d| d.subsec_nanos());
                CooldownState {
                    motion: PressMotion::new(),
                    hovered: false,
                    cooling: None,
                    cooldown: ms(3000),
                    taunt: SharedString::default(),
                    swap: None,
                    dim: Transition::new(0.0),
                    rng: seed | 1,
                    task: None,
                    focus: cx.focus_handle().tab_stop(true),
                }
            });
        let cooldown = self.cooldown;
        state.update(cx, |s, _| s.cooldown = cooldown);

        let now = Instant::now();
        let show_countdown = self.show_countdown;
        let idle_label = self.label.clone();
        let (frame, cooling, sweep, label, swap, dim, focus, focus_visible, animating) = {
            let s = state.read(cx);
            let frame = s.motion.frame(now);
            let cooling = s.cooling.is_some();
            let label = if cooling {
                s.cooling_label(now, show_countdown)
            } else {
                idle_label.clone()
            };
            let swap = s
                .swap
                .as_ref()
                .filter(|(t, _)| !t.is_done(now))
                .map(|(t, old)| (t.progress(now), old.clone()));
            (
                frame,
                cooling,
                s.cooling.map(|t| 1.0 - t.progress(now)),
                label,
                swap,
                s.dim.value(now).clamp(0.0, 1.0),
                s.focus.clone(),
                (s.motion.focus_visible || window.last_input_was_keyboard())
                    && s.focus.is_focused(window),
                frame.animating || cooling || swap_is_live(s, now) || s.dim.is_animating(now),
            )
        };
        if animating {
            window.request_animation_frame();
        }

        let radius = px(10.0);
        // `text-neutral-50` → `text-neutral-50/55`, brightness applied like `filter`.
        // `filter: brightness()` dims the label too while pressed.
        let text = crate::surface::brighten(gpui::rgb(0xfafafa), frame.brightness)
            .opacity(1.0 - 0.45 * dim);

        // AnimatePresence mode="wait": exit (y 0 → -8, fade) then enter (y 8 → 0).
        let (shown, y, opacity) = match swap {
            Some((p, old)) if p < 0.5 => {
                let t = Easing::EASE_OUT.apply(p * 2.0);
                (old, -8.0 * t, 1.0 - t)
            }
            Some((p, _)) => {
                let t = Easing::EASE_OUT.apply(p * 2.0 - 1.0);
                (label, 8.0 * (1.0 - t), t)
            }
            None => (label, 0.0, 1.0),
        };

        let button = div()
            .id(self.id)
            .relative()
            .flex()
            .flex_none()
            .h(px(36.0))
            .min_w(px(160.0))
            .px(px(16.0))
            .items_center()
            .justify_center()
            .text_size(px(14.0))
            .line_height(px(20.0))
            .font_weight(FontWeight::MEDIUM)
            .text_color(text)
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    |_, _, _| {},
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
                        if let Some(sweep) = sweep {
                            // conic-gradient(currentColor <sweep>, transparent 0) at opacity .12.
                            let face = scale_bounds(bounds, frame.scale);
                            paint_conic_sweep(
                                face,
                                (radius * frame.scale).as_f32(),
                                sweep,
                                text.opacity(0.12),
                                window,
                            );
                        }
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            .child(scaled_content(frame.scale, move |s| {
                div()
                    .relative()
                    .top(px(y * s))
                    .opacity(opacity)
                    .whitespace_nowrap()
                    .text_size(px(14.0 * s))
                    .line_height(px(20.0 * s))
                    .child(shown.clone())
                    .into_any_element()
            }));

        let button = wire(button, &state, &focus, self.disabled);
        if self.disabled {
            return button;
        }
        let button = button.when(cooling, |el| el.cursor_not_allowed());
        let taunts = self.taunts.clone();
        let on_click = self.on_click.clone();
        let click_state = state.clone();
        button.on_click(move |event, window, cx| {
            if click_state.read(cx).cooling.is_some() {
                return;
            }
            if let Some(handler) = on_click.as_ref() {
                handler(event, window, cx);
            }
            click_state.update(cx, |s, cx| {
                if !s.cooldown.is_zero() {
                    s.start(&taunts, idle_label.clone(), cx);
                }
                cx.notify();
            });
        })
    }
}

fn swap_is_live(s: &CooldownState, now: Instant) -> bool {
    s.swap.as_ref().is_some_and(|(t, _)| !t.is_done(now))
}

/// Fills the part of the rounded rect swept clockwise from 12 o'clock through
/// `fraction` of a turn, like `conic-gradient(color <deg>, transparent 0deg)`.
fn paint_conic_sweep(
    bounds: Bounds<Pixels>,
    radius: f32,
    fraction: f32,
    color: Hsla,
    window: &mut Window,
) {
    if fraction <= 0.0 || color.a <= 0.0 {
        return;
    }
    let outline = rounded_rect_from_top(bounds, radius, 8);
    let center = bounds.center();
    let (cx, cy) = (center.x.as_f32(), center.y.as_f32());
    // Clockwise angle from straight up, 0..1 turns.
    let turn = |(x, y): (f32, f32)| {
        let a = (x - cx).atan2(-(y - cy)) / std::f32::consts::TAU;
        if a < 0.0 { a + 1.0 } else { a }
    };
    let mut points: Vec<Point<Pixels>> = vec![point(px(cx), px(cy))];
    let mut prev = outline[0];
    points.push(point(px(prev.0), px(prev.1)));
    let mut prev_turn = 0.0;
    for &p in &outline[1..] {
        let t = turn(p);
        if t >= fraction || t < prev_turn {
            // Cut the edge where the ray at `fraction` crosses it.
            let span = (t.max(prev_turn) - prev_turn).max(f32::EPSILON);
            let k = ((fraction - prev_turn) / span).clamp(0.0, 1.0);
            let (x, y) = (prev.0 + (p.0 - prev.0) * k, prev.1 + (p.1 - prev.1) * k);
            points.push(point(px(x), px(y)));
            break;
        }
        points.push(point(px(p.0), px(p.1)));
        prev = p;
        prev_turn = t;
    }
    if fraction >= 1.0 {
        points.push(point(px(outline[0].0), px(outline[0].1)));
    }
    let mut path = PathBuilder::fill();
    path.add_polygon(&points, true);
    if let Ok(path) = path.build() {
        window.paint_path(path, color);
    }
}

/// Rounded-rect outline, clockwise, starting at the top-centre point.
fn rounded_rect_from_top(bounds: Bounds<Pixels>, radius: f32, segments: usize) -> Vec<(f32, f32)> {
    let (x0, y0) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
    let (x1, y1) = (bounds.right().as_f32(), bounds.bottom().as_f32());
    let r = radius.min((x1 - x0) * 0.5).min((y1 - y0) * 0.5);
    let mut points = vec![((x0 + x1) * 0.5, y0)];
    let corners = [
        (x1 - r, y0 + r, -90.0_f32),
        (x1 - r, y1 - r, 0.0),
        (x0 + r, y1 - r, 90.0),
        (x0 + r, y0 + r, 180.0),
    ];
    for (cx, cy, start) in corners {
        for s in 0..=segments {
            let angle = (start + 90.0 * s as f32 / segments as f32).to_radians();
            points.push((cx + r * angle.cos(), cy + r * angle.sin()));
        }
    }
    points.push(((x0 + x1) * 0.5, y0));
    points
}

#[cfg(test)]
mod tests {
    use super::*;
    use gpui::size;

    #[test]
    fn outline_starts_at_top_centre_and_closes() {
        let b = Bounds::new(point(px(0.0), px(0.0)), size(px(160.0), px(36.0)));
        let outline = rounded_rect_from_top(b, 10.0, 8);
        assert_eq!(outline.first(), Some(&(80.0, 0.0)));
        assert_eq!(outline.last(), Some(&(80.0, 0.0)));
    }
}
