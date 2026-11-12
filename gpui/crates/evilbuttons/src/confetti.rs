//! ConfettiButton: the graded dark button with a sparkle that twists on hover
//! and fires a restrained confetti burst on click.
//!
//! The confetti is a native port of `canvas-confetti`'s particle model (the
//! same per-tick physics, wobble, tilt and fade), painted on a deferred,
//! unclipped overlay so it can fly anywhere in the window.

use gpui::{
    App, Bounds, ClickEvent, Context, ElementId, FocusHandle, FontWeight, Hsla, InteractiveElement,
    IntoElement, ParentElement, PathBuilder, PathStyle, Pixels, Point, RenderOnce, SharedString,
    StatefulInteractiveElement, Styled, Task, Window, canvas, deferred, div, point,
    prelude::FluentBuilder, px,
};
use lyon::tessellation::{FillOptions, FillRule};
use std::{cell::Cell, f32::consts::PI, rc::Rc};

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Easing, Instant, Transition};
use crate::surface::{
    PressMotion, ms, paint_focus_ring, paint_graded_surface, rgb_a, scaled_content, surface_text,
};

type CelebrateHandler = Rc<dyn Fn(&mut Window, &mut App)>;

/// Soft neutrals with a few cool accents, so the burst reads as polish, not a party.
const CONFETTI_COLORS: [u32; 6] = [0xfafafa, 0xd4d4d4, 0xa3a3a3, 0x93c5fd, 0xc4b5fd, 0xfcd34d];
/// How long the sparkle stays lit after a burst.
const FIRE_MS: u64 = 420;
/// `canvas-confetti` advances its particles once per 60fps frame.
const TICK: f32 = 1.0 / 60.0;
// The burst options the React component passes to `confetti()`.
const GRAVITY: f32 = 1.1;
const DECAY: f32 = 0.9;
const TICKS: u32 = 160;
const SCALAR: f32 = 0.75;

/// A dark button that fires a confetti burst from itself on every click.
///
/// ```ignore
/// ConfettiButton::new("celebrate")
///     .label("Celebrate")
///     .on_celebrate(|_, _| println!("Celebrated!"))
/// ```
#[derive(IntoElement)]
pub struct ConfettiButton {
    id: ElementId,
    label: SharedString,
    particle_count: usize,
    spread: f32,
    start_velocity: f32,
    colors: Vec<Hsla>,
    icon: bool,
    disabled: bool,
    on_click: Option<ClickHandler>,
    on_celebrate: Option<CelebrateHandler>,
}

impl ConfettiButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: "Continue".into(),
            particle_count: 80,
            spread: 64.0,
            start_velocity: 32.0,
            colors: CONFETTI_COLORS.iter().map(|&c| rgb_a(c, 1.0)).collect(),
            icon: true,
            disabled: false,
            on_click: None,
            on_celebrate: None,
        }
    }

    /// Button label. Defaults to "Continue".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Confetti pieces per burst. Defaults to 80.
    pub fn particle_count(mut self, count: usize) -> Self {
        self.particle_count = count;
        self
    }

    /// Burst spread in degrees. Defaults to 64.
    pub fn spread(mut self, degrees: f32) -> Self {
        self.spread = degrees;
        self
    }

    /// Launch velocity of the burst (`canvas-confetti` units). Defaults to 32.
    pub fn start_velocity(mut self, velocity: f32) -> Self {
        self.start_velocity = velocity;
        self
    }

    /// Confetti colours, cycled across the pieces. Defaults to muted neutrals with soft accents.
    pub fn colors<C: Into<Hsla>>(mut self, colors: impl IntoIterator<Item = C>) -> Self {
        let colors: Vec<Hsla> = colors.into_iter().map(Into::into).collect();
        if !colors.is_empty() {
            self.colors = colors;
        }
        self
    }

    /// Show the leading sparkle icon. Defaults to `true`.
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

    /// Fired after each confetti burst.
    pub fn on_celebrate(mut self, handler: impl Fn(&mut Window, &mut App) + 'static) -> Self {
        self.on_celebrate = Some(Rc::new(handler));
        self
    }
}

