//! DemonicButton: hold to summon. Ridged devil horns rise from behind the
//! button while a particle fire builds into a roar.

use gpui::{
    App, Bounds, BoxShadow, Context, Corners, ElementId, FocusHandle, FontWeight, Hsla,
    InteractiveElement, IntoElement, KeyDownEvent, KeyUpEvent, MouseButton, ParentElement,
    PathBuilder, Pixels, Point, RenderOnce, SharedString, StatefulInteractiveElement, Styled,
    Window, canvas, div, linear_color_stop, linear_gradient, point, prelude::FluentBuilder, px,
    quad, relative, transparent_black,
};
use std::{cell::Cell, rc::Rc};

use crate::interaction::is_activation_key;
use crate::motion::{Duration, Instant};
use crate::surface::{
    PressMotion, ms, paint_focus_ring, paint_graded_surface, rgb_a, scale_bounds, scaled_content,
    surface_text,
};

type SummonHandler = Rc<dyn Fn(&mut Window, &mut App)>;

/// Extra canvas room around the button so flames can spill past its edges.
const FIRE_BLEED_X: f32 = 40.0;
const FIRE_HEIGHT: f32 = 150.0;
/// Charge drains this many times faster than it fills once released.
const DRAIN_RATE: f32 = 2.4;
/// `h-9`.
const BUTTON_HEIGHT: f32 = 36.0;

/// A hold-to-summon button: horns rise and a fire roars as the charge builds.
///
/// ```ignore
/// DemonicButton::new("summon")
///     .label("Corrupt the World")
///     .hold_duration(Duration::from_millis(1800))
///     .on_summon(|_, _| println!("Summoned"))
/// ```
#[derive(IntoElement)]
pub struct DemonicButton {
    id: ElementId,
    label: SharedString,
    hold_duration: Duration,
    disabled: bool,
    on_summon: Option<SummonHandler>,
}

impl DemonicButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: "Summon".into(),
            hold_duration: ms(2200),
            disabled: false,
            on_summon: None,
        }
    }

    /// Button label. Defaults to "Summon".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// How long the hold takes to fully summon. Defaults to 2.2s.
    pub fn hold_duration(mut self, duration: Duration) -> Self {
        self.hold_duration = duration;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired once each time the charge reaches 100%.
    pub fn on_summon(mut self, handler: impl Fn(&mut Window, &mut App) + 'static) -> Self {
        self.on_summon = Some(Rc::new(handler));
        self
    }
}

#[derive(Clone, Copy)]
struct Particle {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    age: f32,
    life: f32,
    size: f32,
    seed: f32,
}

struct DemonicState {
    motion: PressMotion,
    holding: bool,
    progress: f32,
    summoned: bool,
    particles: Vec<Particle>,
    spawn_debt: f32,
    /// Last simulated frame; `None` while idle.
    last: Option<Instant>,
    epoch: Instant,
    rng: u32,
    /// Fire canvas size from the last paint.
    fire_size: Rc<Cell<Option<(f32, f32)>>>,
    focus: FocusHandle,
}

impl DemonicState {
    fn random(&mut self) -> f32 {
        let mut x = self.rng;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.rng = x;
        (x >> 8) as f32 / (1u32 << 24) as f32
    }

    fn start(&mut self) -> bool {
        if self.holding {
            return false;
        }
        self.holding = true;
        self.motion.press();
        self.last.get_or_insert(Instant::now());
        true
    }

    fn stop(&mut self) -> bool {
        if !self.holding {
            return false;
        }
        self.holding = false;
        self.motion.release();
        true
    }

    /// Advances the charge and the fire to `now`. Returns true when the
    /// charge just reached 100%.
    fn step(&mut self, now: Instant, hold: Duration) -> bool {
        let Some(last) = self.last else {
            return false;
        };
        let dt = now.saturating_duration_since(last).as_secs_f32().min(0.05);
        self.last = Some(now);
        let step = dt / hold.as_secs_f32().max(0.001);
        let delta = if self.holding {
            step
        } else {
            -step * DRAIN_RATE
        };
        self.progress = (self.progress + delta).clamp(0.0, 1.0);

        let mut fired = false;
        if self.progress >= 1.0 && !self.summoned {
            self.summoned = true;
            fired = true;
        } else if self.progress < 1.0 && self.summoned {
            self.summoned = false;
        }

        // Flames build slowly, then roar once the demon is summoned.
        let intensity = if self.progress >= 1.0 {
            1.0
        } else {
            self.progress.powf(1.6) * 0.85
        };
        let clock = self.clock(now);
        if let Some((width, height)) = self.fire_size.get() {
            self.simulate(intensity, dt, clock, width, height);
        }
        if !self.holding && self.progress <= 0.0 && self.particles.is_empty() {
            self.last = None;
        }
        fired
    }

