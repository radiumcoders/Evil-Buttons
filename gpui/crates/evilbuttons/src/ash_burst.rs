//! AshBurstButton: the graded dark button that glows like an ember on click
//! and erupts ash that collides with it, piling onto its top.
//!
//! The React original runs Matter.js on a full-page canvas. This is a small
//! hand-written rigid-body sim in Matter's units (px per 60Hz step, the same
//! gravity, air friction, restitution and friction per particle), with the
//! button and two lips on its top corners as static colliders. Particles are
//! painted on a deferred, unclipped overlay in window coordinates.

use gpui::{
    App, Bounds, BoxShadow, ClickEvent, Context, Corners, ElementId, FocusHandle, FontWeight, Hsla,
    InteractiveElement, IntoElement, ParentElement, PathBuilder, Pixels, Point, RenderOnce, Rgba,
    SharedString, StatefulInteractiveElement, Styled, Task, Window, canvas, deferred, div,
    linear_color_stop, linear_gradient, point, prelude::FluentBuilder, px, quad, transparent_black,
};
use std::{cell::Cell, f32::consts::PI, rc::Rc};

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Easing, Instant, Transition};
use crate::surface::{
    PressFrame, PressMotion, brighten, ms, paint_focus_ring, rgb_a, scale_bounds, scaled_content,
    surface_text,
};

type DestroyHandler = Rc<dyn Fn(&mut Window, &mut App)>;

/// Mostly charcoal and ash grey, with a few embers.
const ASH_COLORS: [u32; 8] = [
    0x171717, 0x262626, 0x404040, 0x525252, 0x737373, 0xa3a3a3, 0xb91c1c, 0xf97316,
];
/// How long the ember glow stays on the button after a burst.
const FIRE_MS: u64 = 480;
/// Matter steps at 60Hz; its units are px and px per step.
const STEP: f32 = 1.0 / 60.0;
/// `gravity.y = 1.4` at Matter's default `gravity.scale = 0.001`, per step².
const GRAVITY: f32 = 1.4 * 0.001 * (1000.0 / 60.0) * (1000.0 / 60.0);
/// Below this normal speed (px/step) Matter treats a contact as resting: no bounce.
const RESTING: f32 = 1.4;
/// The whole simulation stops after this long.
const SIM_SECS: f32 = 6.5;

/// A dark button that bursts into physics-driven ash on click.
///
/// ```ignore
/// AshBurstButton::new("incinerate")
///     .label("Incinerate")
///     .particle_count(120)
///     .on_destroy(|_, _| println!("Burned."))
/// ```
#[derive(IntoElement)]
pub struct AshBurstButton {
    id: ElementId,
    label: SharedString,
    particle_count: usize,
    spread: f32,
    start_velocity: f32,
    colors: Vec<Hsla>,
    icon: bool,
    disabled: bool,
    on_click: Option<ClickHandler>,
    on_destroy: Option<DestroyHandler>,
}

