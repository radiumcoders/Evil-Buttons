//! DoubtButton: an escalating-confirmation button. Every click swaps in a more
//! guilt-tripping prompt (with a little shake) until the last one finally fires.

use gpui::{
    App, Bounds, Context, ElementId, FocusHandle, FontWeight, InteractiveElement, IntoElement,
    ParentElement, PathBuilder, Pixels, Point, RenderOnce, SharedString,
    StatefulInteractiveElement, Styled, Task, Window, canvas, div, point, prelude::FluentBuilder,
    px, transparent_black,
};
use std::rc::Rc;

use crate::icons::{Icon, paint_icon};
use crate::interaction::{Pressable, wire};
use crate::motion::{Duration, Easing, Instant, Timeline, Transition, keyframes};
use crate::surface::{
    PressMotion, ms, paint_focus_ring, paint_graded_surface, rgb_a, scale_bounds, scaled_content,
};

/// Tailwind's `ease-out`.
const TW_EASE_OUT: Easing = Easing::CubicBezier(0.0, 0.0, 0.2, 1.0);

type ConfirmHandler = Rc<dyn Fn(&mut Window, &mut App)>;

const DEFAULT_CONFIRMATIONS: [&str; 6] = [
    "Are you sure?",
    "Really, truly sure?",
    "There is no undo. Still?",
    "Think of the consequences.",
    "I am obligated to ask again.",
    "Last chance. Absolutely certain?",
];

/// A button that makes you click through escalating doubts before it acts.
///
/// ```ignore
/// DoubtButton::new("wipe")
///     .label("Delete everything")
///     .success_label("Too late.")
///     .on_confirm(|_, _| wipe_database())
/// ```
#[derive(IntoElement)]
pub struct DoubtButton {
    id: ElementId,
    label: SharedString,
    confirmations: Vec<SharedString>,
    success_label: SharedString,
    reset_after: Duration,
    disabled: bool,
    on_confirm: Option<ConfirmHandler>,
}

impl DoubtButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: "Delete everything".into(),
            confirmations: DEFAULT_CONFIRMATIONS
                .iter()
                .map(|s| SharedString::from(*s))
                .collect(),
            success_label: "Too late.".into(),
            reset_after: ms(1600),
            disabled: false,
            on_confirm: None,
        }
    }

    /// Label shown before any doubt has been cast. Defaults to "Delete everything".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Prompts shown one per click; clicking the last one fires `on_confirm`.
    /// An empty list makes it a normal one-shot button.
    pub fn confirmations<I, S>(mut self, confirmations: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<SharedString>,
    {
        self.confirmations = confirmations.into_iter().map(Into::into).collect();
        self
    }

    /// Label flashed once every doubt has been pushed through. Defaults to "Too late.".
    pub fn success_label(mut self, label: impl Into<SharedString>) -> Self {
        self.success_label = label.into();
        self
    }

    /// How long to stay in the success state. `Duration::ZERO` stays. Defaults to 1.6s.
    pub fn reset_after(mut self, reset_after: Duration) -> Self {
        self.reset_after = reset_after;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired only after the last confirmation is clicked.
    pub fn on_confirm(mut self, handler: impl Fn(&mut Window, &mut App) + 'static) -> Self {
        self.on_confirm = Some(Rc::new(handler));
        self
    }
}

/// Which label is showing: the idle label / a confirmation (`Step`), or success.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Shown {
    Step(usize),
    Success,
}

struct DoubtState {
    motion: PressMotion,
    /// 0 = idle; 1..=steps shows `confirmations[index - 1]`.
    index: usize,
    success: bool,
    /// The label entering (0 → 1 over 180ms), and the one leaving, if any.
    shown: Shown,
    enter: Timeline,
    leaving: Option<(Shown, Timeline)>,
    shake: Option<Timeline>,
    /// Hairline progress along the bottom edge (0–1).
    progress: Transition,
    task: Option<Task<()>>,
    focus: FocusHandle,
}

impl DoubtState {
    fn show(&mut self, next: Shown) {
        if next == self.shown {
            return;
        }
        self.leaving = Some((self.shown, Timeline::start(ms(180))));
        self.shown = next;
        self.enter = Timeline::start(ms(180));
    }

    fn set_progress(&mut self, value: f32) {
        self.progress.animate_to(value, ms(300), TW_EASE_OUT);
    }
}

impl Pressable for DoubtState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        self.motion.set_hovered(hovered)
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.motion.focus_visible = keyboard;
        self.motion.press()
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        self.motion.release()
    }
}