    /// Milliseconds since the button mounted (`performance.now()` stand-in).
    fn clock(&self, now: Instant) -> f32 {
        now.saturating_duration_since(self.epoch).as_secs_f32() * 1000.0
    }

    fn simulate(&mut self, intensity: f32, dt: f32, now: f32, width: f32, height: f32) {
        let base_y = height - BUTTON_HEIGHT / 2.0;
        let left = FIRE_BLEED_X + 6.0;
        let right = width - FIRE_BLEED_X - 6.0;
        let center = width / 2.0;

        if intensity > 0.02 {
            self.spawn_debt += dt * (70.0 + 260.0 * intensity);
            while self.spawn_debt >= 1.0 {
                self.spawn_debt -= 1.0;
                // Bias spawns toward the middle so the flame has a body.
                let spread = (self.random() + self.random()) / 2.0;
                let life = 0.45 + self.random() * 0.55 * (0.6 + intensity);
                let particle = Particle {
                    x: left + spread * (right - left),
                    y: base_y + self.random() * 6.0,
                    vx: (self.random() - 0.5) * 18.0,
                    vy: -(35.0 + self.random() * 55.0) * (0.55 + intensity),
                    age: 0.0,
                    life,
                    size: (9.0 + self.random() * 13.0) * (0.55 + 0.6 * intensity),
                    seed: self.random() * 1000.0,
                };
                self.particles.push(particle);
            }
        }

        self.particles.retain_mut(|p| {
            p.age += dt;
            if p.age >= p.life {
                return false;
            }
            // Buoyancy, a gentle pull to the centreline, and turbulent sway.
            p.vy -= 60.0 * dt;
            p.vx += (center - p.x) * 0.9 * dt;
            p.vx += (now * 0.004 + p.seed).sin() * 40.0 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            true
        });
    }
}

/// Blackbody-ish ramp: white-hot core, through orange and red, into smoke.
const FIRE_RAMP: [(f32, [f32; 4]); 6] = [
    (0.0, [255.0, 244.0, 214.0, 1.0]),
    (0.18, [255.0, 196.0, 92.0, 0.95]),
    (0.42, [255.0, 118.0, 38.0, 0.8]),
    (0.68, [206.0, 48.0, 24.0, 0.5]),
    (0.86, [96.0, 24.0, 18.0, 0.22]),
    (1.0, [40.0, 20.0, 20.0, 0.0]),
];
/// The original pre-renders this many sprites along the ramp.
const SPRITE_STEPS: f32 = 24.0;

fn sample_ramp(t: f32) -> [f32; 4] {
    for pair in FIRE_RAMP.windows(2) {
        let ((t0, c0), (t1, c1)) = (pair[0], pair[1]);
        if t <= t1 {
            let k = ((t - t0) / (t1 - t0)).clamp(0.0, 1.0);
            return std::array::from_fn(|i| c0[i] + (c1[i] - c0[i]) * k);
        }
    }
    FIRE_RAMP[FIRE_RAMP.len() - 1].1
}

fn rgba(c: [f32; 4], alpha: f32) -> Hsla {
    gpui::Rgba {
        r: c[0] / 255.0,
        g: c[1] / 255.0,
        b: c[2] / 255.0,
        a: (c[3] * alpha).clamp(0.0, 1.0),
    }
    .into()
}