impl AshBurstButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: "Delete".into(),
            particle_count: 80,
            spread: 110.0,
            start_velocity: 42.0,
            colors: ASH_COLORS.iter().map(|&c| rgb_a(c, 1.0)).collect(),
            icon: true,
            disabled: false,
            on_click: None,
            on_destroy: None,
        }
    }

    /// Button label. Defaults to "Delete".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Ash particles per burst (at least 12). Defaults to 80.
    pub fn particle_count(mut self, count: usize) -> Self {
        self.particle_count = count;
        self
    }

    /// Burst spread in degrees. Defaults to 110.
    pub fn spread(mut self, degrees: f32) -> Self {
        self.spread = degrees;
        self
    }

    /// Launch velocity, in Matter.js units. Defaults to 42.
    pub fn start_velocity(mut self, velocity: f32) -> Self {
        self.start_velocity = velocity;
        self
    }

    /// Ash and ember colours. Warm reds and oranges get a soft glow.
    pub fn colors<C: Into<Hsla>>(mut self, colors: impl IntoIterator<Item = C>) -> Self {
        let colors: Vec<Hsla> = colors.into_iter().map(Into::into).collect();
        if !colors.is_empty() {
            self.colors = colors;
        }
        self
    }

    /// Show the leading flame icon. Defaults to `true`.
    pub fn icon(mut self, icon: bool) -> Self {
        self.icon = icon;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired on every click, before the burst.
    pub fn on_click(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(handler));
        self
    }

    /// Fired after each ash burst.
    pub fn on_destroy(mut self, handler: impl Fn(&mut Window, &mut App) + 'static) -> Self {
        self.on_destroy = Some(Rc::new(handler));
        self
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Kind {
    Circle,
    Square,
    Shard,
}

#[derive(Clone, Copy, Debug)]
struct Ash {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    angle: f32,
    spin: f32,
    /// Collision radius.
    r: f32,
    restitution: f32,
    friction: f32,
    friction_air: f32,
    kind: Kind,
    size: f32,
    color: Hsla,
    glow: bool,
    /// Age and lifetime in seconds.
    age: f32,
    life: f32,
}

/// A static collider: a (rounded) box.
#[derive(Clone, Copy, Debug)]
struct Wall {
    cx: f32,
    cy: f32,
    hw: f32,
    hh: f32,
    radius: f32,
}

impl Wall {
    /// Signed distance from `(x, y)` to the box, and the outward normal there.
    fn distance(&self, x: f32, y: f32) -> (f32, f32, f32) {
        let (px, py) = (x - self.cx, y - self.cy);
        let (qx, qy) = (
            px.abs() - (self.hw - self.radius),
            py.abs() - (self.hh - self.radius),
        );
        let (ox, oy) = (qx.max(0.0), qy.max(0.0));
        let outside = ox.hypot(oy);
        if outside > 0.0 {
            let (nx, ny) = (ox / outside * px.signum(), oy / outside * py.signum());
            (outside - self.radius, nx, ny)
        } else if qx > qy {
            (qx - self.radius, px.signum(), 0.0)
        } else {
            (qy - self.radius, 0.0, py.signum())
        }
    }

    /// The button (`chamfer` radius `min(8, h / 2)`) and its two lips, from its bounds.
    fn colliders(bounds: Bounds<Pixels>) -> [Wall; 3] {
        let (left, top) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
        let w = bounds.size.width.as_f32().max(8.0);
        let h = bounds.size.height.as_f32().max(8.0);
        let lip_w = (w * 0.1).max(10.0);
        let lip_h = 7.0;
        let lip = |cx: f32| Wall {
            cx,
            cy: top - lip_h / 2.0 + 1.0,
            hw: lip_w / 2.0,
            hh: lip_h / 2.0,
            radius: 0.0,
        };
        [
            Wall {
                cx: left + w / 2.0,
                cy: top + h / 2.0,
                hw: w / 2.0,
                hh: h / 2.0,
                radius: (h / 2.0).min(8.0),
            },
            lip(left + lip_w / 2.0),
            lip(left + w - lip_w / 2.0),
        ]
    }
}

/// xorshift32: tiny, deterministic, wasm-safe.
struct Rng(u32);

impl Rng {
    fn seeded() -> Self {
        let nanos = web_time::SystemTime::now()
            .duration_since(web_time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos() ^ d.as_secs() as u32)
            .unwrap_or(0x9e37_79b9);
        Self(nanos | 1)
    }

    /// Uniform in `0..1`, like `Math.random()`.
    fn next(&mut self) -> f32 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        (x >> 8) as f32 / (1u32 << 24) as f32
    }
}

/// Warm reds and oranges get a soft glow; greys stay flat.
fn is_ember(color: Hsla) -> bool {
    let c = Rgba::from(color);
    let (r, g, b) = (c.r * 255.0, c.g * 255.0, c.b * 255.0);
    r > 150.0 && r > g + 40.0 && r > b + 60.0
}

#[derive(Default)]
struct Sim {
    ash: Vec<Ash>,
    elapsed: f32,
    backlog: f32,
    last: Option<Instant>,
}

