//! MorphStatusButton: one button that morphs through idle, loading, success and
//! error in place. Labels roll out and in, icons spring, and the width never
//! changes because the widest label reserves it.

use gpui::{
    App, Bounds, BoxShadow, ClickEvent, Context, Corners, ElementId, FocusHandle, FontWeight, Hsla,
    InteractiveElement, IntoElement, ParentElement, PathBuilder, PathStyle, Pixels, RenderOnce,
    SharedString, StatefulInteractiveElement, StrokeOptions, Styled, Task, Window, canvas, div,
    linear_color_stop, linear_gradient, point, prelude::FluentBuilder, px, quad, transparent_black,
};
use lyon::tessellation::{LineCap, LineJoin};
use std::{future::Future, pin::Pin, rc::Rc};

use crate::icons::{Icon, paint_icon};
use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Duration, Easing, Instant, Transition};
use crate::surface::{
    PressFrame, PressMotion, brighten, ms, paint_focus_ring, rgb_a, scale_bounds,
};

/// The four states a [`MorphStatusButton`] morphs between.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum MorphStatusButtonStatus {
    #[default]
    Idle,
    Loading,
    Success,
    Error,
}

type AsyncClickHandler =
    Rc<dyn Fn(&ClickEvent, &mut Window, &mut App) -> Pin<Box<dyn Future<Output = bool>>>>;

/// A button that morphs through idle, loading, success and error states in place.
///
/// Give it an async action with [`on_click_async`](Self::on_click_async) and it
/// runs the whole state machine itself: loading while the future runs, then
/// success on `Ok` or error on `Err`, then back to idle after `reset_after`.
///
/// ```ignore
/// MorphStatusButton::new("save")
///     .success_label("Saved")
///     .on_click_async(|_, _, cx| {
///         let save = save_changes(cx);
///         async move { save.await }
///     })
/// ```
#[derive(IntoElement)]
pub struct MorphStatusButton {
    id: ElementId,
    label: SharedString,
    loading_label: SharedString,
    success_label: SharedString,
    error_label: SharedString,
    status: Option<MorphStatusButtonStatus>,
    reset_after: Duration,
    disabled: bool,
    on_click: Option<ClickHandler>,
    on_click_async: Option<AsyncClickHandler>,
}

impl MorphStatusButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: "Save changes".into(),
            loading_label: "Working…".into(),
            success_label: "Done".into(),
            error_label: "It broke. Your fault.".into(),
            status: None,
            reset_after: ms(1800),
            disabled: false,
            on_click: None,
            on_click_async: None,
        }
    }

    /// Idle label. Defaults to "Save changes".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Label while the action is in flight. Defaults to "Working…".
    pub fn loading_label(mut self, label: impl Into<SharedString>) -> Self {
        self.loading_label = label.into();
        self
    }

    /// Label after the action succeeds. Defaults to "Done".
    pub fn success_label(mut self, label: impl Into<SharedString>) -> Self {
        self.success_label = label.into();
        self
    }

    /// Label after the action fails. Defaults to "It broke. Your fault.".
    pub fn error_label(mut self, label: impl Into<SharedString>) -> Self {
        self.error_label = label.into();
        self
    }

    /// Controlled status. When set, the button shows this status and the
    /// async auto-transitions are ignored.
    pub fn status(mut self, status: MorphStatusButtonStatus) -> Self {
        self.status = Some(status);
        self
    }

    /// How long to stay in success/error before resetting. `Duration::ZERO` stays. Defaults to 1.8s.
    pub fn reset_after(mut self, reset_after: Duration) -> Self {
        self.reset_after = reset_after;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Plain click handler. Fires on every click that isn't ignored while loading.
    pub fn on_click(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(handler));
        self
    }

    /// Async click handler: the button shows loading until the returned future
    /// resolves, then success (`Ok`) or error (`Err`).
    pub fn on_click_async<F, Fut, T, E>(mut self, handler: F) -> Self
    where
        F: Fn(&ClickEvent, &mut Window, &mut App) -> Fut + 'static,
        Fut: Future<Output = Result<T, E>> + 'static,
    {
        self.on_click_async = Some(Rc::new(move |event, window, cx| {
            let fut = handler(event, window, cx);
            Box::pin(async move { fut.await.is_ok() })
        }));
        self
    }
}

