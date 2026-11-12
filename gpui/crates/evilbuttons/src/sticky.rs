//! StickyButton: a magnetic button. From a wide field around it, the body is
//! pulled toward the cursor and tilts in perspective, the label drifts inside
//! it on a lazier spring (parallax), and a soft spotlight follows the cursor.
//!
//! GPUI has no 3D transforms, so the body outline is rotated and projected
//! (`perspective: 600px`) by hand and painted as a path; the label is moved to
//! the projected spot but stays flat.

use gpui::{
    App, Bounds, BoxShadow, ClickEvent, Context, Corners, DispatchPhase, ElementId, FocusHandle,
    FontWeight, Hsla, InteractiveElement, IntoElement, MouseExitEvent, MouseMoveEvent,
    ParentElement, PathBuilder, Pixels, Point, RenderOnce, SharedString,
    StatefulInteractiveElement, Styled, Window, WindowAppearance, canvas, div, point,
    prelude::FluentBuilder, px,
};
use std::{cell::Cell, rc::Rc};

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::Instant;
use crate::surface::{paint_focus_ring, rgb_a};

/// Largest label drift at `parallax = 1`, kept inside the button's padding.
const MAX_LABEL_SHIFT: (f32, f32) = (12.0, 5.0);
const BODY_SPRING: Cfg = Cfg::new(170.0, 16.0, 0.6);
/// The label lags a little behind the body so the two layers visibly separate.
const LABEL_SPRING: Cfg = Cfg::new(120.0, 14.0, 0.7);
const GLOW_SPRING: Cfg = Cfg::new(200.0, 30.0, 1.0);
/// `whileTap={{ scale: 0.95 }}` with `{ stiffness: 400, damping: 22 }`.
const TAP_SPRING: Cfg = Cfg::new(400.0, 22.0, 1.0);
/// The wrapper's `perspective: 600px`.
const PERSPECTIVE: f32 = 600.0;
/// `rounded-md` with shadcn's `--radius: 0.625rem`.
const RADIUS: f32 = 8.0;