impl RenderOnce for DoubtButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<DoubtState>| {
                DoubtState {
                    motion: PressMotion::new(),
                    index: 0,
                    success: false,
                    shown: Shown::Step(0),
                    enter: Timeline::start(Duration::ZERO),
                    leaving: None,
                    shake: None,
                    progress: Transition::new(0.0),
                    task: None,
                    focus: cx.focus_handle().tab_stop(true),
                }
            });

        let now = Instant::now();
        let steps = self.confirmations.len();
        let (frame, shown, enter, leaving, shake, progress, success, focus, focus_visible) = {
            let s = state.read(cx);
            let leaving = s
                .leaving
                .filter(|(_, t)| !t.is_done(now))
                .map(|(shown, t)| (shown, t.progress(now)));
            (
                s.motion.frame(now),
                s.shown,
                s.enter.progress(now),
                leaving,
                s.shake.filter(|t| !t.is_done(now)).map(|t| t.progress(now)),
                s.progress.value(now),
                s.success,
                s.focus.clone(),
                (s.motion.focus_visible || window.last_input_was_keyboard())
                    && s.focus.is_focused(window),
            )
        };
        if frame.animating
            || enter < 1.0
            || leaving.is_some()
            || shake.is_some()
            || state.read(cx).progress.is_animating(now)
        {
            window.request_animation_frame();
        }

        let text_for = |shown: Shown| -> SharedString {
            match shown {
                Shown::Success => self.success_label.clone(),
                Shown::Step(0) => self.label.clone(),
                Shown::Step(i) => self
                    .confirmations
                    .get(i - 1)
                    .cloned()
                    .unwrap_or_else(|| self.label.clone()),
            }
        };
        // The longest prompt (by characters) reserves width so the button never jumps.
        let widest = std::iter::once(&self.label)
            .chain(std::iter::once(&self.success_label))
            .chain(self.confirmations.iter())
            .fold(SharedString::default(), |widest, candidate| {
                if candidate.chars().count() > widest.chars().count() {
                    candidate.clone()
                } else {
                    widest
                }
            });

        // x: [0, -4, 4, -2, 2, 0] over 300ms, easeInOut on every segment.
        let shake_x = shake.map_or(0.0, |t| {
            let segments = 5.0;
            let i = (t * segments).floor().min(segments - 1.0);
            let local = Easing::EASE_IN_OUT.apply(t * segments - i);
            keyframes(
                (i + local) / segments,
                &[
                    (0.0, 0.0),
                    (0.2, -4.0),
                    (0.4, 4.0),
                    (0.6, -2.0),
                    (0.8, 2.0),
                    (1.0, 0.0),
                ],
            )
        });

        let text = filtered_text(frame.brightness);
        let enter_p = Easing::EASE_OUT.apply(enter);
        let shown_text = text_for(shown);
        let leaving = leaving.map(|(gone, t)| (text_for(gone), Easing::EASE_OUT.apply(t)));
        // Everything inside the button scales with the press, like CSS `scale()`.
        let content = move |s: f32| {
            let label_layer = |label: SharedString, y: f32, opacity: f32| {
                div()
                    .absolute()
                    .top(px(y * s))
                    .left_0()
                    .right_0()
                    .flex()
                    .justify_center()
                    .whitespace_nowrap()
                    .opacity(opacity)
                    .child(label)
            };
            let labels = div()
                .relative()
                .flex()
                .whitespace_nowrap()
                // Invisible widest prompt reserves the width.
                .child(div().text_color(transparent_black()).child(widest.clone()))
                .child(label_layer(
                    shown_text.clone(),
                    8.0 * (1.0 - enter_p),
                    enter_p,
                ))
                .when_some(leaving.clone(), |el, (gone, p)| {
                    el.child(label_layer(gone, -8.0 * p, 1.0 - p))
                });
            div()
                .relative()
                .left(px(shake_x * s))
                .flex()
                .items_center()
                .gap(px(6.0 * s))
                .text_size(px(14.0 * s))
                .line_height(px(20.0 * s))
                .when(success, |el| {
                    el.child(
                        canvas(
                            |_, _, _| {},
                            move |bounds, _, window, _| {
                                paint_icon(Icon::Check, bounds, 2.25, 1.0, text, window);
                            },
                        )
                        .size(px(14.0 * s))
                        .flex_none(),
                    )
                })
                .child(labels)
                .into_any_element()
        };

        let radius = px(10.0);
        let bar_color = text.opacity(0.5);
        let button = div()
            .id(self.id.clone())
            .relative()
            .flex()
            .flex_none()
            .h(px(36.0))
            .min_w(px(192.0))
            .px(px(16.0))
            .items_center()
            .justify_center()
            .overflow_hidden()
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
                        if steps > 0 && progress > 0.001 {
                            let surface = scale_bounds(bounds, frame.scale);
                            paint_progress(
                                surface,
                                radius * frame.scale,
                                progress,
                                bar_color,
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
            .child(scaled_content(frame.scale, content));

        let button = wire(button, &state, &focus, self.disabled);
        if self.disabled {
            return button;
        }
        let reset_after = self.reset_after;
        let on_confirm = self.on_confirm.clone();
        let click_state = state.clone();
        button.on_click(move |_, window, cx| {
            let fired = click_state.update(cx, |s, cx| {
                cx.notify();
                if s.success {
                    return false;
                }
                if steps > 0 && s.index < steps {
                    s.index += 1;
                    s.show(Shown::Step(s.index));
                    s.shake = Some(Timeline::start(ms(300)));
                    s.set_progress(s.index as f32 / steps as f32);
                    return false;
                }
                s.success = true;
                s.index = 0;
                s.shake = None;
                s.show(Shown::Success);
                s.set_progress(if steps > 0 { 1.0 } else { 0.0 });
                s.task = (!reset_after.is_zero()).then(|| {
                    cx.spawn(async move |this, cx| {
                        cx.background_executor().timer(reset_after).await;
                        this.update(cx, |s, cx| {
                            s.success = false;
                            s.show(Shown::Step(0));
                            s.set_progress(0.0);
                            cx.notify();
                        })
                        .ok();
                    })
                });
                true
            });
            if fired && let Some(on_confirm) = on_confirm.as_ref() {
                on_confirm(window, cx);
            }
        })
    }
}

