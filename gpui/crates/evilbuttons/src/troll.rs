//! TrollButton: dodges the cursor until it runs out of stamina, then gives up
//! and lets you click it.

use gpui::{
    App, Bounds, ClickEvent, ContentMask, Context, Corners, DispatchPhase, ElementId, Entity,
    FocusHandle, FontWeight, InteractiveElement, IntoElement, MouseMoveEvent, ParentElement,
    PathBuilder, Pixels, Point, RenderOnce, SharedString, StatefulInteractiveElement, Styled, Task,
    Window, canvas, div, linear_color_stop, linear_gradient, point, prelude::FluentBuilder, px,
    quad, size, transparent_black,
};
use std::{cell::Cell, rc::Rc};

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Duration, Easing, Instant, Spring, SpringConfig, Timeline, keyframes};
use crate::surface::{
    PressFrame, PressMotion, brighten, ms, paint_focus_ring, paint_graded_surface, rgb_a,
    scaled_content,
};

/// `{ stiffness: 520, damping: 30, mass: 0.6 }`.
const DODGE: SpringConfig = SpringConfig {
    stiffness: 520.0,
    damping: 30.0,
    mass: 0.6,
};
/// Label swap spring, `{ stiffness: 420, damping: 30 }`.
const SWAP: SpringConfig = SpringConfig::new(420.0, 30.0);

/// A button that dodges the cursor until it gets tired, then gives up.
///
/// ```ignore
/// TrollButton::new("catch-me")
///     .label("Click If You Can")
///     .give_up_after(Duration::from_millis(3000))
///     .on_click(|_, _, _| println!("Caught it"))
/// ```
#[derive(IntoElement)]
pub struct TrollButton {
    id: ElementId,
    label: SharedString,
    surrender_label: SharedString,
    give_up_after: Duration,
    flee_radius: f32,
    range: f32,
    reset_after: Duration,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl TrollButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: "Click Me".into(),
            surrender_label: "Fine, click me".into(),
            give_up_after: ms(3500),
            flee_radius: 56.0,
            range: 140.0,
            reset_after: ms(1500),
            disabled: false,
            on_click: None,
        }
    }

    /// Label while it is fleeing. Defaults to "Click Me".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Label once it gives up. Defaults to "Fine, click me".
    pub fn surrender_label(mut self, label: impl Into<SharedString>) -> Self {
        self.surrender_label = label.into();
        self
    }

    /// How long it runs before giving up; the clock starts on the first dodge. Defaults to 3.5s.
    pub fn give_up_after(mut self, duration: Duration) -> Self {
        self.give_up_after = duration;
        self
    }

    /// How close in px the cursor may get to its edge before it dodges. Defaults to `56`.
    pub fn flee_radius(mut self, radius: f32) -> Self {
        self.flee_radius = radius;
        self
    }

    /// Maximum distance in px it strays from its resting spot. Defaults to `140`.
    pub fn range(mut self, range: f32) -> Self {
        self.range = range;
        self
    }

    /// How long after a successful click before it starts fleeing again.
    /// `Duration::ZERO` keeps it caught. Defaults to 1.5s.
    pub fn reset_after(mut self, duration: Duration) -> Self {
        self.reset_after = duration;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Only fires once the button has given up (keyboard clicks always go through).
    pub fn on_click(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(handler));
        self
    }
}

struct TrollState {
    motion: PressMotion,
    tired: bool,
    /// Where the button is headed, relative to its resting slot.
    target: (f32, f32),
    x: Spring,
    y: Spring,
    /// For the velocity-driven lean.
    last_x: (f32, Instant),
    lean: f32,
    /// Stamina drains linearly from the first dodge.
    stamina: Option<Timeline>,
    squash: Option<Timeline>,
    /// Label visibilities: fleeing, surrendered.
    labels: [Spring; 2],
    task: Option<Task<()>>,
    focus: FocusHandle,
    give_up_after: Duration,
    flee_radius: f32,
    range: f32,
}

impl TrollState {
    fn move_to(&mut self, x: f32, y: f32) {
        self.target = (x, y);
        self.x.set_target(x);
        self.y.set_target(y);
    }

    fn evasive(&self) -> bool {
        !self.tired
    }

