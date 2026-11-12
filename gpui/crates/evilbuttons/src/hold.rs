//! HoldButton: press and hold to confirm. A light fill wipes across with a
//! knocked-out label; let go early and it shakes and drains.

use gpui::{
    App, AppContext, Bounds, Context, ElementId, FocusHandle, FontWeight, InteractiveElement,
    IntoElement, KeyDownEvent, KeyUpEvent, MouseButton, ParentElement, Pixels, RenderOnce,
    SharedString, StatefulInteractiveElement, Styled, Task, Window, canvas, div, linear_color_stop,
    linear_gradient, prelude::FluentBuilder, px,
};
use std::{cell::Cell, rc::Rc};

use crate::icons::{Icon, paint_icon};
use crate::interaction::is_activation_key;
use crate::motion::{Duration, Easing, Instant, Timeline, Transition, keyframes};
use crate::surface::{
    PressMotion, ms, paint_focus_ring, paint_graded_surface, rgb_a, scaled_content, surface_text,
};

type ConfirmHandler = Rc<dyn Fn(&mut Window, &mut App)>;
type AbortHandler = Rc<dyn Fn(f32, &mut Window, &mut App)>;

/// Press and hold to confirm a destructive action.
///
/// ```ignore
/// HoldButton::new("delete")
///     .duration(Duration::from_millis(1500))
///     .on_confirm(|_, _| delete_account())
///     .on_abort(|progress, _, _| println!("aborted at {progress}"))
/// ```
#[derive(IntoElement)]
pub struct HoldButton {
    id: ElementId,
    duration: Duration,
    label: SharedString,
    holding_label: SharedString,
    success_label: SharedString,
    reset_after: Duration,
    disabled: bool,
    on_confirm: Option<ConfirmHandler>,
    on_abort: Option<AbortHandler>,
}