/// A tiny damped spring with readable velocity (motion's `{ type: "spring" }`).
#[derive(Clone, Copy, Debug)]
struct Sim {
    value: f32,
    velocity: f32,
    target: f32,
    stiffness: f32,
    damping: f32,
    last: Instant,
}

impl Sim {
    fn new(value: f32, stiffness: f32, damping: f32) -> Self {
        Self {
            value,
            velocity: 0.0,
            target: value,
            stiffness,
            damping,
            last: Instant::now(),
        }
    }

    fn step(&mut self, now: Instant) -> f32 {
        let mut remaining = now
            .saturating_duration_since(self.last)
            .as_secs_f32()
            .min(0.064);
        self.last = now;
        if self.settled() {
            return self.value;
        }
        while remaining > 0.0 {
            let h = remaining.min(1.0 / 240.0);
            let force = -self.stiffness * (self.value - self.target) - self.damping * self.velocity;
            self.velocity += force * h;
            self.value += self.velocity * h;
            remaining -= h;
        }
        // motion's default rest thresholds for unitless values.
        if (self.value - self.target).abs() < 0.01 && self.velocity.abs() < 0.05 {
            self.value = self.target;
            self.velocity = 0.0;
        }
        self.value
    }

    fn set_target(&mut self, target: f32) {
        self.step(Instant::now());
        self.target = target;
    }

    fn settled(&self) -> bool {
        self.value == self.target && self.velocity == 0.0
    }
}

/// `AnimatePresence mode="wait"` for one slot: the shown item exits fully
/// before the next one enters.
struct LabelSlot {
    shown: MorphStatusButtonStatus,
    /// Visibility 0..1; entering slides up from +8px, exiting continues to -8px.
    vis: Transition,
    exiting: bool,
}

impl LabelSlot {
    fn sync(&mut self, target: MorphStatusButtonStatus, now: Instant) {
        let fade = ms(160);
        if self.shown == target {
            if self.exiting {
                self.exiting = false;
                self.vis.animate_to(1.0, fade, Easing::EASE_IN_OUT);
            }
            return;
        }
        if !self.exiting {
            self.exiting = true;
            self.vis.animate_to(0.0, fade, Easing::EASE_IN_OUT);
        } else if !self.vis.is_animating(now) {
            self.shown = target;
            self.exiting = false;
            self.vis.replay(0.0, 1.0, fade, Easing::EASE_IN_OUT);
        }
    }
}

struct IconSlot {
    shown: Option<MorphStatusButtonStatus>,
    spring: Sim,
    exiting: bool,
}

impl IconSlot {
    fn sync(&mut self, target: MorphStatusButtonStatus, now: Instant) {
        if target == MorphStatusButtonStatus::Idle {
            // The icon wrapper unmounts outright.
            self.shown = None;
            self.exiting = false;
            return;
        }
        let Some(shown) = self.shown else {
            // A freshly mounted wrapper skips its entrance (`initial={false}`).
            self.shown = Some(target);
            self.spring = Sim::new(1.0, 380.0, 22.0);
            return;
        };
        if shown == target {
            if self.exiting {
                self.exiting = false;
                self.spring.set_target(1.0);
            }
            return;
        }
        if !self.exiting {
            self.exiting = true;
            self.spring.set_target(0.0);
        } else if self.spring.settled() {
            self.shown = Some(target);
            self.exiting = false;
            self.spring.set_target(1.0);
        }
        self.spring.step(now);
    }
}

struct MorphState {
    motion: PressMotion,
    internal: MorphStatusButtonStatus,
    label: LabelSlot,
    icon: IconSlot,
    /// 0 = normal, 1 = error tint (300ms springy, like the CSS transition).
    error: Transition,
    /// 0 = normal text, 1 = dimmed loading text.
    dim: Transition,
    task: Option<Task<()>>,
    focus: FocusHandle,
}

impl MorphState {
    fn settle(&mut self, ok: bool, reset_after: Duration, cx: &mut Context<Self>) {
        self.internal = if ok {
            MorphStatusButtonStatus::Success
        } else {
            MorphStatusButtonStatus::Error
        };
        self.task = (!reset_after.is_zero()).then(|| {
            cx.spawn(async move |this, cx| {
                cx.background_executor().timer(reset_after).await;
                this.update(cx, |s, cx| {
                    s.internal = MorphStatusButtonStatus::Idle;
                    cx.notify();
                })
                .ok();
            })
        });
        cx.notify();
    }
}