/// The 2px hairline along the bottom edge, `scaleX(progress)` from the left,
/// clipped to the button's rounded corners.
fn paint_progress(
    bounds: Bounds<Pixels>,
    radius: Pixels,
    progress: f32,
    color: gpui::Hsla,
    window: &mut Window,
) {
    let (x0, y1) = (
        bounds.origin.x.as_f32(),
        bounds.origin.y.as_f32() + bounds.size.height.as_f32(),
    );
    let w = bounds.size.width.as_f32() * progress.clamp(0.0, 1.0);
    let bar = [(x0, y1 - 2.0), (x0 + w, y1 - 2.0), (x0 + w, y1), (x0, y1)];
    let clip = rounded_rect_polygon(bounds, radius.as_f32(), 8);
    let poly = clip_convex(&bar, &clip);
    if poly.len() < 3 {
        return;
    }
    let points: Vec<Point<Pixels>> = poly.iter().map(|&(x, y)| point(px(x), px(y))).collect();
    let mut builder = PathBuilder::fill();
    builder.add_polygon(&points, true);
    if let Ok(path) = builder.build() {
        window.paint_path(path, color);
    }
}

/// Clockwise polygon of a rounded rect.
fn rounded_rect_polygon(bounds: Bounds<Pixels>, radius: f32, segments: usize) -> Vec<(f32, f32)> {
    let (x0, y0) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
    let (x1, y1) = (
        x0 + bounds.size.width.as_f32(),
        y0 + bounds.size.height.as_f32(),
    );
    let r = radius
        .min(bounds.size.width.as_f32() * 0.5)
        .min(bounds.size.height.as_f32() * 0.5);
    let corners = [
        (x1 - r, y0 + r, -90.0_f32),
        (x1 - r, y1 - r, 0.0),
        (x0 + r, y1 - r, 90.0),
        (x0 + r, y0 + r, 180.0),
    ];
    let mut points = Vec::with_capacity(4 * (segments + 1));
    for (cx, cy, start) in corners {
        for s in 0..=segments {
            let angle = (start + 90.0 * s as f32 / segments as f32).to_radians();
            points.push((cx + r * angle.cos(), cy + r * angle.sin()));
        }
    }
    points
}

/// Sutherland–Hodgman: clips convex `subject` against convex, clockwise `clip`.
fn clip_convex(subject: &[(f32, f32)], clip: &[(f32, f32)]) -> Vec<(f32, f32)> {
    let mut output = subject.to_vec();
    for i in 0..clip.len() {
        if output.is_empty() {
            break;
        }
        let a = clip[i];
        let b = clip[(i + 1) % clip.len()];
        let inside = |p: (f32, f32)| (b.0 - a.0) * (p.1 - a.1) - (b.1 - a.1) * (p.0 - a.0) >= 0.0;
        let intersect = |p: (f32, f32), q: (f32, f32)| {
            let (dx, dy) = (q.0 - p.0, q.1 - p.1);
            let (ex, ey) = (b.0 - a.0, b.1 - a.1);
            let denom = dx * ey - dy * ex;
            if denom.abs() < f32::EPSILON {
                return p;
            }
            let t = ((a.0 - p.0) * ey - (a.1 - p.1) * ex) / denom;
            (p.0 + dx * t, p.1 + dy * t)
        };
        let input = std::mem::take(&mut output);
        for j in 0..input.len() {
            let current = input[j];
            let previous = input[(j + input.len() - 1) % input.len()];
            match (inside(current), inside(previous)) {
                (true, true) => output.push(current),
                (true, false) => {
                    output.push(intersect(previous, current));
                    output.push(current);
                }
                (false, true) => output.push(intersect(previous, current)),
                (false, false) => {}
            }
        }
    }
    output
}

/// `text-neutral-50` under the button's CSS `filter: brightness()`, which dims
/// the label too while pressed.
fn filtered_text(brightness: f32) -> gpui::Hsla {
    crate::surface::brighten(gpui::rgb(0xfafafa), brightness)
}