/// Paints each particle as a soft radial blob: a small disc blurred by a
/// Gaussian shadow approximates the original's radial-gradient sprite
/// (full colour at the centre, 55% at 0.45 r, clear at r).
fn paint_fire(origin: Point<Pixels>, particles: &[Particle], window: &mut Window) {
    // A disc of radius 0.4r blurred with σ = 0.32r peaks at ~54% of its colour.
    const PEAK: f32 = 0.54;
    for p in particles {
        let t = p.age / p.life;
        let radius = p.size * (1.0 - t * 0.55);
        let step = ((t * SPRITE_STEPS).floor() / (SPRITE_STEPS - 1.0)).min(1.0);
        let alpha = ((1.0 - t) * 1.4).min(1.0);
        let color = rgba(sample_ramp(step), alpha / PEAK);
        if color.a <= 0.003 {
            continue;
        }
        let disc = radius * 0.4;
        let bounds = Bounds {
            origin: point(origin.x + px(p.x - disc), origin.y + px(p.y - disc)),
            size: gpui::size(px(disc * 2.0), px(disc * 2.0)),
        };
        window.paint_drop_shadows(
            bounds,
            Corners::all(px(disc)),
            &[BoxShadow {
                color,
                offset: point(px(0.0), px(0.0)),
                blur_radius: px(radius * 0.32),
                spread_radius: px(0.0),
                inset: false,
            }],
        );
    }
}

/// `radial-gradient(120% 90% at 50% 130%, rgb(255 140 50/.55), rgb(200 40 20/.28) 45%,
/// transparent 75%)` at `opacity`, clipped to the rounded button, as 1px rows of
/// piecewise-linear gradient quads.
fn paint_ember_glow(bounds: Bounds<Pixels>, radius: f32, opacity: f32, window: &mut Window) {
    if opacity <= 0.003 {
        return;
    }
    let (x0, y0) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
    let (w, h) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
    let (cx, cy) = (x0 + w * 0.5, y0 + h * 1.3);
    let (rx, ry) = (w * 1.2, h * 0.9);
    let r = radius.min(w * 0.5).min(h * 0.5);
    // Premultiplied interpolation of the stops; transparent keeps the last hue.
    let color_at = |x: f32, y: f32| -> Hsla {
        let d = (((x - cx) / rx).powi(2) + ((y - cy) / ry).powi(2)).sqrt();
        let (rgb, a) = if d <= 0.45 {
            let k = d / 0.45;
            let a = 0.55 + (0.28 - 0.55) * k;
            let pr = |c0: f32, c1: f32| (c0 * 0.55 + (c1 * 0.28 - c0 * 0.55) * k) / a;
            ([pr(255.0, 200.0), pr(140.0, 40.0), pr(50.0, 20.0)], a)
        } else {
            let k = ((d - 0.45) / 0.30).clamp(0.0, 1.0);
            ([200.0, 40.0, 20.0], 0.28 * (1.0 - k))
        };
        rgba([rgb[0], rgb[1], rgb[2], 1.0], a * opacity)
    };
    const SEGMENTS: usize = 10;
    let rows = h.ceil() as usize;
    for row in 0..rows {
        let (top, bottom) = (y0 + row as f32, (y0 + row as f32 + 1.0).min(y0 + h));
        let yc = (top + bottom) * 0.5;
        // Transparent beyond 75% of the ellipse.
        if ((yc - cy) / ry).abs() >= 0.75 {
            continue;
        }
        let dy = if yc < y0 + r {
            y0 + r - yc
        } else if yc > y0 + h - r {
            yc - (y0 + h - r)
        } else {
            0.0
        };
        let inset = r - (r * r - dy * dy).max(0.0).sqrt();
        let (left, right) = (x0 + inset, x0 + w - inset);
        let seg = (right - left) / SEGMENTS as f32;
        for s in 0..SEGMENTS {
            let (a, b) = (left + seg * s as f32, left + seg * (s + 1) as f32);
            let (ca, cb) = (color_at(a, yc), color_at(b, yc));
            if ca.a <= 0.002 && cb.a <= 0.002 {
                continue;
            }
            window.paint_quad(quad(
                Bounds {
                    origin: point(px(a), px(top)),
                    size: gpui::size(px(b - a), px(bottom - top)),
                },
                Corners::default(),
                linear_gradient(90.0, linear_color_stop(ca, 0.0), linear_color_stop(cb, 1.0)),
                px(0.0),
                transparent_black(),
                Default::default(),
            ));
        }
    }
}