impl Sim {
    fn spawn(
        bounds: Bounds<Pixels>,
        count: usize,
        spread: f32,
        start_velocity: f32,
        colors: &[Hsla],
        rng: &mut Rng,
    ) -> Self {
        let (left, top) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
        let w = bounds.size.width.as_f32().max(8.0);
        let h = bounds.size.height.as_f32().max(8.0);
        let (cx, cy) = (left + w / 2.0, top + h / 2.0);
        let half_spread = spread.to_radians() / 2.0;
        let mut ash = Vec::with_capacity(count.max(12));
        for _ in 0..count.max(12) {
            let roll = rng.next();
            let kind = if roll > 0.75 {
                Kind::Shard
            } else if roll > 0.4 {
                Kind::Square
            } else {
                Kind::Circle
            };
            let size = if kind == Kind::Shard {
                2.5 + rng.next() * 3.0
            } else {
                1.6 + rng.next() * 2.6
            };
            let angle = -PI / 2.0 + (rng.next() * 2.0 - 1.0) * half_spread;
            // Balanced kick: readable burst without flying off too hard.
            let speed = start_velocity * (0.45 + rng.next() * 0.55) * 0.7;
            // Mostly explode from centre; a few rain down later to settle on top.
            let rain = rng.next() > 0.72;
            let (x, y) = if rain {
                (left + rng.next() * w, top - 8.0 - rng.next() * 28.0)
            } else {
                (
                    cx + (rng.next() - 0.5) * w * 0.4,
                    cy + (rng.next() - 0.5) * h * 0.3,
                )
            };
            let (restitution, friction, friction_air) = if kind == Kind::Circle {
                (
                    0.35 + rng.next() * 0.3,
                    0.65 + rng.next() * 0.4,
                    0.008 + rng.next() * 0.012,
                )
            } else {
                (
                    0.3 + rng.next() * 0.28,
                    0.7 + rng.next() * 0.4,
                    0.009 + rng.next() * 0.012,
                )
            };
            let (vx, vy) = if rain {
                ((rng.next() - 0.5) * 3.5, 1.0 + rng.next() * 3.0)
            } else {
                (
                    angle.cos() * speed + (rng.next() - 0.5) * 4.0,
                    angle.sin() * speed - (2.0 + rng.next() * 5.0),
                )
            };
            let start_angle = if kind == Kind::Circle {
                0.0
            } else {
                rng.next() * PI
            };
            let color = colors[(rng.next() * colors.len() as f32) as usize % colors.len()];
            // Matter bodies: circle r = 0.85·size; boxes 1.6·size (squares) or
            // 1.4×2.2·size (shards), approximated by circles of similar extent.
            let r = match kind {
                Kind::Circle => size * 0.85,
                Kind::Square => size * 0.85,
                Kind::Shard => size * 0.9,
            };
            ash.push(Ash {
                x,
                y,
                vx,
                vy,
                angle: start_angle,
                spin: (rng.next() - 0.5) * 0.55,
                r,
                restitution,
                friction,
                friction_air,
                kind,
                size,
                color,
                glow: is_ember(color),
                age: 0.0,
                life: 3.2 + rng.next() * 2.2,
            });
        }
        Self {
            ash,
            elapsed: 0.0,
            backlog: 0.0,
            last: Some(Instant::now()),
        }
    }

    fn is_active(&self) -> bool {
        !self.ash.is_empty() && self.elapsed < SIM_SECS
    }

    /// Advances to `now` in fixed 60Hz steps.
    fn advance(&mut self, now: Instant, walls: &[Wall], viewport: (f32, f32)) {
        let Some(last) = self.last else {
            return;
        };
        let dt = now.saturating_duration_since(last).as_secs_f32();
        self.last = Some(now);
        self.backlog = (self.backlog + dt).min(0.2);
        while self.backlog >= STEP {
            self.backlog -= STEP;
            self.step(walls);
            self.elapsed += STEP;
        }
        let (w, h) = viewport;
        self.ash
            .retain(|a| a.age < a.life && a.y <= h + 48.0 && a.x >= -48.0 && a.x <= w + 48.0);
        if self.elapsed >= SIM_SECS {
            self.ash.clear();
        }
    }

    fn step(&mut self, walls: &[Wall]) {
        for a in &mut self.ash {
            let keep = 1.0 - a.friction_air;
            a.vx *= keep;
            a.vy = a.vy * keep + GRAVITY;
            a.x += a.vx;
            a.y += a.vy;
            a.spin *= keep;
            a.angle += a.spin;
            a.age += STEP;
        }
        for iteration in 0..4 {
            let respond = iteration == 0;
            for a in &mut self.ash {
                for wall in walls {
                    let (d, nx, ny) = wall.distance(a.x, a.y);
                    if d >= a.r {
                        continue;
                    }
                    let push = a.r - d;
                    a.x += nx * push;
                    a.y += ny * push;
                    if respond {
                        contact(a, nx, ny, a.restitution, a.friction);
                    }
                }
            }
            self.collide_pairs(respond);
        }
    }