    /// Dodges away from `pointer` if it is within the flee radius (or `force`).
    fn dodge(&mut self, pointer: Point<Pixels>, rest: Bounds<Pixels>, force: bool) -> bool {
        let (w, h) = (rest.size.width.as_f32(), rest.size.height.as_f32());
        let (offset_x, offset_y) = self.target;
        let center_x = rest.origin.x.as_f32() + w / 2.0 + offset_x;
        let center_y = rest.origin.y.as_f32() + h / 2.0 + offset_y;
        let dx = center_x - pointer.x.as_f32();
        let dy = center_y - pointer.y.as_f32();
        let outside_x = (dx.abs() - w / 2.0).max(0.0);
        let outside_y = (dy.abs() - h / 2.0).max(0.0);
        let gap = outside_x.hypot(outside_y);
        if !force && gap >= self.flee_radius {
            return false;
        }
        // `Math.hypot(dx, dy) || 1`.
        let length = match dx.hypot(dy) {
            0.0 => 1.0,
            l => l,
        };
        let push = self.flee_radius - gap + 24.0;
        let mut next_x = offset_x + dx / length * push;
        let mut next_y = offset_y + dy / length * push;
        let range_y = self.range * 0.6;
        // Cornered: slip past the cursor to the opposite side of the slot.
        if next_x.abs() > self.range || next_y.abs() > range_y {
            let side = [offset_x, dx, 1.0]
                .into_iter()
                .find(|v| *v != 0.0)
                .unwrap_or(1.0)
                .signum();
            next_x = -side * self.range * 0.7;
            next_y = -offset_y * 0.5;
        }
        self.move_to(next_x, next_y);
        if self.stamina.is_none() {
            self.stamina = Some(Timeline::start(self.give_up_after));
        }
        true
    }

    fn give_up(&mut self) {
        self.move_to(0.0, 0.0);
        self.tired = true;
        self.squash = Some(Timeline::start(ms(450)));
        self.labels[0].set_target(0.0);
        self.labels[1].set_target(1.0);
    }

    fn reset(&mut self) {
        self.tired = false;
        self.stamina = None;
        self.labels[0].set_target(1.0);
        self.labels[1].set_target(0.0);
    }
}