impl RenderOnce for DemonicButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let seed = format!("{:?}", self.id)
            .bytes()
            .fold(0x2545_f491_u32, |h, b| h.rotate_left(5) ^ b as u32)
            | 1;
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<DemonicState>| {
                DemonicState {
                    motion: PressMotion::new(),
                    holding: false,
                    progress: 0.0,
                    summoned: false,
                    particles: Vec::new(),
                    spawn_debt: 0.0,
                    last: None,
                    epoch: Instant::now(),
                    rng: seed,
                    fire_size: Rc::new(Cell::new(None)),
                    focus: cx.focus_handle().tab_stop(true),
                }
            });

        let now = Instant::now();
        let hold = self.hold_duration;
        let disabled = self.disabled;
        let (fired, frame, progress, holding, clock, particles, fire_size, live) =
            state.update(cx, |s, _| {
                if disabled {
                    s.stop();
                }
                let fired = s.step(now, hold);
                (
                    fired,
                    s.motion.frame(now),
                    s.progress,
                    s.holding,
                    s.clock(now),
                    s.particles.clone(),
                    s.fire_size.clone(),
                    s.last.is_some(),
                )
            });
        if fired && let Some(handler) = self.on_summon.clone() {
            window.defer(cx, move |window, cx| handler(window, cx));
        }
        let (focus, focus_visible) = {
            let s = state.read(cx);
            (
                s.focus.clone(),
                (s.motion.focus_visible || window.last_input_was_keyboard())
                    && s.focus.is_focused(window),
            )
        };
        if live || frame.animating {
            window.request_animation_frame();
        }

        // Horns, tremble and glow, as the original's `paint(progress, now)`.
        let eased = 1.0 - (1.0 - progress).powi(3);
        let pop = if progress > 0.85 {
            (((progress - 0.85) / 0.15) * std::f32::consts::PI).sin() * 0.06
        } else {
            0.0
        };
        let tremble = if !holding || progress >= 1.0 {
            0.0
        } else {
            progress * progress
        };
        let shake_x = ((clock * 0.09).sin() + (clock * 0.137).sin()) * 1.2 * tremble;
        let shake_y = (clock * 0.113).cos() * 0.8 * tremble;
        let horns = HornPose {
            y: 26.0 * (1.0 - eased),
            scale: 0.55 + 0.45 * eased + pop,
            tilt: 18.0 * (1.0 - eased),
            opacity: (progress * 3.0).min(1.0),
        };
        let flicker = ((clock * 0.021).sin() + (clock * 0.047).sin()) * 0.05;
        let glow = (eased * 0.9 + flicker * eased).clamp(0.0, 1.0);

        let radius = px(10.0);
        let label = self.label.clone();
        let text = surface_text(frame.brightness);

        let mut button = div()
            .id(self.id.clone())
            .relative()
            .left(px(shake_x))
            .top(px(shake_y))
            .flex()
            .flex_none()
            .h(px(BUTTON_HEIGHT))
            .min_w(px(144.0))
            .px(px(20.0))
            .items_center()
            .justify_center()
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
                        // The ember glow is a child of the button, so it scales with it.
                        paint_ember_glow(
                            scale_bounds(bounds, frame.scale),
                            radius.as_f32() * frame.scale,
                            glow,
                            window,
                        );
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            .child(scaled_content(frame.scale, move |s| {
                div()
                    .text_size(px(14.0 * s))
                    .line_height(px(20.0 * s))
                    .whitespace_nowrap()
                    .child(label.clone())
                    .into_any_element()
            }));

        if !self.disabled {
            let down = state.clone();
            let up = state.clone();
            let up_out = state.clone();
            let hover = state.clone();
            let key_down = state.clone();
            let key_up = state.clone();
            let focus_for_down = focus.clone();
            button = button
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
                        s.start();
                        cx.notify();
                    });
                })
                .on_mouse_up(MouseButton::Left, move |_, _, cx| {
                    up.update(cx, |s, cx| {
                        if s.stop() {
                            cx.notify();
                        }
                    });
                })
                .on_mouse_up_out(MouseButton::Left, move |_, _, cx| {
                    up_out.update(cx, |s, cx| {
                        if s.stop() {
                            cx.notify();
                        }
                    });
                })
                .on_key_down(move |event: &KeyDownEvent, _, cx| {
                    if event.is_held || !is_activation_key(event.keystroke.key.as_str()) {
                        return;
                    }
                    cx.stop_propagation();
                    key_down.update(cx, |s, cx| {
                        s.motion.focus_visible = true;
                        s.start();
                        cx.notify();
                    });
                })
                .on_key_up(move |event: &KeyUpEvent, _, cx| {
                    if is_activation_key(event.keystroke.key.as_str()) {
                        key_up.update(cx, |s, cx| {
                            if s.stop() {
                                cx.notify();
                            }
                        });
                    }
                });
        }

        div()
            .relative()
            .flex()
            .flex_none()
            // Fire: bottom edge at the button's centre, 40px of bleed either side.
            .child(
                canvas(
                    move |bounds, _, _| {
                        fire_size.set(Some((
                            bounds.size.width.as_f32(),
                            bounds.size.height.as_f32(),
                        )))
                    },
                    move |bounds, _, window, _| {
                        window.with_content_mask(Some(gpui::ContentMask { bounds }), |window| {
                            paint_fire(bounds.origin, &particles, window)
                        });
                    },
                )
                .absolute()
                .left(px(-FIRE_BLEED_X))
                .right(px(-FIRE_BLEED_X))
                .bottom(relative(0.5))
                .h(px(FIRE_HEIGHT)),
            )
            // Horns, between the fire and the button.
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| paint_horns(bounds, horns, window),
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            .child(button)
    }
}