    /// Particle–particle contacts, so the ash piles up instead of overlapping.
    fn collide_pairs(&mut self, respond: bool) {
        let n = self.ash.len();
        for i in 0..n {
            for j in i + 1..n {
                let (left, right) = self.ash.split_at_mut(j);
                let (a, b) = (&mut left[i], &mut right[0]);
                let (dx, dy) = (b.x - a.x, b.y - a.y);
                let reach = a.r + b.r;
                if dx.abs() >= reach || dy.abs() >= reach {
                    continue;
                }
                let dist = dx.hypot(dy);
                if dist >= reach || dist < 1e-4 {
                    continue;
                }
                let (nx, ny) = (dx / dist, dy / dist);
                let (ma, mb) = (a.r * a.r, b.r * b.r);
                let (ia, ib) = (1.0 / ma, 1.0 / mb);
                let push = (reach - dist) / (ia + ib) * 0.8;
                a.x -= nx * push * ia;
                a.y -= ny * push * ia;
                b.x += nx * push * ib;
                b.y += ny * push * ib;
                if !respond {
                    continue;
                }
                let (rvx, rvy) = (b.vx - a.vx, b.vy - a.vy);
                let vn = rvx * nx + rvy * ny;
                if vn >= 0.0 {
                    continue;
                }
                let e = if -vn > RESTING {
                    a.restitution.max(b.restitution)
                } else {
                    0.0
                };
                let jn = -(1.0 + e) * vn / (ia + ib);
                // Coulomb friction along the tangent, capped by the normal impulse.
                let (tx, ty) = (rvx - vn * nx, rvy - vn * ny);
                let vt = tx.hypot(ty);
                let jt = if vt > 1e-5 {
                    (vt / (ia + ib)).min(a.friction.min(b.friction) * jn) / vt
                } else {
                    0.0
                };
                a.vx -= (jn * nx + jt * tx) * ia;
                a.vy -= (jn * ny + jt * ty) * ia;
                b.vx += (jn * nx + jt * tx) * ib;
                b.vy += (jn * ny + jt * ty) * ib;
                a.spin *= 0.9;
                b.spin *= 0.9;
            }
        }
    }
}

/// Bounce and friction against a static collider with outward normal `(nx, ny)`.
fn contact(a: &mut Ash, nx: f32, ny: f32, restitution: f32, friction: f32) {
    let vn = a.vx * nx + a.vy * ny;
    if vn >= 0.0 {
        return;
    }
    let e = if -vn > RESTING { restitution } else { 0.0 };
    let (tx, ty) = (a.vx - vn * nx, a.vy - vn * ny);
    let vt = tx.hypot(ty);
    let drop = friction * (1.0 + e) * -vn;
    let keep = if vt > 1e-5 {
        (1.0 - drop / vt).max(0.0)
    } else {
        0.0
    };
    a.vx = tx * keep - e * vn * nx;
    a.vy = ty * keep - e * vn * ny;
    a.spin *= 0.8;
}

struct AshState {
    motion: PressMotion,
    firing: bool,
    fire_task: Option<Task<()>>,
    /// Ember glow on the face (0–1), on the springy box-shadow transition.
    fire: Transition,
    /// Flame: hover mix, fire mix, lift (px) and scale.
    icon_hover: Transition,
    icon_fire: Transition,
    sim: Sim,
    rng: Rng,
    bounds: Rc<Cell<Option<Bounds<Pixels>>>>,
    focus: FocusHandle,
}

impl AshState {
    fn retarget(&mut self) {
        let (hovered, firing) = (self.motion.hovered, self.firing);
        let springy = |t: &mut Transition, to: f32| {
            t.animate_to(to, ms(300), Easing::SPRINGY);
        };
        springy(&mut self.fire, if firing { 1.0 } else { 0.0 });
        springy(&mut self.icon_hover, if hovered { 1.0 } else { 0.0 });
        springy(&mut self.icon_fire, if firing { 1.0 } else { 0.0 });
    }
}

impl Pressable for AshState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        let changed = self.motion.set_hovered(hovered);
        if changed {
            self.retarget();
        }
        changed
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.motion.focus_visible = keyboard;
        self.motion.press()
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        self.motion.release()
    }
}

/// One particle as painted this frame.
#[derive(Clone, Copy)]
struct AshFrame {
    x: f32,
    y: f32,
    angle: f32,
    size: f32,
    kind: Kind,
    color: Hsla,
    glow: Option<Hsla>,
}