impl Pressable for TrollState {
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

impl RenderOnce for TrollButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<TrollState>| {
                TrollState {
                    motion: PressMotion::new(),
                    tired: false,
                    target: (0.0, 0.0),
                    x: Spring::new(0.0, DODGE),
                    y: Spring::new(0.0, DODGE),
                    last_x: (0.0, Instant::now()),
                    lean: 0.0,
                    stamina: None,
                    squash: None,
                    labels: [Spring::new(1.0, SWAP), Spring::new(0.0, SWAP)],
                    task: None,
                    focus: cx.focus_handle().tab_stop(true),
                    give_up_after: ms(3500),
                    flee_radius: 56.0,
                    range: 140.0,
                }
            });
        let (give_up_after, flee_radius, range) =
            (self.give_up_after, self.flee_radius, self.range);
        let now = Instant::now();
        let snap = state.update(cx, |s, _| {
            s.give_up_after = give_up_after;
            s.flee_radius = flee_radius;
            s.range = range;
            if !s.tired && s.stamina.is_some_and(|t| t.is_done(now)) {
                s.give_up();
            }
            let x = s.x.value(now);
            let y = s.y.value(now);
            // useTransform(velocityX, [-2400, 0, 2400], [-10, 0, 10]), clamped.
            let (last, at) = s.last_x;
            let dt = now.saturating_duration_since(at).as_secs_f32();
            if dt > 0.004 {
                let velocity = (x - last) / dt;
                s.lean = (velocity / 2400.0 * 10.0).clamp(-10.0, 10.0);
                s.last_x = (x, now);
            }
            if s.x.is_settled() {
                s.lean = 0.0;
            }
            let squash = s
                .squash
                .filter(|t| !t.is_done(now))
                .map(|t| t.progress(now));
            let labels = [s.labels[0].value(now), s.labels[1].value(now)];
            let stamina = s.stamina.map(|t| 1.0 - t.progress(now));
            let frame = s.motion.frame(now);
            let animating = frame.animating
                || !s.x.is_settled()
                || !s.y.is_settled()
                || squash.is_some()
                || !s.labels[0].is_settled()
                || !s.labels[1].is_settled()
                || (!s.tired && s.stamina.is_some());
            (
                frame, x, y, s.lean, squash, labels, stamina, s.tired, animating,
            )
        });
        let (frame, x, y, lean, squash, labels, stamina, tired, animating) = snap;
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

        // scaleY [1, .92, 1.03, 1], scaleX [1, 1.05, .98, 1] over 450ms, ease-out.
        let (sx, sy) = squash.map_or((1.0, 1.0), |p| {
            let p = Easing::EASE_OUT.apply(p);
            (
                keyframes(
                    p,
                    &[(0.0, 1.0), (1.0 / 3.0, 1.05), (2.0 / 3.0, 0.98), (1.0, 1.0)],
                ),
                keyframes(
                    p,
                    &[(0.0, 1.0), (1.0 / 3.0, 0.92), (2.0 / 3.0, 1.03), (1.0, 1.0)],
                ),
            )
        });
        let stamina_bar = stamina.filter(|v| !tired && *v < 1.0).map(|v| v.max(0.0));

        let radius = px(10.0);
        // `filter: brightness()` dims the label too while pressed.
        let text = brighten(gpui::rgb(0xfafafa), frame.brightness);
        let rest_cell: Rc<Cell<Option<Bounds<Pixels>>>> = Rc::new(Cell::new(None));
        let evasive = !tired && !self.disabled;

        let button = div()
            .id(self.id.clone())
            .relative()
            .left(px(x))
            .top(px(y))
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
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| {
                        let face = squash_bounds(bounds, sx, sy);
                        if focus_visible {
                            paint_focus_ring(
                                face,
                                radius,
                                rgb_a(0xa1a1a1, 1.0),
                                rgb_a(0x0a0a0a, 1.0),
                                window,
                            );
                        }
                        if lean.abs() > 0.25 {
                            paint_leaning_surface(face, frame, radius, lean, window);
                        } else {
                            paint_graded_surface(face, frame, radius, window);
                        }
                        if let Some(stamina) = stamina_bar {
                            let face = crate::surface::scale_bounds(face, frame.scale);
                            let bar = Bounds::new(
                                point(face.origin.x, face.bottom() - px(2.0)),
                                size(face.size.width * stamina, px(2.0)),
                            );
                            window.with_content_mask(Some(ContentMask { bounds: bar }), |w| {
                                w.paint_quad(quad(
                                    face,
                                    Corners::all(radius * frame.scale),
                                    rgb_a(0xfafafa, 0.35),
                                    px(0.0),
                                    transparent_black(),
                                    Default::default(),
                                ));
                            });
                        }
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            // Both labels stack in one cell, so the wider one sets the width.
            .child({
                let (idle, surrender) = (self.label.clone(), self.surrender_label.clone());
                // CSS scales the content with the press and the give-up squash.
                let content_scale = frame.scale * (sx * sy).sqrt();
                scaled_content(content_scale, move |s| {
                    let label = |text: SharedString, visible: f32, leaving: bool| {
                        let y = if leaving { -8.0 } else { 8.0 } * (1.0 - visible) * s;
                        div()
                            .h(px(0.0))
                            .relative()
                            .top(px(y))
                            .opacity(visible.clamp(0.0, 1.0))
                            .flex()
                            .justify_center()
                            .whitespace_nowrap()
                            .child(text)
                    };
                    div()
                        .relative()
                        .h(px(20.0 * s))
                        .text_size(px(14.0 * s))
                        .line_height(px(20.0 * s))
                        .flex()
                        .flex_col()
                        .child(label(idle.clone(), labels[0], tired))
                        .child(label(surrender.clone(), labels[1], !tired))
                        .into_any_element()
                })
            });

        let button = wire(button, &state, &focus, self.disabled);
        let button = if self.disabled {
            button
        } else {
            let on_click = self.on_click.clone();
            let click_state = state.clone();
            let rest_for_click = rest_cell.clone();
            let reset_after = self.reset_after;
            button.on_click(move |event, window, cx| {
                let evasive = click_state.read(cx).evasive();
                if evasive && !event.is_keyboard() {
                    // Touch has no hover to flee from, so a tap makes it dodge.
                    if let (ClickEvent::Touch(_), Some(rest)) = (event, rest_for_click.get()) {
                        click_state.update(cx, |s, cx| {
                            s.dodge(event.position(), rest, true);
                            cx.notify();
                        });
                    }
                    return;
                }
                if let Some(handler) = on_click.as_ref() {
                    handler(event, window, cx);
                }
                click_state.update(cx, |s, cx| {
                    if s.tired && !reset_after.is_zero() {
                        s.task = Some(cx.spawn(async move |this, cx| {
                            cx.background_executor().timer(reset_after).await;
                            this.update(cx, |s, cx| {
                                s.reset();
                                cx.notify();
                            })
                            .ok();
                        }));
                    }
                });
            })
        };

        // The wrapper is the resting slot; the button travels relative to it.
        let watcher = state.clone();
        div()
            .relative()
            .flex()
            .flex_none()
            .child(
                canvas(
                    {
                        let rest_cell = rest_cell.clone();
                        move |bounds, _, _| rest_cell.set(Some(bounds))
                    },
                    move |bounds, _, window, _| {
                        if evasive {
                            watch_pointer(watcher.clone(), bounds, window);
                        }
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            .child(button)
    }
}

/// The original listens for `pointermove` on the whole window.
fn watch_pointer(state: Entity<TrollState>, rest: Bounds<Pixels>, window: &mut Window) {
    window.on_mouse_event(move |event: &MouseMoveEvent, phase, _, cx| {
        if phase != DispatchPhase::Bubble {
            return;
        }
        state.update(cx, |s, cx| {
            if s.evasive() && s.dodge(event.position, rest, false) {
                cx.notify();
            }
        });
    });
}

fn squash_bounds(bounds: Bounds<Pixels>, sx: f32, sy: f32) -> Bounds<Pixels> {
    let w = bounds.size.width * sx;
    let h = bounds.size.height * sy;
    Bounds::new(
        point(
            bounds.origin.x + (bounds.size.width - w) * 0.5,
            bounds.origin.y + (bounds.size.height - h) * 0.5,
        ),
        size(w, h),
    )
}

/// The graded surface rotated by `degrees` about its centre (the dodge lean).
/// Shadows stay axis-aligned; the hairline and gradient rotate with the face.
fn paint_leaning_surface(
    bounds: Bounds<Pixels>,
    frame: PressFrame,
    radius: Pixels,
    degrees: f32,
    window: &mut Window,
) {
    let face = crate::surface::scale_bounds(bounds, frame.scale);
    let r = radius.as_f32() * frame.scale;
    window.paint_drop_shadows(
        face,
        Corners::all(px(r)),
        &[gpui::BoxShadow {
            color: rgb_a(0x000000, 0.4),
            offset: point(px(0.0), px(4.0)),
            // 0 4px 12px -4px; GPUI's blur radius is the sigma (CSS blur / 2).
            blur_radius: px(6.0),
            spread_radius: px(-4.0),
            inset: false,
        }],
    );
    let rotate = rotation(face.center(), degrees);
    let fill = |inflate: f32, color: gpui::Background, window: &mut Window| {
        let outline = rounded_rect(face, r + inflate, inflate);
        let points: Vec<Point<Pixels>> = outline.into_iter().map(&rotate).collect();
        let mut path = PathBuilder::fill();
        path.add_polygon(&points, true);
        if let Ok(path) = path.build() {
            window.paint_path(path, color);
        }
    };
    // 0 0 0 1px rgb(0 0 0 / .9) hairline, then the face.
    fill(1.0, rgb_a(0x000000, 0.9).into(), window);
    let b = frame.brightness;
    fill(
        0.0,
        linear_gradient(
            180.0 + degrees,
            linear_color_stop(brighten(gpui::rgb(0x353535), b), 0.0),
            linear_color_stop(brighten(gpui::rgb(0x272727), b), 1.0),
        ),
        window,
    );
}

fn rotation(center: Point<Pixels>, degrees: f32) -> impl Fn((f32, f32)) -> Point<Pixels> {
    let (sin, cos) = degrees.to_radians().sin_cos();
    let (cx, cy) = (center.x.as_f32(), center.y.as_f32());
    move |(x, y)| {
        let (dx, dy) = (x - cx, y - cy);
        point(px(cx + dx * cos - dy * sin), px(cy + dx * sin + dy * cos))
    }
}

/// Rounded-rect outline grown by `inflate` on every side.
fn rounded_rect(bounds: Bounds<Pixels>, radius: f32, inflate: f32) -> Vec<(f32, f32)> {
    let (x0, y0) = (
        bounds.origin.x.as_f32() - inflate,
        bounds.origin.y.as_f32() - inflate,
    );
    let (x1, y1) = (
        bounds.right().as_f32() + inflate,
        bounds.bottom().as_f32() + inflate,
    );
    let r = radius.min((x1 - x0) * 0.5).min((y1 - y0) * 0.5);
    let corners = [
        (x1 - r, y0 + r, -90.0_f32),
        (x1 - r, y1 - r, 0.0),
        (x0 + r, y1 - r, 90.0),
        (x0 + r, y0 + r, 180.0),
    ];
    let mut points = Vec::with_capacity(4 * 9);
    for (cx, cy, start) in corners {
        for s in 0..=8 {
            let angle = (start + 90.0 * s as f32 / 8.0).to_radians();
            points.push((cx + r * angle.cos(), cy + r * angle.sin()));
        }
    }
    points
}