#[derive(Clone, Copy)]
struct HornPose {
    y: f32,
    scale: f32,
    tilt: f32,
    opacity: f32,
}

/// The horn outline on its 34×66 viewBox: the outer edge sweeps out and up to
/// the tip, the inner edge curls back to the base.
const HORN_CURVES: [[(f32, f32); 3]; 4] = [
    [(6.0, 50.0), (1.5, 33.0), (6.5, 15.0)],
    [(8.0, 9.5), (10.5, 5.0), (13.0, 2.0)],
    [(12.5, 12.0), (15.0, 26.0), (21.0, 38.0)],
    [(24.5, 45.0), (28.5, 53.0), (31.0, 64.0)],
];
const HORN_START: (f32, f32) = (13.0, 64.0);
/// Growth ridges: quadratic curves `(start, control, end)`.
const RIDGES: [[(f32, f32); 3]; 7] = [
    [(3.0, 56.0), (17.0, 50.0), (32.0, 58.0)],
    [(2.0, 48.0), (15.0, 42.0), (28.0, 49.0)],
    [(2.0, 40.0), (13.0, 35.0), (25.0, 41.0)],
    [(2.5, 32.0), (12.0, 28.0), (21.5, 33.0)],
    [(3.5, 25.0), (11.0, 21.5), (18.5, 25.5)],
    [(5.0, 18.0), (10.5, 15.5), (16.0, 18.5)],
    [(7.0, 12.0), (10.5, 10.5), (14.5, 12.5)],
];
/// Body gradient stops (`x1=.5 y1=1 → x2=.2 y2=0` in bounding-box units).
const HORN_BODY: [(f32, u32); 4] = [
    (0.0, 0x1c0907),
    (0.45, 0x4a120d),
    (0.8, 0x8a3a24),
    (1.0, 0xe9d6bf),
];

fn cubic(p0: (f32, f32), c: &[(f32, f32); 3], t: f32) -> (f32, f32) {
    let u = 1.0 - t;
    let f = |a: f32, b: f32, c2: f32, d: f32| {
        u * u * u * a + 3.0 * u * u * t * b + 3.0 * u * t * t * c2 + t * t * t * d
    };
    (
        f(p0.0, c[0].0, c[1].0, c[2].0),
        f(p0.1, c[0].1, c[1].1, c[2].1),
    )
}

fn horn_outline() -> Vec<(f32, f32)> {
    const STEPS: usize = 14;
    let mut points = vec![HORN_START];
    let mut from = HORN_START;
    for curve in &HORN_CURVES {
        for i in 1..=STEPS {
            points.push(cubic(from, curve, i as f32 / STEPS as f32));
        }
        from = curve[2];
    }
    points.pop(); // closes back onto the start
    points
}

fn inside(poly: &[(f32, f32)], (x, y): (f32, f32)) -> bool {
    let mut hit = false;
    let mut j = poly.len() - 1;
    for i in 0..poly.len() {
        let (a, b) = (poly[i], poly[j]);
        if (a.1 > y) != (b.1 > y) && x < (b.0 - a.0) * (y - a.1) / (b.1 - a.1) + a.0 {
            hit = !hit;
        }
        j = i;
    }
    hit
}