/// A magnetic button pulled toward the cursor, with parallax and tilt.
///
/// ```ignore
/// StickyButton::new("launch", "Launch").radius(220.0).strength(0.7)
/// ```
#[derive(IntoElement)]
pub struct StickyButton {
    id: ElementId,
    label: SharedString,
    radius: f32,
    strength: f32,
    parallax: f32,
    tilt: f32,
    background: Option<Hsla>,
    foreground: Option<Hsla>,
    border_color: Option<Hsla>,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl StickyButton {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            radius: 120.0,
            strength: 0.45,
            parallax: 0.35,
            tilt: 8.0,
            background: None,
            foreground: None,
            border_color: None,
            disabled: false,
            on_click: None,
        }
    }

    /// Distance in px beyond the button's edge where the pull starts. Defaults to 120.
    pub fn radius(mut self, radius: f32) -> Self {
        self.radius = radius;
        self
    }

    /// How far the body follows the cursor, as a fraction of the cursor offset. Defaults to 0.45.
    pub fn strength(mut self, strength: f32) -> Self {
        self.strength = strength;
        self
    }

    /// How far the label drifts inside the body, from 0 (fixed) to 1 (edge of the padding).
    /// Defaults to 0.35.
    pub fn parallax(mut self, parallax: f32) -> Self {
        self.parallax = parallax;
        self
    }

    /// Maximum tilt in degrees while the body is pulled. Defaults to 8.
    pub fn tilt(mut self, degrees: f32) -> Self {
        self.tilt = degrees;
        self
    }

    /// Face colour (your theme's background). Defaults to shadcn's `--background`
    /// for the window's light or dark appearance.
    pub fn background(mut self, color: impl Into<Hsla>) -> Self {
        self.background = Some(color.into());
        self
    }

    /// Label and spotlight colour (your theme's foreground). Defaults to shadcn's `--foreground`.
    pub fn foreground(mut self, color: impl Into<Hsla>) -> Self {
        self.foreground = Some(color.into());
        self
    }

    /// Dashed border colour. Defaults to shadcn's `--border`.
    pub fn border_color(mut self, color: impl Into<Hsla>) -> Self {
        self.border_color = Some(color.into());
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

#[derive(Clone, Copy, Debug, PartialEq)]
struct Cfg {
    stiffness: f32,
    damping: f32,
    mass: f32,
}

impl Cfg {
    const fn new(stiffness: f32, damping: f32, mass: f32) -> Self {
        Self {
            stiffness,
            damping,
            mass,
        }
    }
}

/// A `useSpring` motion value: follows its target with a damped spring.
#[derive(Clone, Copy, Debug)]
struct Spring {
    value: f32,
    velocity: f32,
    target: f32,
    cfg: Cfg,
    last: Instant,
}

impl Spring {
    fn new(value: f32, cfg: Cfg) -> Self {
        Self {
            value,
            velocity: 0.0,
            target: value,
            cfg,
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
            self.velocity += force / self.cfg.mass * h;
            self.value += self.velocity * h;
            remaining -= h;
        }
        if (self.value - self.target).abs() < 0.002 && self.velocity.abs() < 0.02 {
            self.value = self.target;
            self.velocity = 0.0;
        }
        self.value
    }

    fn set(&mut self, target: f32) {
        if self.target != target {
            self.advance(Instant::now());
            self.target = target;
        }
    }
}

struct StickyState {
    x: Spring,
    y: Spring,
    label_x: Spring,
    label_y: Spring,
    glow_opacity: Spring,
    scale: Spring,
    /// Spotlight centre, relative to the resting frame's top-left.
    glow: (f32, f32),
    pressed: bool,
    focus_visible: bool,
    /// The resting frame (the wrapper never moves).
    rest: Rc<Cell<Option<Bounds<Pixels>>>>,
    focus: FocusHandle,
}

impl StickyState {
    fn release_pull(&mut self) {
        self.x.set(0.0);
        self.y.set(0.0);
        self.label_x.set(0.0);
        self.label_y.set(0.0);
        self.glow_opacity.set(0.0);
    }

    fn pointer_moved(
        &mut self,
        position: Point<Pixels>,
        radius: f32,
        strength: f32,
        parallax: f32,
    ) {
        let Some(rect) = self.rest.get() else {
            return;
        };
        let (left, top) = (rect.origin.x.as_f32(), rect.origin.y.as_f32());
        let (w, h) = (rect.size.width.as_f32(), rect.size.height.as_f32());
        let (cx, cy) = (position.x.as_f32(), position.y.as_f32());
        let dx = cx - (left + w / 2.0);
        let dy = cy - (top + h / 2.0);
        let outside_x = (dx.abs() - w / 2.0).max(0.0);
        let outside_y = (dy.abs() - h / 2.0).max(0.0);
        let pull = falloff(outside_x.hypot(outside_y) / radius.max(1.0));
        if pull == 0.0 {
            self.release_pull();
            return;
        }
        self.x.set(dx * strength * pull);
        self.y.set(dy * strength * pull);
        let nx = (dx / (w / 2.0)).clamp(-1.0, 1.0);
        let ny = (dy / (h / 2.0)).clamp(-1.0, 1.0);
        self.label_x.set(nx * MAX_LABEL_SHIFT.0 * parallax * pull);
        self.label_y.set(ny * MAX_LABEL_SHIFT.1 * parallax * pull);
        self.glow = (cx - left, cy - top);
        self.glow_opacity.set(pull);
    }
}

impl Pressable for StickyState {
    fn set_hovered(&mut self, _: bool) -> bool {
        false
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.focus_visible = keyboard;
        self.pressed = true;
        self.scale.set(0.95);
        true
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        if !self.pressed {
            return false;
        }
        self.pressed = false;
        self.scale.set(1.0);
        true
    }
}

/// 1 inside the button, easing smoothly to 0 at the edge of the field.
fn falloff(t: f32) -> f32 {
    if t <= 0.0 {
        1.0
    } else if t >= 1.0 {
        0.0
    } else {
        1.0 - t * t * (3.0 - 2.0 * t)
    }
}

/// The body's pose: `translate(x, y) scale(s) rotateX(a) rotateY(b)` under the
/// wrapper's perspective (origin at the resting centre).
#[derive(Clone, Copy, Debug)]
struct Pose {
    x: f32,
    y: f32,
    scale: f32,
    rotate_x: f32,
    rotate_y: f32,
}

impl Pose {
    /// Projects a point given relative to the body's centre; returns the offset
    /// from the resting centre on screen.
    fn project(&self, px: f32, py: f32) -> (f32, f32) {
        let (sb, cb) = self.rotate_y.to_radians().sin_cos();
        let (sa, ca) = self.rotate_x.to_radians().sin_cos();
        // rotateY, then rotateX (CSS applies the rightmost transform first).
        let (x1, y1, z1) = (px * cb, py, -px * sb);
        let (x2, y2, z2) = (x1, y1 * ca - z1 * sa, y1 * sa + z1 * ca);
        // scale() is 2D, then translate.
        let (wx, wy) = (self.x + x2 * self.scale, self.y + y2 * self.scale);
        let k = PERSPECTIVE / (PERSPECTIVE - z2);
        (wx * k, wy * k)
    }
}

impl RenderOnce for StickyButton {
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
        let border = self.border_color.unwrap_or_else(|| {
            if dark_window {
                rgb_a(0xffffff, 0.1)
            } else {
                rgb_a(0xe5e5e5, 1.0)
            }
        });
        let dark = background.l < 0.5;

        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<StickyState>| {
                StickyState {
                    x: Spring::new(0.0, BODY_SPRING),
                    y: Spring::new(0.0, BODY_SPRING),
                    label_x: Spring::new(0.0, LABEL_SPRING),
                    label_y: Spring::new(0.0, LABEL_SPRING),
                    glow_opacity: Spring::new(0.0, GLOW_SPRING),
                    scale: Spring::new(1.0, TAP_SPRING),
                    glow: (0.0, 0.0),
                    pressed: false,
                    focus_visible: false,
                    rest: Rc::new(Cell::new(None)),
                    focus: cx.focus_handle().tab_stop(true),
                }
            });

        let now = Instant::now();
        let reach = self.radius.max(1.0) * self.strength;
        let tilt = self.tilt;
        let disabled = self.disabled;
        let (pose, label_offset, glow, glow_opacity, rest, animating) = state.update(cx, |s, _| {
            if disabled {
                s.release_pull();
            }
            let (x, y) = (s.x.advance(now), s.y.advance(now));
            let label = (s.label_x.advance(now), s.label_y.advance(now));
            let glow_opacity = s.glow_opacity.advance(now);
            let scale = s.scale.advance(now);
            // useTransform(x, [-reach, reach], [-tilt, tilt]) (clamped).
            let map = |v: f32| (v / reach.max(f32::EPSILON)).clamp(-1.0, 1.0) * tilt;
            let pose = Pose {
                x,
                y,
                scale,
                rotate_x: -map(y),
                rotate_y: map(x),
            };
            let animating = [
                &s.x,
                &s.y,
                &s.label_x,
                &s.label_y,
                &s.glow_opacity,
                &s.scale,
            ]
            .iter()
            .any(|spring| !spring.settled());
            (pose, label, s.glow, glow_opacity, s.rest.clone(), animating)
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

        // Where the label's centre lands, relative to the moved button's centre.
        let (lx, ly) = pose.project(label_offset.0, label_offset.1);
        let (label_dx, label_dy) = (lx - pose.x, ly - pose.y);
        let label = self.label.clone();
        let label_el = |size: f32| {
            div()
                .flex()
                .flex_none()
                .items_center()
                .gap(px(6.0))
                .whitespace_nowrap()
                .text_size(px(size))
                .child(label.clone())
        };

        let rest_for_paint = rest.clone();
        let button = div()
            .id(self.id.clone())
            .relative()
            .left(px(pose.x))
            .top(px(pose.y))
            .flex()
            .flex_none()
            .h(px(36.0))
            .px(px(16.0))
            .items_center()
            .justify_center()
            .text_size(px(14.0))
            .line_height(px(20.0))
            .font_weight(FontWeight::MEDIUM)
            .text_color(foreground)
            .when(disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    |_, _, _| {},
                    move |_, _, window, _| {
                        let Some(rest) = rest_for_paint.get() else {
                            return;
                        };
                        paint_body(
                            rest,
                            pose,
                            Body {
                                background,
                                foreground,
                                border,
                                dark,
                                glow,
                                glow_opacity: glow_opacity.clamp(0.0, 1.0),
                                focus_visible,
                            },
                            window,
                        );
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            // Sizes the button; the visible label floats above at its projected spot.
            .child(label_el(14.0).opacity(0.0))
            .child(
                div()
                    .absolute()
                    .top_0()
                    .left_0()
                    .size_full()
                    .flex()
                    .items_center()
                    .justify_center()
                    .child(
                        label_el(14.0 * pose.scale)
                            .relative()
                            .left(px(label_dx))
                            .top(px(label_dy)),
                    ),
            );
        let button = wire(button, &state, &focus, disabled);
        let button = match (disabled, self.on_click.clone()) {
            (false, Some(handler)) => button.on_click(move |event, window, cx| {
                handler(event, window, cx);
            }),
            _ => button,
        };

        // The wrapper is the resting frame the pull is measured from.
        let (radius, strength, parallax) = (self.radius, self.strength, self.parallax);
        let listen = state.clone();
        div().relative().flex().flex_none().child(button).child(
            canvas(
                move |bounds, _, _| rest.set(Some(bounds)),
                move |_, _, window, _| {
                    if disabled {
                        return;
                    }
                    let moved = listen.clone();
                    window.on_mouse_event(move |event: &MouseMoveEvent, phase, _, cx| {
                        if phase != DispatchPhase::Bubble {
                            return;
                        }
                        moved.update(cx, |s, cx| {
                            s.pointer_moved(event.position, radius, strength, parallax);
                            cx.notify();
                        });
                    });
                    let left = listen.clone();
                    window.on_mouse_event(move |_: &MouseExitEvent, phase, _, cx| {
                        if phase != DispatchPhase::Bubble {
                            return;
                        }
                        left.update(cx, |s, cx| {
                            s.release_pull();
                            cx.notify();
                        });
                    });
                },
            )
            .absolute()
            .top_0()
            .left_0()
            .size_full(),
        )
    }
}

#[derive(Clone, Copy)]
struct Body {
    background: Hsla,
    foreground: Hsla,
    border: Hsla,
    dark: bool,
    glow: (f32, f32),
    glow_opacity: f32,
    focus_visible: bool,
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

fn paint_body(rest: Bounds<Pixels>, pose: Pose, body: Body, window: &mut Window) {
    let (w, h) = (rest.size.width.as_f32(), rest.size.height.as_f32());
    let center = rest.center();
    let (cx, cy) = (center.x.as_f32(), center.y.as_f32());
    // The outline in body coordinates (centred), then projected to the screen.
    let local = rounded_rect(w, h, RADIUS, 6);
    let to_screen = |&(x, y): &(f32, f32)| {
        let (sx, sy) = pose.project(x, y);
        (cx + sx, cy + sy)
    };
    let outline: Vec<(f32, f32)> = local.iter().map(to_screen).collect();
    let as_points = |poly: &[(f32, f32)]| -> Vec<Point<Pixels>> {
        poly.iter().map(|&(x, y)| point(px(x), px(y))).collect()
    };

    // Shadows and focus ring follow the projected box (the tilt is at most a few degrees).
    let (mut x0, mut y0, mut x1, mut y1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
    for &(x, y) in &outline {
        x0 = x0.min(x);
        y0 = y0.min(y);
        x1 = x1.max(x);
        y1 = y1.max(y);
    }
    let bbox = Bounds::from_corners(point(px(x0), px(y0)), point(px(x1), px(y1)));
    let radius = px(RADIUS * pose.scale);
    let radii = Corners::all(radius);
    let black = |a: f32| rgb_a(0x000000, a);
    if body.focus_visible {
        let ring = rgb_a(if body.dark { 0x737373 } else { 0xa1a1a1 }, 1.0);
        paint_focus_ring(bbox, radius, ring, body.background, window);
    }
    if body.dark {
        window.paint_drop_shadows(
            bbox,
            radii,
            &[shadow(0.0, 1.0, 2.0, 0.0, black(0.4), false)],
        );
    } else {
        window.paint_drop_shadows(
            bbox,
            radii,
            &[
                shadow(0.0, 2.0, 6.0, -3.0, black(0.07), false),
                shadow(0.0, 1.0, 2.0, 0.0, black(0.05), false),
            ],
        );
    }

    let mut fill = PathBuilder::fill();
    fill.add_polygon(&as_points(&outline), true);
    if let Ok(path) = fill.build() {
        window.paint_path(path, body.background);
    }

    // Spotlight: radial-gradient(120px circle, foreground 12% → transparent at 70%),
    // built from stacked discs clipped to the face.
    if body.glow_opacity > 0.001 {
        const RINGS: usize = 24;
        let reach = 120.0 * 0.7;
        let (gx, gy) = (body.glow.0 - w / 2.0, body.glow.1 - h / 2.0);
        let alpha = 0.12 * body.foreground.a * body.glow_opacity / RINGS as f32;
        let face = rounded_rect(w, h, RADIUS, 4);
        for i in 1..=RINGS {
            let r = reach * i as f32 / RINGS as f32;
            let disc: Vec<(f32, f32)> = (0..32)
                .map(|k| {
                    let a = k as f32 / 32.0 * std::f32::consts::TAU;
                    (gx + r * a.cos(), gy + r * a.sin())
                })
                .collect();
            let clipped = clip_convex(&disc, &face);
            if clipped.len() < 3 {
                continue;
            }
            let projected: Vec<(f32, f32)> = clipped.iter().map(to_screen).collect();
            let mut builder = PathBuilder::fill();
            builder.add_polygon(&as_points(&projected), true);
            if let Ok(path) = builder.build() {
                window.paint_path(path, body.foreground.opacity(alpha));
            }
        }
    }

    let inset = if body.dark {
        shadow(0.0, 1.0, 0.0, 0.0, rgb_a(0xffffff, 0.05), true)
    } else {
        shadow(0.0, -1.0, 0.0, 0.0, black(0.03), true)
    };
    window.paint_inset_shadows(bbox, radii, &[inset]);

    // 1px dashed border, inset half a pixel so it sits inside the edge like CSS.
    let border_line: Vec<(f32, f32)> = rounded_rect(w - 1.0, h - 1.0, RADIUS - 0.5, 6)
        .iter()
        .map(to_screen)
        .collect();
    let mut stroke = PathBuilder::stroke(px(1.0)).dash_array(&[px(3.0), px(3.0)]);
    stroke.add_polygon(&as_points(&border_line), true);
    if let Ok(path) = stroke.build() {
        window.paint_path(path, body.border);
    }
}

/// A centred rounded rectangle, clockwise from the top edge.
fn rounded_rect(w: f32, h: f32, radius: f32, segments: usize) -> Vec<(f32, f32)> {
    let r = radius.min(w * 0.5).min(h * 0.5).max(0.0);
    let (hw, hh) = (w * 0.5, h * 0.5);
    let corners = [
        (hw - r, -hh + r, -90.0_f32),
        (hw - r, hh - r, 0.0),
        (-hw + r, hh - r, 90.0),
        (-hw + r, -hh + r, 180.0),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn falloff_is_smooth_and_bounded() {
        assert_eq!(falloff(0.0), 1.0);
        assert_eq!(falloff(1.0), 0.0);
        assert!((falloff(0.5) - 0.5).abs() < 1e-6);
    }

    #[test]
    fn tilt_recedes_the_near_edge() {
        let pose = Pose {
            x: 0.0,
            y: 0.0,
            scale: 1.0,
            rotate_x: 0.0,
            rotate_y: 8.0,
        };
        // rotateY(+) pushes the right edge away, so it projects shorter.
        let right = pose.project(60.0, 18.0).1;
        let left = pose.project(-60.0, 18.0).1;
        assert!(right < 18.0 && left > 18.0);
        let at_rest = Pose {
            rotate_y: 0.0,
            ..pose
        };
        assert_eq!(at_rest.project(10.0, 5.0), (10.0, 5.0));
    }

    #[test]
    fn spotlight_clip_stays_inside_the_face() {
        let face = rounded_rect(120.0, 36.0, RADIUS, 4);
        let disc: Vec<(f32, f32)> = (0..24)
            .map(|k| {
                let a = k as f32 / 24.0 * std::f32::consts::TAU;
                (40.0 + 80.0 * a.cos(), 80.0 * a.sin())
            })
            .collect();
        for (x, y) in clip_convex(&disc, &face) {
            assert!(x.abs() <= 60.001 && y.abs() <= 18.001);
        }
    }
}