/// One piece of confetti, exactly as `canvas-confetti` models it.
#[derive(Clone, Copy)]
struct Fetti {
    x: f32,
    y: f32,
    wobble: f32,
    wobble_speed: f32,
    velocity: f32,
    angle: f32,
    tilt_angle: f32,
    random: f32,
    color: Hsla,
    circle: bool,
    tick: u32,
}

impl Fetti {
    /// One 60fps tick of `canvas-confetti`'s `updateFetti`.
    fn step(&mut self, rng: &mut Rng) {
        self.x += self.angle.cos() * self.velocity;
        self.y += self.angle.sin() * self.velocity + GRAVITY * 3.0;
        self.velocity *= DECAY;
        self.wobble += self.wobble_speed;
        self.tilt_angle += 0.1;
        self.random = rng.next() + 2.0;
        self.tick += 1;
    }

    /// The painted outline: a wobbling quad, or a tilted ellipse for circles.
    fn outline(&self) -> Vec<Point<Pixels>> {
        let wobble_x = self.x + 10.0 * SCALAR * self.wobble.cos();
        let wobble_y = self.y + 10.0 * SCALAR * self.wobble.sin();
        let (tilt_sin, tilt_cos) = self.tilt_angle.sin_cos();
        let x1 = self.x + self.random * tilt_cos;
        let y1 = self.y + self.random * tilt_sin;
        let x2 = wobble_x + self.random * tilt_cos;
        let y2 = wobble_y + self.random * tilt_sin;
        let mut points: Vec<(f32, f32)> = if self.circle {
            let rx = (x2 - x1).abs() * 0.6;
            let ry = (y2 - y1).abs() * 0.6;
            let (rs, rc) = (PI / 10.0 * self.wobble).sin_cos();
            (0..12)
                .map(|i| {
                    let a = i as f32 / 12.0 * PI * 2.0;
                    let (ex, ey) = (rx * a.cos(), ry * a.sin());
                    (self.x + ex * rc - ey * rs, self.y + ex * rs + ey * rc)
                })
                .collect()
        } else {
            vec![(self.x, self.y), (wobble_x, y1), (x2, y2), (x1, wobble_y)]
        };
        // One winding direction for every piece, so a shared non-zero fill never cancels.
        let area: f32 = (0..points.len())
            .map(|i| {
                let (a, b) = (points[i], points[(i + 1) % points.len()]);
                a.0 * b.1 - b.0 * a.1
            })
            .sum();
        if area < 0.0 {
            points.reverse();
        }
        points
            .into_iter()
            .map(|(x, y)| point(px(x), px(y)))
            .collect()
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

struct ConfettiState {
    motion: PressMotion,
    firing: bool,
    fire_task: Option<Task<()>>,
    /// Sparkle: rotation (deg), scale, hover mix and fire mix, all on the springy curve.
    icon_rotate: Transition,
    icon_scale: Transition,
    icon_hover: Transition,
    icon_fire: Transition,
    fetti: Vec<Fetti>,
    /// Simulation clock: time already simulated up to, in whole ticks.
    last_step: Instant,
    backlog: f32,
    rng: Rng,
    bounds: Rc<Cell<Option<Bounds<Pixels>>>>,
    focus: FocusHandle,
}

impl ConfettiState {
    fn retarget_icon(&mut self) {
        let springy = |t: &mut Transition, to: f32| {
            t.animate_to(to, ms(300), Easing::SPRINGY);
        };
        let (hovered, firing) = (self.motion.hovered, self.firing);
        springy(
            &mut self.icon_rotate,
            if firing {
                45.0
            } else if hovered {
                12.0
            } else {
                0.0
            },
        );
        springy(&mut self.icon_scale, if firing { 1.25 } else { 1.0 });
        springy(&mut self.icon_hover, if hovered { 1.0 } else { 0.0 });
        springy(&mut self.icon_fire, if firing { 1.0 } else { 0.0 });
    }

    /// `canvas-confetti`'s `randomPhysics` for each piece, from the button's upper third.
    fn burst(&mut self, count: usize, spread: f32, start_velocity: f32, colors: &[Hsla]) {
        let Some(bounds) = self.bounds.get() else {
            return;
        };
        let x = (bounds.origin.x + bounds.size.width * 0.5).as_f32();
        let y = (bounds.origin.y + bounds.size.height / 3.0).as_f32();
        let rad_angle = 90f32.to_radians();
        let rad_spread = spread.to_radians();
        if self.fetti.is_empty() {
            self.last_step = Instant::now();
            self.backlog = 0.0;
        }
        for i in (0..count).rev() {
            let rng = &mut self.rng;
            let fetti = Fetti {
                x,
                y,
                wobble: rng.next() * 10.0,
                wobble_speed: (rng.next() * 0.1 + 0.05).min(0.11),
                velocity: start_velocity * 0.5 + rng.next() * start_velocity,
                angle: -rad_angle + (0.5 * rad_spread - rng.next() * rad_spread),
                tilt_angle: (rng.next() * 0.5 + 0.25) * PI,
                random: rng.next() + 2.0,
                color: colors[i % colors.len()],
                circle: rng.next() < 0.5,
                tick: 0,
            };
            self.fetti.push(fetti);
        }
    }

    /// Advances the simulation to `now` in fixed 60fps ticks.
    fn advance(&mut self, now: Instant) {
        if self.fetti.is_empty() {
            return;
        }
        let elapsed = now.saturating_duration_since(self.last_step).as_secs_f32();
        self.last_step = now;
        self.backlog = (self.backlog + elapsed).min(0.25);
        while self.backlog >= TICK {
            self.backlog -= TICK;
            for fetti in &mut self.fetti {
                fetti.step(&mut self.rng);
            }
            self.fetti.retain(|f| f.tick < TICKS);
        }
    }
}

impl Pressable for ConfettiState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        let changed = self.motion.set_hovered(hovered);
        if changed {
            self.retarget_icon();
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

impl RenderOnce for ConfettiButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<ConfettiState>| {
                ConfettiState {
                    motion: PressMotion::new(),
                    firing: false,
                    fire_task: None,
                    icon_rotate: Transition::new(0.0),
                    icon_scale: Transition::new(1.0),
                    icon_hover: Transition::new(0.0),
                    icon_fire: Transition::new(0.0),
                    fetti: Vec::new(),
                    last_step: Instant::now(),
                    backlog: 0.0,
                    rng: Rng::seeded(),
                    bounds: Rc::new(Cell::new(None)),
                    focus: cx.focus_handle().tab_stop(true),
                }
            });

        let now = Instant::now();
        let (frame, icon, pieces, bounds_cell, focus, animating) = state.update(cx, |s, _| {
            s.advance(now);
            let frame = s.motion.frame(now);
            let icon = (
                s.icon_rotate.value(now),
                s.icon_scale.value(now),
                s.icon_hover.value(now).clamp(0.0, 1.0),
                s.icon_fire.value(now).clamp(0.0, 1.0),
            );
            let pieces: Vec<(Hsla, Vec<Point<Pixels>>)> = s
                .fetti
                .iter()
                .map(|f| {
                    let progress = f.tick as f32 / TICKS as f32;
                    (f.color.opacity(1.0 - progress), f.outline())
                })
                .collect();
            let animating = frame.animating
                || !s.fetti.is_empty()
                || s.icon_rotate.is_animating(now)
                || s.icon_scale.is_animating(now)
                || s.icon_hover.is_animating(now)
                || s.icon_fire.is_animating(now);
            (
                frame,
                icon,
                pieces,
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
        let (rotate, scale, hover_mix, fire_mix) = icon;
        // text-neutral-50/45 → hover /75 → firing amber-200.
        let rest = rgb_a(0xfafafa, 0.45);
        let icon_color = mix(
            mix(rest, rgb_a(0xfafafa, 0.75), hover_mix),
            rgb_a(0xfde68a, 1.0),
            fire_mix,
        );

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
                        paint_graded_surface(bounds, frame, radius, window);
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
                                    move |bounds, _, window, _| {
                                        paint_sparkle(bounds, rotate, scale, icon_color, window);
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
            // Confetti overlay: painted last and unclipped, in window coordinates.
            .when(!pieces.is_empty(), |el| {
                el.child(
                    deferred(
                        canvas(
                            |_, _, _| {},
                            move |_, _, window, _| {
                                for (color, outline) in &pieces {
                                    let mut builder =
                                        PathBuilder::fill().with_style(PathStyle::Fill(
                                            FillOptions::default()
                                                .with_fill_rule(FillRule::NonZero),
                                        ));
                                    builder.add_polygon(outline, true);
                                    if let Ok(path) = builder.build() {
                                        window.paint_path(path, *color);
                                    }
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
        let on_celebrate = self.on_celebrate.clone();
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
                s.burst(count, spread, velocity, &colors);
                s.firing = true;
                s.retarget_icon();
                s.fire_task = Some(cx.spawn(async move |this, cx| {
                    cx.background_executor().timer(ms(FIRE_MS)).await;
                    this.update(cx, |s, cx| {
                        s.firing = false;
                        s.retarget_icon();
                        cx.notify();
                    })
                    .ok();
                }));
                cx.notify();
            });
            if let Some(handler) = on_celebrate.as_ref() {
                handler(window, cx);
            }
        })
    }
}

/// Linear mix of two colours in RGBA space (what a CSS colour transition does).
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

/// The two-star sparkle glyph (16-unit grid), filled, rotated and scaled about its centre.
fn paint_sparkle(
    bounds: Bounds<Pixels>,
    rotate: f32,
    scale: f32,
    color: Hsla,
    window: &mut Window,
) {
    // M8 1.5c.3 2.9 1.6 4.2 4.5 4.5-2.9.3-4.2 1.6-4.5 4.5-.3-2.9-1.6-4.2-4.5-4.5 2.9-.3 4.2-1.6 4.5-4.5Z
    // M12.5 10c.15 1.3.7 1.85 2 2-1.3.15-1.85.7-2 2-.15-1.3-.7-1.85-2-2 1.3-.15 1.85-.7 2-2Z
    type Star = ((f32, f32), [[(f32, f32); 3]; 4]);
    const STARS: [Star; 2] = [
        (
            (8.0, 1.5),
            [
                [(8.3, 4.4), (9.6, 5.7), (12.5, 6.0)],
                [(9.6, 6.3), (8.3, 7.6), (8.0, 10.5)],
                [(7.7, 7.6), (6.4, 6.3), (3.5, 6.0)],
                [(6.4, 5.7), (7.7, 4.4), (8.0, 1.5)],
            ],
        ),
        (
            (12.5, 10.0),
            [
                [(12.65, 11.3), (13.2, 11.85), (14.5, 12.0)],
                [(13.2, 12.15), (12.65, 12.7), (12.5, 14.0)],
                [(12.35, 12.7), (11.8, 12.15), (10.5, 12.0)],
                [(11.8, 11.85), (12.35, 11.3), (12.5, 10.0)],
            ],
        ),
    ];
    if color.a <= 0.001 {
        return;
    }
    let unit = bounds.size.width.min(bounds.size.height).as_f32() / 16.0 * scale;
    let center = bounds.center();
    let (sin, cos) = rotate.to_radians().sin_cos();
    let map = |(x, y): (f32, f32)| {
        let (dx, dy) = ((x - 8.0) * unit, (y - 8.0) * unit);
        point(
            center.x + px(dx * cos - dy * sin),
            center.y + px(dx * sin + dy * cos),
        )
    };
    let mut builder = PathBuilder::fill();
    for (start, curves) in STARS {
        builder.move_to(map(start));
        for [c1, c2, to] in curves {
            builder.cubic_bezier_to(map(to), map(c1), map(c2));
        }
        builder.close();
    }
    if let Ok(path) = builder.build() {
        window.paint_path(path, color);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fetti_falls_and_expires() {
        let mut rng = Rng(12345);
        let mut state_fetti = Fetti {
            x: 0.0,
            y: 0.0,
            wobble: 0.0,
            wobble_speed: 0.1,
            velocity: 32.0,
            angle: -90f32.to_radians(),
            tilt_angle: 1.0,
            random: 2.5,
            color: rgb_a(0xffffff, 1.0),
            circle: false,
            tick: 0,
        };
        let mut min_y = 0.0_f32;
        for _ in 0..TICKS {
            state_fetti.step(&mut rng);
            min_y = min_y.min(state_fetti.y);
        }
        // Rises a couple of hundred px, then gravity wins.
        assert!(min_y < -150.0 && min_y > -400.0, "apex {min_y}");
        assert!(state_fetti.y > min_y + 100.0);
        assert_eq!(state_fetti.tick, TICKS);
        let r = rng.next();
        assert!((0.0..1.0).contains(&r));
        assert_eq!(state_fetti.outline().len(), 4);
    }
}