/// Clips `subject` to the half-plane `dot(p, n) >= d`.
fn clip_half_plane(subject: &[(f32, f32)], n: (f32, f32), d: f32) -> Vec<(f32, f32)> {
    let side = |p: (f32, f32)| p.0 * n.0 + p.1 * n.1 - d;
    let mut out = Vec::with_capacity(subject.len() + 2);
    for i in 0..subject.len() {
        let cur = subject[i];
        let prev = subject[(i + subject.len() - 1) % subject.len()];
        let (sc, sp) = (side(cur), side(prev));
        if (sc >= 0.0) != (sp >= 0.0) {
            let t = sp / (sp - sc);
            out.push((prev.0 + (cur.0 - prev.0) * t, prev.1 + (cur.1 - prev.1) * t));
        }
        if sc >= 0.0 {
            out.push(cur);
        }
    }
    out
}

fn hex(c: u32) -> [f32; 3] {
    [
        ((c >> 16) & 0xff) as f32,
        ((c >> 8) & 0xff) as f32,
        (c & 0xff) as f32,
    ]
}

fn body_color(t: f32) -> [f32; 3] {
    for pair in HORN_BODY.windows(2) {
        let ((t0, c0), (t1, c1)) = (pair[0], pair[1]);
        if t <= t1 {
            let k = ((t - t0) / (t1 - t0)).clamp(0.0, 1.0);
            let (a, b) = (hex(c0), hex(c1));
            return std::array::from_fn(|i| a[i] + (b[i] - a[i]) * k);
        }
    }
    hex(HORN_BODY[3].1)
}