impl RenderOnce for AshBurstButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state = window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<AshState>| {
            AshState {
                motion: PressMotion::new(),
                firing: false,
                fire_task: None,
                fire: Transition::new(0.0),
                icon_hover: Transition::new(0.0),
                icon_fire: Transition::new(0.0),
                sim: Sim::default(),
                rng: Rng::seeded(),
                bounds: Rc::new(Cell::new(None)),
                focus: cx.focus_handle().tab_stop(true),
            }
        });

        let now = Instant::now();
        let viewport = window.viewport_size();
        let viewport = (viewport.width.as_f32(), viewport.height.as_f32());
        let (frame, fire, icon_hover, icon_fire, ash, bounds_cell, focus, animating) = state
            .update(cx, |s, _| {
                let frame = s.motion.frame(now);
                if let Some(bounds) = s.bounds.get() {
                    // Collide with the button as drawn (press-scaled), like getBoundingClientRect.
                    let walls = Wall::colliders(scale_bounds(bounds, frame.scale));
                    s.sim.advance(now, &walls, viewport);
                }
                let ash: Vec<AshFrame> = if s.sim.is_active() {
                    s.sim
                        .ash
                        .iter()
                        .map(|a| {
                            let fade = (1.0 - a.age / a.life).max(0.0);
                            AshFrame {
                                x: a.x,
                                y: a.y,
                                angle: a.angle,
                                size: a.size,
                                kind: a.kind,
                                color: a.color.opacity(a.color.a * (0.4 + fade * 0.6)),
                                glow: a.glow.then(|| a.color.opacity(a.color.a * fade * 0.22)),
                            }
                        })
                        .collect()
                } else {
                    Vec::new()
                };
                let animating = frame.animating
                    || s.sim.is_active()
                    || s.fire.is_animating(now)
                    || s.icon_hover.is_animating(now)
                    || s.icon_fire.is_animating(now);
                (
                    frame,
                    s.fire.value(now),
                    s.icon_hover.value(now).clamp(0.0, 1.0),
                    s.icon_fire.value(now),
                    ash,
                    s.bounds.clone(),
                    s.focus.clone(),
                    animating,
                )
            });
        let focus_visible = {
            let s = state.read(cx);
            (s.motion.focus_visible || window.last_input_was_keyboard())
                && s.focus.is_focused(window)
        };
        if animating {
            window.request_animation_frame();
        }

        let radius = px(10.0);
        let text = surface_text(frame.brightness);
        // text-neutral-50/45 → hover red-400/80 → firing orange-400, -1px and 110%.
        let icon_color = mix(
            mix(rgb_a(0xfafafa, 0.45), rgb_a(0xf87171, 0.8), icon_hover),
            rgb_a(0xfb923c, 1.0),
            icon_fire.clamp(0.0, 1.0),
        );
        let icon_lift = -icon_fire;
        let icon_scale = 1.0 + 0.1 * icon_fire;

        let button = div()
            .id(self.id.clone())
            .relative()
            .flex()
            .flex_none()
            .h(px(36.0))
            .pl(px(if self.icon { 12.0 } else { 16.0 }))
            .pr(px(16.0))
            .gap(px(8.0))
            .items_center()
            .justify_center()
            .text_size(px(14.0))
            .line_height(px(20.0))
            .font_weight(FontWeight::MEDIUM)
            .text_color(text)
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    move |bounds, _, _| bounds_cell.set(Some(bounds)),
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
                        paint_ember_surface(bounds, frame, fire, radius, window);
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            .child({
                let (show_icon, label) = (self.icon, self.label.clone());
                scaled_content(frame.scale, move |s| {
                    div()
                        .flex()
                        .items_center()
                        .gap(px(8.0 * s))
                        .text_size(px(14.0 * s))
                        .line_height(px(20.0 * s))
                        .whitespace_nowrap()
                        .when(show_icon, |el| {
                            el.child(
                                canvas(
                                    |_, _, _| {},
                                    move |mut bounds, _, window, _| {
                                        bounds.origin.y += px(icon_lift * s);
                                        paint_flame(bounds, icon_scale, icon_color, window);
                                    },
                                )
                                .size(px(14.0 * s))
                                .flex_none(),
                            )
                        })
                        .child(label.clone())
                        .into_any_element()
                })
            })
            // Ash overlay: painted last and unclipped, in window coordinates.
            .when(!ash.is_empty(), |el| {
                el.child(
                    deferred(
                        canvas(
                            |_, _, _| {},
                            move |_, _, window, _| {
                                for particle in &ash {
                                    paint_ash(particle, window);
                                }
                            },
                        )
                        .absolute()
                        .top_0()
                        .left_0()
                        .size_full(),
                    )
                    .with_priority(1),
                )
            });

        let button = wire(button, &state, &focus, self.disabled);
        if self.disabled {
            return button;
        }
        let click_state = state.clone();
        let on_click = self.on_click.clone();
        let on_destroy = self.on_destroy.clone();
        let (count, spread, velocity, colors) = (
            self.particle_count,
            self.spread,
            self.start_velocity,
            self.colors,
        );
        button.on_click(move |event, window, cx| {
            if let Some(handler) = on_click.as_ref() {
                handler(event, window, cx);
            }
            click_state.update(cx, |s, cx| {
                if let Some(bounds) = s.bounds.get() {
                    s.sim = Sim::spawn(bounds, count, spread, velocity, &colors, &mut s.rng);
                }
                s.firing = true;
                s.retarget();
                s.fire_task = Some(cx.spawn(async move |this, cx| {
                    cx.background_executor().timer(ms(FIRE_MS)).await;
                    this.update(cx, |s, cx| {
                        s.firing = false;
                        s.retarget();
                        cx.notify();
                    })
                    .ok();
                }));
                cx.notify();
            });
            if let Some(handler) = on_destroy.as_ref() {
                handler(window, cx);
            }
        })
    }
}