impl HoldButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            duration: ms(1500),
            label: "Hold to delete".into(),
            holding_label: "Keep holding…".into(),
            success_label: "Deleted".into(),
            reset_after: ms(1400),
            disabled: false,
            on_confirm: None,
            on_abort: None,
        }
    }

    /// How long the user must hold. Defaults to 1.5s.
    pub fn duration(mut self, duration: Duration) -> Self {
        self.duration = duration;
        self
    }

    /// Label while idle. Defaults to "Hold to delete".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Label while held. Defaults to "Keep holding…".
    pub fn holding_label(mut self, label: impl Into<SharedString>) -> Self {
        self.holding_label = label.into();
        self
    }

    /// Label once confirmed. Defaults to "Deleted".
    pub fn success_label(mut self, label: impl Into<SharedString>) -> Self {
        self.success_label = label.into();
        self
    }

    /// How long to stay in the success state before resetting. `Duration::ZERO` stays. Defaults to 1.4s.
    pub fn reset_after(mut self, reset_after: Duration) -> Self {
        self.reset_after = reset_after;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired once the fill reaches 100%.
    pub fn on_confirm(mut self, handler: impl Fn(&mut Window, &mut App) + 'static) -> Self {
        self.on_confirm = Some(Rc::new(handler));
        self
    }

    /// Fired when released early, with the progress (0–1) reached.
    pub fn on_abort(mut self, handler: impl Fn(f32, &mut Window, &mut App) + 'static) -> Self {
        self.on_abort = Some(Rc::new(handler));
        self
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Phase {
    Idle,
    Holding,
    Success,
}

struct HoldState {
    phase: Phase,
    motion: PressMotion,
    hold: Option<Timeline>,
    /// Fill (0–1) while not holding: drains after an abort or a reset.
    fill: Transition,
    shake: Option<Timeline>,
    task: Option<Task<()>>,
    size: Rc<Cell<Option<Bounds<Pixels>>>>,
    focus: FocusHandle,
    // Latest props, refreshed every render so timers see current values.
    duration: Duration,
    reset_after: Duration,
    on_confirm: Option<ConfirmHandler>,
    on_abort: Option<AbortHandler>,
}

impl HoldState {
    fn progress(&self, now: Instant) -> f32 {
        match (self.phase, self.hold) {
            (Phase::Holding, Some(hold)) => hold.progress(now),
            (Phase::Success, _) => 1.0,
            _ => self.fill.value(now).clamp(0.0, 1.0),
        }
    }

    fn start(&mut self, window: &Window, cx: &mut Context<Self>) {
        if self.phase != Phase::Idle {
            return;
        }
        self.phase = Phase::Holding;
        self.hold = Some(Timeline::start(self.duration));
        self.fill.snap(0.0);
        self.motion.press();
        let duration = self.duration;
        let handle = window.window_handle();
        self.task = Some(cx.spawn(async move |this, cx| {
            cx.background_executor().timer(duration).await;
            let Ok(confirm) = this.update(cx, |s, cx| s.complete(cx)) else {
                return;
            };
            if let Some(confirm) = confirm {
                cx.update_window(handle, |_, window, cx| confirm(window, cx))
                    .ok();
            }
        }));
    }

    fn complete(&mut self, cx: &mut Context<Self>) -> Option<ConfirmHandler> {
        if self.phase != Phase::Holding {
            return None;
        }
        self.phase = Phase::Success;
        self.hold = None;
        self.fill.snap(1.0);
        self.motion.release();
        cx.notify();
        let reset_after = self.reset_after;
        self.task = (!reset_after.is_zero()).then(|| {
            cx.spawn(async move |this, cx| {
                cx.background_executor().timer(reset_after).await;
                this.update(cx, |s, cx| {
                    s.phase = Phase::Idle;
                    s.fill.replay(1.0, 0.0, ms(260), Easing::EASE_OUT);
                    cx.notify();
                })
                .ok();
            })
        });
        self.on_confirm.clone()
    }

    /// Releases a hold early. Returns the abort handler and the progress reached.
    fn cancel(&mut self) -> Option<(f32, Option<AbortHandler>)> {
        self.motion.release();
        if self.phase != Phase::Holding {
            return None;
        }
        let reached = self.progress(Instant::now());
        self.phase = Phase::Idle;
        self.hold = None;
        self.task = None;
        self.fill.replay(reached, 0.0, ms(260), Easing::EASE_OUT);
        self.shake = Some(Timeline::start(ms(300)));
        Some((reached, self.on_abort.clone()))
    }
}

fn cancel_hold(state: &gpui::Entity<HoldState>, window: &mut Window, cx: &mut App) {
    let aborted = state.update(cx, |s, cx| {
        cx.notify();
        s.cancel()
    });
    if let Some((reached, Some(on_abort))) = aborted {
        on_abort(reached, window, cx);
    }
}

impl RenderOnce for HoldButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<HoldState>| {
                HoldState {
                    phase: Phase::Idle,
                    motion: PressMotion::new(),
                    hold: None,
                    fill: Transition::new(0.0),
                    shake: None,
                    task: None,
                    size: Rc::new(Cell::new(None)),
                    focus: cx.focus_handle().tab_stop(true),
                    duration: ms(1500),
                    reset_after: ms(1400),
                    on_confirm: None,
                    on_abort: None,
                }
            });
        state.update(cx, |s, _| {
            s.duration = self.duration;
            s.reset_after = self.reset_after;
            s.on_confirm = self.on_confirm.clone();
            s.on_abort = self.on_abort.clone();
        });

        let now = Instant::now();
        let s = state.read(cx);
        let phase = s.phase;
        let frame = s.motion.frame(now);
        let progress = s.progress(now);
        let shake = s.shake.filter(|t| !t.is_done(now)).map(|t| {
            let p = Easing::EASE_IN_OUT.apply(t.progress(now));
            keyframes(
                p,
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
        let focus = s.focus.clone();
        let focus_visible = (s.motion.focus_visible || window.last_input_was_keyboard())
            && s.focus.is_focused(window);
        let size_cell = s.size.clone();
        let measured = s.size.get();
        let animating = frame.animating
            || phase == Phase::Holding
            || s.fill.is_animating(now)
            || shake.is_some();
        if animating {
            window.request_animation_frame();
        }

        let label = match phase {
            Phase::Idle => self.label.clone(),
            Phase::Holding => self.holding_label.clone(),
            Phase::Success => self.success_label.clone(),
        };
        let success = phase == Phase::Success;
        let content = move |color: gpui::Hsla, s: f32| {
            div()
                .flex()
                .items_center()
                .gap(px(6.0 * s))
                .text_size(px(14.0 * s))
                .line_height(px(20.0 * s))
                .text_color(color)
                .when(success, |el| {
                    el.child(
                        canvas(
                            |_, _, _| {},
                            move |bounds, _, window, _| {
                                paint_icon(Icon::Check, bounds, 2.25, 1.0, color, window);
                            },
                        )
                        .size(px(14.0 * s))
                        .flex_none(),
                    )
                })
                .child(label.clone())
        };

        let radius = px(10.0);
        let mut button = div()
            .id(self.id.clone())
            .relative()
            .flex()
            .flex_none()
            .h(px(36.0))
            .min_w(px(176.0))
            .px(px(16.0))
            .items_center()
            .justify_center()
            .font_weight(FontWeight::MEDIUM)
            .text_color(surface_text(frame.brightness))
            .when_some(shake, |el, dx| el.left(px(dx)))
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    move |bounds, _, _| size_cell.set(Some(bounds)),
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
            .child(scaled_content(frame.scale, {
                let content = content.clone();
                let color = surface_text(frame.brightness);
                move |s| content(color, s).into_any_element()
            }));

        // Fill + knocked-out label, positioned on the (press-scaled) surface.
        if progress > 0.0
            && let Some(bounds) = measured
        {
            let (w, h) = (bounds.size.width, bounds.size.height);
            let (sw, sh) = (w * frame.scale, h * frame.scale);
            let (ix, iy) = ((w - sw) * 0.5, (h - sh) * 0.5);
            let fill_w = sw * progress;
            let r = radius * frame.scale;
            let right_r = (r - (sw - fill_w)).max(px(0.0));
            button = button.child(
                div()
                    .absolute()
                    .left(ix)
                    .top(iy)
                    .w(fill_w)
                    .h(sh)
                    .overflow_hidden()
                    .rounded_tl(r)
                    .rounded_bl(r)
                    .rounded_tr(right_r)
                    .rounded_br(right_r)
                    .bg(linear_gradient(
                        180.0,
                        linear_color_stop(gpui::rgb(0xfafafa), 0.0),
                        linear_color_stop(gpui::rgb(0xe5e5e5), 1.0),
                    ))
                    .child(
                        div()
                            .absolute()
                            .left(-ix)
                            .top(-iy)
                            .w(w)
                            .h(h)
                            .flex()
                            .items_center()
                            .justify_center()
                            .child(content(rgb_a(0x171717, 1.0), frame.scale)),
                    ),
            );
        }

        if self.disabled {
            return button;
        }

        let hover = state.clone();
        let down = state.clone();
        let up = state.clone();
        let up_out = state.clone();
        let key_down = state.clone();
        let key_up = state.clone();
        let focus_for_down = focus.clone();
        button
            .track_focus(&focus)
            .cursor_pointer()
            .on_hover(move |hovered, _, cx| {
                hover.update(cx, |s, cx| {
                    if s.motion.set_hovered(*hovered) {
                        cx.notify();
                    }
                });
            })
            .on_mouse_down(MouseButton::Left, move |_, window, cx| {
                window.focus(&focus_for_down, cx);
                down.update(cx, |s, cx| {
                    s.motion.focus_visible = false;
                    s.start(window, cx);
                    cx.notify();
                });
            })
            .on_mouse_up(MouseButton::Left, move |_, window, cx| {
                cancel_hold(&up, window, cx)
            })
            .on_mouse_up_out(MouseButton::Left, move |_, window, cx| {
                cancel_hold(&up_out, window, cx)
            })
            .on_key_down(move |event: &KeyDownEvent, window, cx| {
                if event.is_held || !is_activation_key(event.keystroke.key.as_str()) {
                    return;
                }
                cx.stop_propagation();
                key_down.update(cx, |s, cx| {
                    s.motion.focus_visible = true;
                    s.start(window, cx);
                    cx.notify();
                });
            })
            .on_key_up(move |event: &KeyUpEvent, window, cx| {
                if is_activation_key(event.keystroke.key.as_str()) {
                    cancel_hold(&key_up, window, cx);
                }
            })
    }
}