/// Paints both horns. `wrapper` is the button's layout box.
fn paint_horns(wrapper: Bounds<Pixels>, pose: HornPose, window: &mut Window) {
    if pose.opacity <= 0.001 {
        return;
    }
    let (wx, wy) = (wrapper.origin.x.as_f32(), wrapper.origin.y.as_f32());
    let (ww, wh) = (wrapper.size.width.as_f32(), wrapper.size.height.as_f32());
    // `h-11 w-6`, `bottom-[45%]`, `left-[14%]` / `right-[14%]`, `origin-bottom`.
    let (box_w, box_h) = (24.0, 44.0);
    let box_top = wy + wh * 0.55 - box_h;
    // The SVG's viewBox (34×66) is fitted into the box (`meet`) and centred.
    let k = box_h / 66.0;
    let pad = (box_w - 34.0 * k) * 0.5;
    let outline = horn_outline();
    let (min_x, max_x) = outline.iter().fold((f32::MAX, f32::MIN), |(lo, hi), p| {
        (lo.min(p.0), hi.max(p.0))
    });
    let (min_y, max_y) = outline.iter().fold((f32::MAX, f32::MIN), |(lo, hi), p| {
        (lo.min(p.1), hi.max(p.1))
    });
    let (bw, bh) = (max_x - min_x, max_y - min_y);

    for mirrored in [false, true] {
        let box_left = if mirrored {
            wx + ww * 0.86 - box_w
        } else {
            wx + ww * 0.14
        };
        let angle = if mirrored { pose.tilt } else { -pose.tilt }.to_radians();
        let (sin, cos) = angle.sin_cos();
        let to_screen = move |(u, v): (f32, f32)| -> Point<Pixels> {
            let mut x = pad + u * k;
            if mirrored {
                x = box_w - x;
            }
            let y = v * k;
            // translateY(y) rotate(tilt) scale(s) about the box's bottom centre.
            let (ox, oy) = ((x - box_w * 0.5) * pose.scale, (y - box_h) * pose.scale);
            let (rx, ry) = (ox * cos - oy * sin, ox * sin + oy * cos);
            point(
                px(box_left + box_w * 0.5 + rx),
                px(box_top + box_h + ry + pose.y),
            )
        };
        let fill = |poly: &[(f32, f32)], color: Hsla, window: &mut Window| {
            if poly.len() < 3 || color.a <= 0.001 {
                return;
            }
            let points: Vec<Point<Pixels>> = poly.iter().map(|&p| to_screen(p)).collect();
            let mut builder = PathBuilder::fill();
            builder.add_polygon(&points, true);
            if let Ok(path) = builder.build() {
                window.paint_path(path, color);
            }
        };
        let solid = |c: [f32; 3], a: f32| rgba([c[0], c[1], c[2], 1.0], a * pose.opacity);

        // Body: the 4-stop gradient as thin bands across its axis. In bounding-box
        // units the axis runs from (.5, 1) to (.2, 0).
        let axis = (-0.3_f32, -1.0_f32);
        // Band edges are lines of constant t; map the unit-space normal to viewBox units.
        let normal = (axis.0 / bw, axis.1 / bh);
        let offset_for = |t: f32| {
            // dot(p, normal) at a point with gradient parameter t.
            let (u, v) = (0.5 + axis.0 * t, 1.0 + axis.1 * t);
            let (x, y) = (min_x + u * bw, min_y + v * bh);
            x * normal.0 + y * normal.1
        };
        const BANDS: usize = 22;
        // Paint the darkest base under everything so band seams never show the page.
        fill(&outline, solid(body_color(0.0), 1.0), window);
        for band in 0..BANDS {
            let (t0, t1) = (band as f32 / BANDS as f32, (band + 1) as f32 / BANDS as f32);
            let lo = clip_half_plane(&outline, normal, offset_for(t0));
            let poly = clip_half_plane(&lo, (-normal.0, -normal.1), -offset_for(t1));
            let tm = if band == BANDS - 1 {
                1.0
            } else {
                (t0 + t1) * 0.5
            };
            fill(&poly, solid(body_color(tm), 1.0), window);
        }
        // Shade: white .18 → 0 over the left 35%, black 0 → .45 over the right 25%.
        const SHADE_STRIPS: usize = 6;
        for i in 0..SHADE_STRIPS {
            let (a, b) = (
                0.35 * i as f32 / SHADE_STRIPS as f32,
                0.35 * (i + 1) as f32 / SHADE_STRIPS as f32,
            );
            let poly = clip_half_plane(&outline, (1.0, 0.0), min_x + a * bw);
            let poly = clip_half_plane(&poly, (-1.0, 0.0), -(min_x + b * bw));
            let alpha = 0.18 * (1.0 - (a + b) * 0.5 / 0.35);
            fill(&poly, solid([255.0; 3], alpha), window);
            let (a, b) = (
                0.75 + 0.25 * i as f32 / SHADE_STRIPS as f32,
                0.75 + 0.25 * (i + 1) as f32 / SHADE_STRIPS as f32,
            );
            let poly = clip_half_plane(&outline, (1.0, 0.0), min_x + a * bw);
            let poly = clip_half_plane(&poly, (-1.0, 0.0), -(min_x + b * bw));
            let alpha = 0.45 * (((a + b) * 0.5 - 0.75) / 0.25);
            fill(&poly, solid([0.0; 3], alpha), window);
        }

        // Ridges and the highlight, clipped to the horn.
        let stroke = |samples: Vec<(f32, f32)>, width: f32, color: Hsla, window: &mut Window| {
            let mut run: Vec<Point<Pixels>> = Vec::new();
            let flush = |run: &mut Vec<Point<Pixels>>, window: &mut Window| {
                if run.len() >= 2 {
                    let mut builder = PathBuilder::stroke(px(width * k * pose.scale));
                    builder.move_to(run[0]);
                    for p in &run[1..] {
                        builder.line_to(*p);
                    }
                    if let Ok(path) = builder.build() {
                        window.paint_path(path, color);
                    }
                }
                run.clear();
            };
            for p in samples {
                if inside(&outline, p) {
                    run.push(to_screen(p));
                } else {
                    flush(&mut run, window);
                }
            }
            flush(&mut run, window);
        };
        for [a, c, b] in RIDGES {
            let samples = (0..=24)
                .map(|i| {
                    let t = i as f32 / 24.0;
                    let u = 1.0 - t;
                    (
                        u * u * a.0 + 2.0 * u * t * c.0 + t * t * b.0,
                        u * u * a.1 + 2.0 * u * t * c.1 + t * t * b.1,
                    )
                })
                .collect();
            stroke(samples, 0.9, solid([0.0; 3], 0.38), window);
        }
        let highlight = [(4.0, 44.0), (3.0, 30.0), (7.5, 16.0)];
        let samples = (0..=24)
            .map(|i| cubic((8.0, 58.0), &highlight, i as f32 / 24.0))
            .collect();
        stroke(samples, 1.2, solid([255.0, 217.0, 184.0], 0.28), window);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ramp_endpoints() {
        assert_eq!(sample_ramp(0.0), FIRE_RAMP[0].1);
        assert_eq!(sample_ramp(1.0)[3], 0.0);
    }

    #[test]
    fn horn_outline_is_closed_shape() {
        let outline = horn_outline();
        assert!(inside(&outline, (13.0, 40.0)));
        assert!(!inside(&outline, (30.0, 10.0)));
    }
}