fn mix(a: Hsla, b: Hsla, t: f32) -> Hsla {
    let (a, b) = (Rgba::from(a), Rgba::from(b));
    let l = |x: f32, y: f32| x + (y - x) * t;
    Rgba {
        r: l(a.r, b.r),
        g: l(a.g, b.g),
        b: l(a.b, b.b),
        a: l(a.a, b.a),
    }
    .into()
}

fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
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

/// The graded dark surface, plus the `data-firing` ember glow blended in by `fire`.
fn paint_ember_surface(
    bounds: Bounds<Pixels>,
    frame: PressFrame,
    fire: f32,
    radius: Pixels,
    window: &mut Window,
) {
    let bounds = scale_bounds(bounds, frame.scale);
    let radii = Corners::all(radius * frame.scale);
    let s = frame.settle;
    let f = fire.clamp(0.0, 1.0);
    let black = |a: f32| rgb_a(0x000000, a);
    let white = |a: f32| rgb_a(0xffffff, a);
    let red = |a: f32| rgb_a(0xef4444, a);

    // Resting drop 0_4px_12px_-4px_rgb(0_0_0/0.4) warms to 0_4px_16px_-4px_rgb(239_68_68/0.35).
    let drop = mix(black(lerp(0.4, 0.3, s)), red(0.35), f);
    window.paint_drop_shadows(
        bounds,
        radii,
        &[
            shadow(
                0.0,
                lerp(4.0, 1.0, s),
                lerp(lerp(12.0, 3.0, s), 16.0, f),
                lerp(-4.0, -2.0, s),
                drop,
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

    // Inner ring white/0.06 → orange-500/0.18, plus an inset red glow rising from the bottom.
    let ring = mix(white(lerp(0.06, 0.05, s)), rgb_a(0xf97316, 0.18), f);
    let mut insets = vec![
        shadow(0.0, 0.0, 0.0, 1.0, ring, true),
        shadow(0.0, 1.0, 0.0, 0.0, white(lerp(0.14, 0.08, s)), true),
    ];
    if fire > 0.001 {
        insets.push(shadow(
            0.0,
            -8.0,
            16.0,
            -8.0,
            red(0.35 * fire.max(0.0)),
            true,
        ));
    }
    window.paint_inset_shadows(bounds, radii, &insets);
}

/// The flame glyph (16-unit grid), filled and scaled about its centre.
fn paint_flame(bounds: Bounds<Pixels>, scale: f32, color: Hsla, window: &mut Window) {
    // M8.6 1.2c.3 2-.6 3.1-1.6 4.2C5.9 6.6 4.5 8 4.5 10.2 4.5 12.6 6.2 14.5 8 14.5
    // s3.5-1.6 3.5-4.1c0-1.5-.6-2.6-1.3-3.4-.1 1.1-.6 1.8-1.4 2.1.5-2.7-.1-5.8-2.2-7.9Z
    const START: (f32, f32) = (8.6, 1.2);
    const CURVES: [[(f32, f32); 3]; 7] = [
        [(8.9, 3.2), (8.0, 4.3), (7.0, 5.4)],
        [(5.9, 6.6), (4.5, 8.0), (4.5, 10.2)],
        [(4.5, 12.6), (6.2, 14.5), (8.0, 14.5)],
        [(9.8, 14.5), (11.5, 12.9), (11.5, 10.4)],
        [(11.5, 8.9), (10.9, 7.8), (10.2, 7.0)],
        [(10.1, 8.1), (9.6, 8.8), (8.8, 9.1)],
        [(9.3, 6.4), (8.7, 3.3), (6.6, 1.2)],
    ];
    if color.a <= 0.001 {
        return;
    }
    let unit = bounds.size.width.min(bounds.size.height).as_f32() / 16.0 * scale;
    let center = bounds.center();
    let map = |(x, y): (f32, f32)| {
        point(
            center.x + px((x - 8.0) * unit),
            center.y + px((y - 8.0) * unit),
        )
    };
    let mut builder = PathBuilder::fill();
    builder.move_to(map(START));
    for [c1, c2, to] in CURVES {
        builder.cubic_bezier_to(map(to), map(c1), map(c2));
    }
    builder.close();
    if let Ok(path) = builder.build() {
        window.paint_path(path, color);
    }
}

fn paint_ash(a: &AshFrame, window: &mut Window) {
    let circle = |window: &mut Window, r: f32, color: Hsla| {
        window.paint_quad(quad(
            Bounds::new(
                point(px(a.x - r), px(a.y - r)),
                gpui::size(px(r * 2.0), px(r * 2.0)),
            ),
            Corners::all(px(r)),
            color,
            px(0.0),
            transparent_black(),
            Default::default(),
        ));
    };
    if let Some(glow) = a.glow {
        circle(window, a.size * 2.0, glow);
    }
    let s = a.size;
    let local: &[(f32, f32)] = match a.kind {
        Kind::Circle => {
            circle(window, s, a.color);
            return;
        }
        Kind::Square => &[(-s, -s), (s, -s), (s, s), (-s, s)],
        Kind::Shard => &[
            (0.0, -s),
            (s * 0.55, -s * 0.15),
            (s * 0.35, s),
            (-s * 0.45, s * 0.55),
            (-s * 0.2, -s * 0.35),
        ],
    };
    let (sin, cos) = a.angle.sin_cos();
    let points: Vec<Point<Pixels>> = local
        .iter()
        .map(|&(x, y)| point(px(a.x + x * cos - y * sin), px(a.y + x * sin + y * cos)))
        .collect();
    let mut builder = PathBuilder::fill();
    builder.add_polygon(&points, true);
    if let Ok(path) = builder.build() {
        window.paint_path(path, a.color);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gpui::size;

    #[test]
    fn ash_piles_on_the_button() {
        let bounds = Bounds::new(point(px(270.0), px(147.0)), size(px(100.0), px(36.0)));
        let walls = Wall::colliders(bounds);
        let mut rng = Rng(42);
        let colors = [rgb_a(0x404040, 1.0), rgb_a(0xf97316, 1.0)];
        let mut sim = Sim::spawn(bounds, 80, 110.0, 42.0, &colors, &mut rng);
        for _ in 0..(3.0 / STEP) as usize {
            sim.step(&walls);
        }
        // Some ash comes to rest on top of the button, between the lips.
        let resting = sim
            .ash
            .iter()
            .filter(|a| {
                a.x > 270.0 && a.x < 370.0 && a.y < 147.0 && a.y > 100.0 && a.vy.abs() < 1.0
            })
            .count();
        assert!(resting > 0, "nothing settled on the button");
        // Nothing ends up inside the button.
        for a in &sim.ash {
            assert!(walls[0].distance(a.x, a.y).0 > -1.0);
        }
    }

    #[test]
    fn embers_are_detected() {
        assert!(is_ember(rgb_a(0xf97316, 1.0)));
        assert!(is_ember(rgb_a(0xb91c1c, 1.0)));
        assert!(!is_ember(rgb_a(0xa3a3a3, 1.0)));
    }
}