impl Pressable for MorphState {
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

fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

fn mix(a: Hsla, b: Hsla, t: f32) -> Hsla {
    let (a, b) = (gpui::Rgba::from(a), gpui::Rgba::from(b));
    gpui::Rgba {
        r: lerp(a.r, b.r, t),
        g: lerp(a.g, b.g, t),
        b: lerp(a.b, b.b, t),
        a: lerp(a.a, b.a, t),
    }
    .into()
}

/// A CSS box-shadow. GPUI's blur radius is the gaussian sigma, half of CSS's.
fn shadow(x: f32, y: f32, blur: f32, spread: f32, color: Hsla, inset: bool) -> BoxShadow {
    BoxShadow {
        color,
        offset: point(px(x), px(y)),
        blur_radius: px(blur / 2.0),
        spread_radius: px(spread),
        inset,
    }
}

/// The graded MinimalButton surface, with the error state's red inner ring and
/// red-tinted drop blended in by `error`.
fn paint_surface(
    bounds: Bounds<Pixels>,
    frame: PressFrame,
    error: f32,
    radius: Pixels,
    window: &mut Window,
) {
    let bounds = scale_bounds(bounds, frame.scale);
    let radii = Corners::all(radius * frame.scale);
    let s = frame.settle;
    let e = error * (1.0 - s);
    let black = |a: f32| rgb_a(0x000000, a);
    let white = |a: f32| rgb_a(0xffffff, a);

    window.paint_drop_shadows(
        bounds,
        radii,
        &[
            shadow(
                0.0,
                lerp(4.0, 1.0, s),
                lerp(12.0, 3.0, s),
                lerp(-4.0, -2.0, s),
                mix(black(lerp(0.4, 0.3, s)), rgb_a(0xb91c1c, 0.45), e),
                false,
            ),
            shadow(
                0.0,
                lerp(1.0, 0.0, s),
                lerp(2.0, 1.0, s),
                0.0,
                black(lerp(0.25, 0.2, s)),
                false,
            ),
            shadow(0.0, 0.0, 0.0, 1.0, black(0.9), false),
        ],
    );

    let b = frame.brightness;
    window.paint_quad(quad(
        bounds,
        radii,
        linear_gradient(
            180.0,
            linear_color_stop(brighten(gpui::rgb(0x353535), b), 0.0),
            linear_color_stop(brighten(gpui::rgb(0x272727), b), 1.0),
        ),
        px(0.0),
        transparent_black(),
        Default::default(),
    ));

    window.paint_inset_shadows(
        bounds,
        radii,
        &[
            shadow(
                0.0,
                0.0,
                0.0,
                1.0,
                mix(white(lerp(0.06, 0.05, s)), rgb_a(0xf87171, 0.35), e),
                true,
            ),
            shadow(
                0.0,
                1.0,
                0.0,
                0.0,
                white(lerp(lerp(0.14, 0.1, e), 0.08, s)),
                true,
            ),
        ],
    );
}

/// Lucide's loader arc (`M21 12a9 9 0 1 1-6.219-8.56`), spun by `turn` (0..1).
fn paint_spinner(bounds: Bounds<Pixels>, turn: f32, color: Hsla, window: &mut Window) {
    let unit = bounds.size.width.min(bounds.size.height).as_f32() / 24.0;
    let center = bounds.center();
    let start = turn * std::f32::consts::TAU;
    // From 0° clockwise for 288° (the arc stops 72° short of a full turn).
    let sweep = 288.0_f32.to_radians();
    let width = 2.5 * unit;
    let options = StrokeOptions::default()
        .with_line_width(width)
        .with_line_cap(LineCap::Round)
        .with_line_join(LineJoin::Round);
    let mut b = PathBuilder::stroke(px(width)).with_style(PathStyle::Stroke(options));
    let steps = 48;
    for i in 0..=steps {
        let a = start + sweep * i as f32 / steps as f32;
        let p = point(
            center.x + px(a.cos() * 9.0 * unit),
            center.y + px(a.sin() * 9.0 * unit),
        );
        if i == 0 {
            b.move_to(p);
        } else {
            b.line_to(p);
        }
    }
    if let Ok(path) = b.build() {
        window.paint_path(path, color);
    }
}

/// Lucide's `x` icon on a 24 grid.
fn paint_x(bounds: Bounds<Pixels>, scale: f32, color: Hsla, window: &mut Window) {
    let unit = bounds.size.width.min(bounds.size.height).as_f32() / 24.0 * scale;
    let c = bounds.center();
    let p = |x: f32, y: f32| point(c.x + px((x - 12.0) * unit), c.y + px((y - 12.0) * unit));
    let width = 2.5 * unit;
    let options = StrokeOptions::default()
        .with_line_width(width)
        .with_line_cap(LineCap::Round)
        .with_line_join(LineJoin::Round);
    let mut b = PathBuilder::stroke(px(width)).with_style(PathStyle::Stroke(options));
    b.move_to(p(18.0, 6.0));
    b.line_to(p(6.0, 18.0));
    b.move_to(p(6.0, 6.0));
    b.line_to(p(18.0, 18.0));
    if let Ok(path) = b.build() {
        window.paint_path(path, color);
    }
}

impl RenderOnce for MorphStatusButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<MorphState>| {
                MorphState {
                    motion: PressMotion::new(),
                    internal: MorphStatusButtonStatus::Idle,
                    label: LabelSlot {
                        shown: MorphStatusButtonStatus::Idle,
                        vis: Transition::new(1.0),
                        exiting: false,
                    },
                    icon: IconSlot {
                        shown: None,
                        spring: Sim::new(1.0, 380.0, 22.0),
                        exiting: false,
                    },
                    error: Transition::new(0.0),
                    dim: Transition::new(0.0),
                    task: None,
                    focus: cx.focus_handle().tab_stop(true),
                }
            });

        let now = Instant::now();
        let controlled = self.status;
        let (
            status,
            frame,
            label_shown,
            label_vis,
            label_exiting,
            icon_shown,
            icon_p,
            error,
            dim,
            animating,
        ) = state.update(cx, |s, _| {
            let status = controlled.unwrap_or(s.internal);
            s.label.sync(status, now);
            s.icon.sync(status, now);
            let icon_p = s.icon.spring.step(now);
            let slow = ms(300);
            s.error.animate_to(
                if status == MorphStatusButtonStatus::Error {
                    1.0
                } else {
                    0.0
                },
                slow,
                Easing::SPRINGY,
            );
            s.dim.animate_to(
                if status == MorphStatusButtonStatus::Loading {
                    1.0
                } else {
                    0.0
                },
                slow,
                Easing::SPRINGY,
            );
            // While loading the button is disabled: no hover glow, no press.
            if status == MorphStatusButtonStatus::Loading {
                s.motion.set_hovered(false);
                s.motion.release();
            }
            let frame = s.motion.frame(now);
            let animating = frame.animating
                || s.label.vis.is_animating(now)
                || s.label.shown != status
                || s.icon.exiting
                || !s.icon.spring.settled()
                || s.error.is_animating(now)
                || s.dim.is_animating(now)
                || status == MorphStatusButtonStatus::Loading
                || s.icon.shown == Some(MorphStatusButtonStatus::Loading);
            (
                status,
                frame,
                s.label.shown,
                s.label.vis.value(now),
                s.label.exiting,
                s.icon.shown,
                icon_p,
                s.error.value(now).clamp(0.0, 1.0),
                s.dim.value(now).clamp(0.0, 1.0),
                animating,
            )
        });
        let (focus, focus_visible) = {
            let s = state.read(cx);
            (
                s.focus.clone(),
                (s.motion.focus_visible || window.last_input_was_keyboard())
                    && s.focus.is_focused(window),
            )
        };
        if animating {
            window.request_animation_frame();
        }

        let loading = status == MorphStatusButtonStatus::Loading;
        let label_for = |status: MorphStatusButtonStatus| match status {
            MorphStatusButtonStatus::Idle => self.label.clone(),
            MorphStatusButtonStatus::Loading => self.loading_label.clone(),
            MorphStatusButtonStatus::Success => self.success_label.clone(),
            MorphStatusButtonStatus::Error => self.error_label.clone(),
        };
        let widest = [
            &self.label,
            &self.loading_label,
            &self.success_label,
            &self.error_label,
        ]
        .into_iter()
        .fold(SharedString::default(), |widest, candidate| {
            if candidate.chars().count() > widest.chars().count() {
                candidate.clone()
            } else {
                widest
            }
        });

        // text-neutral-50, dimmed to /70 while loading, red-300 on error.
        let base = mix(rgb_a(0xfafafa, 1.0), rgb_a(0xfafafa, 0.7), dim);
        let base = mix(base, rgb_a(0xfca5a5, 1.0), error);
        let text = brighten(base, frame.brightness.max(1.0));

        let radius = px(10.0);
        let k = frame.scale;
        let spin = (now.duration_since(START.with(|s| *s)).as_secs_f32()) % 1.0;
        let icon_scale = 0.4 + 0.6 * icon_p;
        let icon_alpha = icon_p.clamp(0.0, 1.0);
        let label_y = if !label_exiting {
            8.0 * (1.0 - label_vis)
        } else {
            -8.0 * (1.0 - label_vis)
        };

        let button = div()
            .id(self.id.clone())
            .relative()
            .flex()
            .flex_none()
            .h(px(36.0))
            .px(px(16.0))
            .items_center()
            .justify_center()
            .text_size(px(14.0))
            .line_height(px(20.0))
            .font_weight(FontWeight::MEDIUM)
            .text_color(text)
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .when(loading && !self.disabled, |el| el.cursor_not_allowed())
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
                        paint_surface(bounds, frame, error, radius, window);
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            // The widest label, invisible, reserves a stable width.
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap(px(8.0))
                    .opacity(0.0)
                    .whitespace_nowrap()
                    .child(div().size(px(16.0)).flex_none())
                    .child(widest),
            )
            // Content, press-scaled with the surface (CSS `scale()` scales it too).
            .child(
                div()
                    .absolute()
                    .top_0()
                    .left_0()
                    .size_full()
                    .overflow_hidden()
                    .rounded(radius)
                    .flex()
                    .items_center()
                    .justify_center()
                    .gap(px(8.0 * k))
                    .text_size(px(14.0 * k))
                    .line_height(px(20.0 * k))
                    .when_some(icon_shown, |el, icon| {
                        el.child(
                            canvas(
                                |_, _, _| {},
                                move |bounds, _, window, _| {
                                    let color = text.opacity(icon_alpha);
                                    match icon {
                                        MorphStatusButtonStatus::Loading => {
                                            let b = scale_bounds(bounds, icon_scale.max(0.0));
                                            paint_spinner(b, spin, color, window);
                                        }
                                        MorphStatusButtonStatus::Success => paint_icon(
                                            Icon::Check,
                                            bounds,
                                            2.5,
                                            icon_scale,
                                            color,
                                            window,
                                        ),
                                        MorphStatusButtonStatus::Error => {
                                            paint_x(bounds, icon_scale, color, window)
                                        }
                                        MorphStatusButtonStatus::Idle => {}
                                    }
                                },
                            )
                            .size(px(16.0 * k))
                            .flex_none(),
                        )
                    })
                    .child(
                        div()
                            .relative()
                            .top(px(label_y * k))
                            .opacity(label_vis.clamp(0.0, 1.0))
                            .whitespace_nowrap()
                            .child(label_for(label_shown)),
                    ),
            );

        let inert = self.disabled || loading;
        let button = wire(button, &state, &focus, inert);
        if inert {
            return button;
        }
        let on_click = self.on_click.clone();
        let on_click_async = self.on_click_async.clone();
        let reset_after = self.reset_after;
        let click_state = state.clone();
        button.on_click(move |event, window, cx| {
            if let Some(handler) = on_click.as_ref() {
                handler(event, window, cx);
            }
            let Some(handler) = on_click_async.as_ref() else {
                return;
            };
            let fut = handler(event, window, cx);
            if controlled.is_some() {
                // Controlled: the caller owns the status; still run the action.
                cx.foreground_executor().spawn(fut).detach();
                return;
            }
            click_state.update(cx, |s, cx| {
                s.internal = MorphStatusButtonStatus::Loading;
                s.task = Some(cx.spawn(async move |this, cx| {
                    let ok = fut.await;
                    this.update(cx, |s, cx| s.settle(ok, reset_after, cx)).ok();
                }));
                cx.notify();
            });
        })
    }
}

thread_local! {
    /// Shared clock origin so every spinner turns in phase.
    static START: Instant = Instant::now();
}
