//! ThrusterButton: a button that rests on the floor of its playground, flies to
//! the cursor on compressed-air jets (trailing smoke), and lands when it leaves.
//!
//! The React original runs a WebGL2 fluid solver for the smoke. GPUI has no
//! custom shaders, so the smoke here is a particle field: every jet vents soft
//! puffs that are carried by the jet, slowed by drag, curled by a swirling
//! velocity field, rolled along the floor, and faded at the solver's dye
//! dissipation rate. The flight controller is a straight port.

use gpui::{
    App, Bounds, BoxShadow, ClickEvent, Context, Corners, ElementId, FocusHandle, FontWeight, Hsla,
    InteractiveElement, IntoElement, MouseButton, MouseMoveEvent, ParentElement, PathBuilder,
    Pixels, Point, RenderOnce, SharedString, StatefulInteractiveElement, Styled, TextRun, Window,
    WindowAppearance, canvas, div, point, prelude::FluentBuilder, px,
};
use std::{cell::Cell, f32::consts::PI, rc::Rc};

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Instant, Spring, SpringConfig};
use crate::surface::rgb_a;

// Autopilot gains: a slightly underdamped spring, so the craft overshoots the
// pointer and fires its opposite jets to brake.
const KP: f32 = 90.0;
const KD: f32 = 2.0 * 0.55 * 9.486_833; // 2 · 0.55 · √KP
// There are no top jets, so the craft descends by easing off the bottom ones.
const GRAVITY: f32 = 1100.0;
// Jet visuals are scaled against this fixed force, not `thrust`.
const FULL_BLAST: f32 = 3200.0;
// Valve chatter in px at full blast.
const RUMBLE: f32 = 0.35;
// Nozzle length in px; gas leaves from its mouth.
const NOZZLE: f32 = 5.0;
// Bottom pair sits this far in from the corners; side pairs this far from the middle.
const BOTTOM_INSET: f32 = 14.0;
const SIDE_SPREAD: f32 = 8.0;
// Gap kept between the craft and the playground walls.
const WALL_GAP: f32 = 2.0;
// How long the smoke keeps drifting after the craft docks.
const LINGER: f32 = 2.2;
// Smoke: dye fades as 1 / (1 + 1.5·dt) per step in the solver.
const DYE_DISSIPATION: f32 = 1.5;
const MAX_PUFFS: usize = 1400;
const CRAFT_HEIGHT: f32 = 36.0;
const RADIUS: f32 = 6.0;

const TILT_SPRING: SpringConfig = SpringConfig::new(220.0, 18.0);
const TAP_SPRING: SpringConfig = SpringConfig::new(400.0, 22.0);

/// A button that flies to the cursor on air jets inside its playground.
///
/// It fills its parent, which becomes the playground: give it a sized container.
///
/// ```ignore
/// div().relative().w_full().h(px(320.0)).child(
///     ThrusterButton::new("launch", "Launch").on_click(|_, _, _| launch()),
/// )
/// ```
#[derive(IntoElement)]
pub struct ThrusterButton {
    id: ElementId,
    label: SharedString,
    thrust: f32,
    tilt: f32,
    dark: Option<bool>,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl ThrusterButton {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            thrust: 3200.0,
            tilt: 10.0,
            dark: None,
            disabled: false,
            on_click: None,
        }
    }

    /// Net jet acceleration in px/s². Lower values drift, higher values snap. Defaults to 3200.
    pub fn thrust(mut self, thrust: f32) -> Self {
        self.thrust = thrust;
        self
    }

    /// Maximum bank in degrees while the craft accelerates sideways. Defaults to 10.
    pub fn tilt(mut self, tilt: f32) -> Self {
        self.tilt = tilt;
        self
    }

    /// Use the dark-theme colours (button, valves and smoke). Defaults to the
    /// window's appearance.
    pub fn dark(mut self, dark: bool) -> Self {
        self.dark = Some(dark);
        self
    }

    /// Keeps the craft parked and ignores input.
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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Mode {
    Landed,
    Flying,
    Landing,
}

#[derive(Clone, Copy, Debug)]
struct Puff {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    /// Smoke density; fades at the dye dissipation rate.
    density: f32,
    age: f32,
    /// Base radius in px; puffs spread as they age.
    radius: f32,
    /// Swirl rate (rad/s); puffs of one stream share it, so the stream curls.
    spin: f32,
    /// Puffs vented in one uninterrupted stream share a chain and are drawn
    /// as a connected strand.
    chain: u32,
}

/// xorshift32: tiny, deterministic, good enough for sputter and smoke.
struct Rng(u32);

impl Rng {
    fn next(&mut self) -> f32 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        (x >> 8) as f32 / (1u32 << 24) as f32
    }
    fn range(&mut self, lo: f32, hi: f32) -> f32 {
        lo + (hi - lo) * self.next()
    }
}

#[derive(Clone, Copy, Default)]
struct Jets {
    left: f32,
    right: f32,
    bottom: f32,
}

struct ThrusterState {
    mode: Mode,
    pos: (f32, f32),
    vel: (f32, f32),
    target: (f32, f32),
    /// Displayed offset (position plus valve rumble).
    shown: (f32, f32),
    jets: Jets,
    rotate: Spring,
    tap: Spring,
    pressed: bool,
    focus_visible: bool,
    last: Option<Instant>,
    lingering: f32,
    touchdown: bool,
    sim_time: f32,
    puffs: Vec<Puff>,
    /// Current stream per nozzle (0 = not firing last frame).
    chains: [u32; 6],
    /// Each nozzle's mouth at the previous step, while it fires.
    mouths: [Option<(f32, f32)>; 6],
    next_chain: u32,
    rng: Rng,
    /// Playground bounds and craft half-size, measured at paint.
    playground: Rc<Cell<Option<Bounds<Pixels>>>>,
    half: Rc<Cell<(f32, f32)>>,
    thrust: f32,
    tilt: f32,
    focus: FocusHandle,
}

fn jet_power(force: f32, max: f32) -> f32 {
    if force <= max * 0.03 {
        return 0.0;
    }
    (force / max).min(1.0).powf(0.7)
}

/// A swirling, divergence-free velocity field (curl of a sum of waves), in px/s.
fn swirl(x: f32, y: f32, t: f32) -> (f32, f32) {
    // ψ = sin(ax + t)·cos(by − 0.7t) + 0.6·sin(c(x + y) + 1.3t); v = (∂ψ/∂y, −∂ψ/∂x).
    let (a, b, c) = (0.045, 0.05, 0.03);
    let s1 = (a * x + t).sin();
    let c1 = (a * x + t).cos();
    let s2 = (b * y - 0.7 * t).sin();
    let c2 = (b * y - 0.7 * t).cos();
    let c3 = (c * (x + y) + 1.3 * t).cos();
    let dpsi_dy = -b * s1 * s2 + 0.6 * c * c3;
    let dpsi_dx = a * c1 * c2 + 0.6 * c * c3;
    let amp = 900.0;
    (dpsi_dy * amp, -dpsi_dx * amp)
}

impl ThrusterState {
    fn size(&self) -> Option<(f32, f32)> {
        self.playground
            .get()
            .map(|b| (b.size.width.as_f32(), b.size.height.as_f32()))
    }

    /// How far the craft can travel from its pad before touching a wall.
    fn reach(&self, width: f32, height: f32) -> (f32, f32) {
        let (half_w, half_h) = self.half.get();
        let reach_x = (width / 2.0 - half_w - NOZZLE - WALL_GAP).max(0.0);
        let ceiling = (-(height - NOZZLE - half_h * 2.0 - WALL_GAP)).min(0.0);
        (reach_x, ceiling)
    }

    fn pointer(&mut self, position: Point<Pixels>) -> bool {
        let Some(bounds) = self.playground.get() else {
            return false;
        };
        let (width, height) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
        let x = (position.x - bounds.origin.x).as_f32();
        let y = (position.y - bounds.origin.y).as_f32();
        if x < 0.0 || y < 0.0 || x > width || y > height {
            return self.land();
        }
        let (reach_x, ceiling) = self.reach(width, height);
        let half_h = self.half.get().1;
        // Fly the craft's centre onto the pointer, as far as the walls allow.
        self.target = (
            (x - width / 2.0).clamp(-reach_x, reach_x),
            (y - (height - NOZZLE - half_h)).clamp(ceiling, 0.0),
        );
        self.mode = Mode::Flying;
        true
    }

    fn land(&mut self) -> bool {
        if self.mode != Mode::Flying {
            return false;
        }
        // Come straight down from wherever it is.
        self.mode = Mode::Landing;
        self.target = (self.pos.0, 0.0);
        true
    }

    fn cut_jets(&mut self) {
        self.jets = Jets::default();
        self.rotate.set_target(0.0);
    }

    fn animating(&self) -> bool {
        self.mode != Mode::Landed
            || self.lingering > 0.0
            || !self.puffs.is_empty()
            || !self.rotate.is_settled()
            || !self.tap.is_settled()
    }

    /// Advances flight and smoke to `now`.
    fn step(&mut self, now: Instant) {
        let elapsed = match self.last {
            Some(last) => now.saturating_duration_since(last).as_secs_f32().min(0.1),
            None => 1.0 / 60.0,
        };
        self.last = Some(now);
        if elapsed <= 0.0 {
            return;
        }
        // Slow frames are split into ≤1/60s substeps, so the flight keeps real time.
        let steps = (elapsed * 60.0).ceil().max(1.0);
        for _ in 0..steps as usize {
            self.substep(elapsed / steps);
        }
    }

    fn substep(&mut self, dt: f32) {
        let Some((width, height)) = self.size() else {
            return;
        };
        self.sim_time += dt;
        let (half_w, half_h) = self.half.get();
        let side_thrust = self.thrust.max(1.0);
        // The bottom jets also carry the craft's weight.
        let lift_thrust = side_thrust + GRAVITY;

        if self.touchdown {
            self.touchdown = false;
            // Trapped air bursts out sideways from under the craft as it settles.
            let cx = width / 2.0 + self.pos.0;
            for side in [-1.0_f32, 1.0] {
                for reach in [0.4_f32, 1.0] {
                    let chain = self.new_chain();
                    for k in 0..8 {
                        let speed = 600.0 - 40.0 * k as f32 + self.rng.range(-30.0, 30.0);
                        let puff = Puff {
                            x: cx + side * half_w * reach,
                            y: height - self.rng.range(1.0, 4.0),
                            vx: side * speed,
                            vy: -speed * self.rng.range(0.05, 0.2),
                            density: 0.55,
                            age: 0.0,
                            radius: self.rng.range(3.0, 5.0),
                            spin: -side * self.rng.range(2.0, 3.0),
                            chain,
                        };
                        self.emit(puff);
                    }
                }
            }
        }

        if self.mode != Mode::Landed {
            let (reach_x, ceiling) = self.reach(width, height);
            let (px_, py_) = self.pos;
            let (vx, vy) = self.vel;
            let want_x = KP * (self.target.0 - px_) - KD * vx;
            let mut want_y = KP * (self.target.1 - py_) - KD * vy;
            // Only gravity can stop a climb, so cut lift once the craft would
            // need all of it to stop in the height that's left.
            if vy < 0.0 {
                let stopping = vy * vy / (2.0 * GRAVITY * 0.7);
                if stopping >= py_ - self.target.1 {
                    want_y = want_y.max(GRAVITY * 0.7);
                }
            }
            let side_force = want_x.clamp(-side_thrust, side_thrust);
            // Thrusting up is negative y; the jets can only push, never pull.
            let lift_force = (GRAVITY - want_y).clamp(0.0, lift_thrust);

            self.vel.0 += side_force * dt;
            self.vel.1 += (GRAVITY - lift_force) * dt;
            self.pos.0 += self.vel.0 * dt;
            self.pos.1 += self.vel.1 * dt;

            // Walls and ceiling knock it back; the floor soaks up most of the hit.
            if self.pos.0.abs() > reach_x {
                self.pos.0 = self.pos.0.signum() * reach_x;
                self.vel.0 *= -0.35;
            }
            if self.pos.1 < ceiling {
                self.pos.1 = ceiling;
                self.vel.1 *= -0.35;
            }
            if self.pos.1 > 0.0 {
                self.pos.1 = 0.0;
                if self.vel.1 > 0.0 {
                    self.vel.1 *= -0.2;
                }
                self.vel.0 *= 0.85;
            }

            if self.mode == Mode::Landing && self.pos.1 > -0.5 && self.vel.0.hypot(self.vel.1) < 8.0
            {
                // Touched down: valves shut and the smoke is left to drift.
                self.mode = Mode::Landed;
                self.lingering = LINGER;
                self.touchdown = true;
                self.pos.1 = 0.0;
                self.vel = (0.0, 0.0);
                self.shown = self.pos;
                self.cut_jets();
            } else {
                // Pushing right means the left jets fire, and so on.
                let jets = Jets {
                    left: jet_power(side_force, FULL_BLAST),
                    right: jet_power(-side_force, FULL_BLAST),
                    bottom: jet_power(lift_force, FULL_BLAST + GRAVITY),
                };
                self.jets = jets;
                self.rotate
                    .set_target((side_force / FULL_BLAST).clamp(-1.0, 1.0) * self.tilt);
                let blast = jets.left.max(jets.right).max(jets.bottom) * RUMBLE;
                self.shown = (
                    self.pos.0 + (self.rng.next() - 0.5) * blast,
                    (self.pos.1 + (self.rng.next() - 0.5) * blast).min(0.0),
                );
                self.vent(jets, dt, width, height, half_w, half_h);
            }
        } else {
            self.lingering -= dt;
        }

        self.advance_smoke(dt, width, height);
        if self.mode == Mode::Landed && self.lingering <= 0.0 {
            self.lingering = 0.0;
            self.puffs.clear();
        }
    }

    fn new_chain(&mut self) -> u32 {
        let chain = self.next_chain;
        self.next_chain = self.next_chain.wrapping_add(1).max(1);
        chain
    }

    fn emit(&mut self, puff: Puff) {
        if self.puffs.len() >= MAX_PUFFS {
            self.puffs.remove(0);
        }
        self.puffs.push(puff);
    }

    /// Vents smoke from every firing nozzle's mouth.
    fn vent(&mut self, jets: Jets, dt: f32, width: f32, height: f32, half_w: f32, half_h: f32) {
        let center = (
            width / 2.0 + self.pos.0,
            height - NOZZLE - half_h + self.pos.1,
        );
        let angle = self.rotate.value(Instant::now()).to_radians();
        let (cos, sin) = (angle.cos(), angle.sin());
        let mouths = [
            (
                jets.bottom,
                -half_w + BOTTOM_INSET,
                half_h + NOZZLE,
                0.0,
                1.0,
            ),
            (
                jets.bottom,
                half_w - BOTTOM_INSET,
                half_h + NOZZLE,
                0.0,
                1.0,
            ),
            (jets.left, -half_w - NOZZLE, -SIDE_SPREAD, -1.0, 0.0),
            (jets.left, -half_w - NOZZLE, SIDE_SPREAD, -1.0, 0.0),
            (jets.right, half_w + NOZZLE, -SIDE_SPREAD, 1.0, 0.0),
            (jets.right, half_w + NOZZLE, SIDE_SPREAD, 1.0, 0.0),
        ];
        for (index, (power, mx, my, dx, dy)) in mouths.into_iter().enumerate() {
            if power <= 0.0 {
                self.chains[index] = 0;
                self.mouths[index] = None;
                continue;
            }
            if self.chains[index] == 0 {
                self.chains[index] = self.new_chain();
            }
            let chain = self.chains[index];
            // The stream's curl drifts back and forth, rolling it into S-curves.
            let phase = chain as f32 * 1.7 + index as f32;
            let curl = 4.0 * (self.sim_time * 2.3 + phase).sin();
            let (ex, ey) = (dx * cos - dy * sin, dx * sin + dy * cos);
            let mouth = (
                center.0 + mx * cos - my * sin,
                center.1 + mx * sin + my * cos,
            );
            // Valves sputter a little, so paired jets never look identical. The
            // sputter drifts smoothly, so a stream's puffs stay in order.
            let t = self.sim_time;
            let sputter = 1.0 + 0.25 * (t * 9.0 + phase * 2.1).sin() * (t * 3.7 + phase).cos();
            let speed = (380.0 + 520.0 * power) * sputter * 0.5;
            // A puff every few px of travel, so streams stay continuous at any frame rate.
            // The mouth moved with the craft since the last step: spawn along that
            // path too, so a moving jet leaves an unbroken trail.
            let from = self.mouths[index].unwrap_or(mouth);
            self.mouths[index] = Some(mouth);
            let travel = (mouth.0 - from.0).hypot(mouth.1 - from.1).max(speed * dt);
            let count = ((travel / 3.0).ceil() as usize).clamp(1, 10);
            for i in 0..count {
                let spread = 0.05 * (t * 5.3 + phase).sin();
                let (sx, sy) = (ex - ey * spread, ey + ex * spread);
                // Older puffs in this step left earlier, so they've gone further.
                let k = (i as f32 + 0.5) / count as f32;
                let lead = (1.0 - k) * speed * dt;
                let base = (
                    from.0 + (mouth.0 - from.0) * k,
                    from.1 + (mouth.1 - from.1) * k,
                );
                let puff = Puff {
                    x: base.0 + sx * lead,
                    y: base.1 + sy * lead,
                    vx: sx * speed + self.vel.0 * 0.3,
                    vy: sy * speed + self.vel.1 * 0.3,
                    density: (power * 0.3 * sputter + 0.12) * 0.55,
                    age: 0.0,
                    radius: self.rng.range(2.5, 3.5),
                    spin: curl,
                    chain,
                };
                self.emit(puff);
            }
        }
    }

    fn advance_smoke(&mut self, dt: f32, width: f32, height: f32) {
        let t = self.sim_time;
        let drag = (-4.5 * dt).exp();
        let fade = 1.0 / (1.0 + DYE_DISSIPATION * dt);
        for puff in &mut self.puffs {
            puff.age += dt;
            puff.density *= fade;
            // The jet's momentum bleeds off; the swirl takes over as it slows.
            puff.vx *= drag;
            puff.vy *= drag;
            let (spin_c, spin_s) = ((puff.spin * dt).cos(), (puff.spin * dt).sin());
            let (vx, vy) = (
                puff.vx * spin_c - puff.vy * spin_s,
                puff.vx * spin_s + puff.vy * spin_c,
            );
            puff.vx = vx;
            puff.vy = vy;
            let calm = (puff.age * 2.0).min(1.0);
            let (wx, wy) = swirl(puff.x, puff.y, t);
            puff.x += (puff.vx + wx * calm) * dt;
            puff.y += (puff.vy + wy * calm) * dt;
            // The floor turns a downward blast into a sideways roll.
            let r = puff.radius;
            if puff.y > height - r {
                puff.y = height - r;
                if puff.vy > 0.0 {
                    let roll = puff.vy * 0.7;
                    puff.vx += if puff.vx.abs() > 1.0 {
                        puff.vx.signum() * roll
                    } else if puff.spin > 0.0 {
                        roll
                    } else {
                        -roll
                    };
                    puff.vy = -puff.vy * 0.1;
                }
            }
            if puff.x < r || puff.x > width - r {
                puff.x = puff.x.clamp(r, width - r);
                puff.vx = -puff.vx * 0.3;
            }
            if puff.y < r {
                puff.y = r;
                puff.vy = -puff.vy * 0.3;
            }
        }
        self.puffs.retain(|p| p.density > 0.01);
    }
}

impl Pressable for ThrusterState {
    fn set_hovered(&mut self, _: bool) -> bool {
        false
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.focus_visible = keyboard;
        self.pressed = true;
        self.tap.set_target(0.95);
        true
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        if !self.pressed {
            return false;
        }
        self.pressed = false;
        self.tap.set_target(1.0);
        true
    }
}

/// Theme colours (shadcn tokens).
#[derive(Clone, Copy)]
struct Palette {
    background: Hsla,
    foreground: Hsla,
    border: Hsla,
    muted: Hsla,
    jet: Hsla,
    smoke: Hsla,
    valve_shade: Hsla,
    ring: Hsla,
    dark: bool,
}

fn palette(dark: bool) -> Palette {
    if dark {
        Palette {
            background: rgb_a(0x0a0a0a, 1.0),
            foreground: rgb_a(0xfafafa, 1.0),
            border: rgb_a(0xffffff, 0.1),
            muted: rgb_a(0x262626, 1.0),
            jet: rgb_a(0xe2e8f0, 0.65),
            smoke: rgb_a(0xe2e8f0, 0.55),
            valve_shade: rgb_a(0x000000, 0.5),
            ring: rgb_a(0x737373, 1.0),
            dark,
        }
    } else {
        Palette {
            background: rgb_a(0xffffff, 1.0),
            foreground: rgb_a(0x0a0a0a, 1.0),
            border: rgb_a(0xe5e5e5, 1.0),
            muted: rgb_a(0xf5f5f5, 1.0),
            jet: rgb_a(0x94a3b8, 0.6),
            smoke: rgb_a(0x94a3b8, 0.6),
            valve_shade: rgb_a(0x000000, 0.12),
            ring: rgb_a(0xa1a1a1, 1.0),
            dark,
        }
    }
}

/// Everything paint needs for one frame.
struct Frame {
    shown: (f32, f32),
    angle: f32,
    tap: f32,
    jets: Jets,
    /// (x, y, radius, alpha, chain), oldest first.
    puffs: Vec<(f32, f32, f32, f32, u32)>,
    focus_visible: bool,
    disabled: bool,
}

impl RenderOnce for ThrusterButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<ThrusterState>| {
                ThrusterState {
                    mode: Mode::Landed,
                    pos: (0.0, 0.0),
                    vel: (0.0, 0.0),
                    target: (0.0, 0.0),
                    shown: (0.0, 0.0),
                    jets: Jets::default(),
                    rotate: Spring::new(0.0, TILT_SPRING),
                    tap: Spring::new(1.0, TAP_SPRING),
                    pressed: false,
                    focus_visible: false,
                    last: None,
                    lingering: 0.0,
                    touchdown: false,
                    sim_time: 0.0,
                    puffs: Vec::new(),
                    chains: [0; 6],
                    mouths: [None; 6],
                    next_chain: 1,
                    rng: Rng(0x9e37_79b9),
                    playground: Rc::new(Cell::new(None)),
                    half: Rc::new(Cell::new((48.0, CRAFT_HEIGHT / 2.0))),
                    thrust: 3200.0,
                    tilt: 10.0,
                    focus: cx.focus_handle().tab_stop(true),
                }
            });

        let dark = self.dark.unwrap_or(matches!(
            window.appearance(),
            WindowAppearance::Dark | WindowAppearance::VibrantDark
        ));
        let colors = palette(dark);
        let now = Instant::now();
        let disabled = self.disabled;
        let (frame, playground_cell, half_cell, focus, animating) = state.update(cx, |s, _| {
            s.thrust = self.thrust;
            s.tilt = self.tilt;
            if disabled && s.mode != Mode::Landed {
                s.mode = Mode::Landed;
                s.pos.1 = 0.0;
                s.vel = (0.0, 0.0);
                s.shown = s.pos;
                s.cut_jets();
            }
            if s.animating() {
                s.step(now);
            } else {
                s.last = None;
            }
            // Fade the last of the smoke out before it clears.
            let fade = if s.mode == Mode::Landed {
                (s.lingering / 1.2).clamp(0.0, 1.0)
            } else {
                1.0
            };
            let puffs = s
                .puffs
                .iter()
                .map(|p| {
                    let radius = p.radius + 5.0 * (p.age * 1.5).sqrt();
                    let alpha = (1.0 - (-p.density * 1.8).exp()) * fade;
                    (p.x, p.y, radius, alpha, p.chain)
                })
                .collect();
            let frame = Frame {
                shown: s.shown,
                angle: s.rotate.value(now).to_radians(),
                tap: s.tap.value(now),
                jets: s.jets,
                puffs,
                focus_visible: (s.focus_visible || window.last_input_was_keyboard())
                    && s.focus.is_focused(window),
                disabled,
            };
            (
                frame,
                s.playground.clone(),
                s.half.clone(),
                s.focus.clone(),
                s.animating(),
            )
        });
        if animating {
            window.request_animation_frame();
        }

        // The invisible hit target that follows the craft (unrotated).
        let (half_w, half_h) = half_cell.get();
        let (pw, ph) = playground_cell
            .get()
            .map(|b| (b.size.width.as_f32(), b.size.height.as_f32()))
            .unwrap_or((0.0, 0.0));
        let hit_left = pw / 2.0 + frame.shown.0 - half_w;
        let hit_top = ph - NOZZLE - 2.0 * half_h + frame.shown.1;

        let label = self.label.clone();
        let hit = div()
            .id(SharedString::from(format!("{:?}/craft", self.id)))
            .absolute()
            .left(px(hit_left))
            .top(px(hit_top))
            .w(px(half_w * 2.0))
            .h(px(half_h * 2.0))
            .when(disabled, |el| el.cursor_not_allowed());
        let hit = wire(hit, &state, &focus, disabled);
        let hit = match self.on_click.clone().filter(|_| !disabled) {
            Some(handler) => hit
                .on_click(move |e, w, cx| handler(e, w, cx))
                .into_any_element(),
            None => hit.into_any_element(),
        };

        let playground_for_paint = playground_cell.clone();
        let mut playground = div()
            .id(self.id.clone())
            .relative()
            .size_full()
            .min_w(px(352.0))
            .min_h(px(240.0))
            .overflow_hidden()
            .child(
                canvas(
                    move |bounds, window, _| {
                        playground_for_paint.set(Some(bounds));
                        let mut font = window.text_style().font();
                        font.weight = FontWeight::MEDIUM;
                        let size = px(14.0 * frame.tap);
                        let run = TextRun {
                            len: label.len(),
                            font: font.clone(),
                            color: colors.foreground,
                            background_color: None,
                            underline: None,
                            strikethrough: None,
                        };
                        let line = window.text_system().shape_line(
                            label.clone(),
                            size,
                            std::slice::from_ref(&run),
                            None,
                        );
                        // The unscaled width sets the craft size.
                        let full = if (frame.tap - 1.0).abs() < 1e-4 {
                            line.width
                        } else {
                            window
                                .text_system()
                                .shape_line(
                                    label.clone(),
                                    px(14.0),
                                    &[TextRun { font, ..run }],
                                    None,
                                )
                                .width
                        };
                        // px-4 + 1px border on each side; h-9.
                        half_cell.set(((full.as_f32() + 34.0) / 2.0, CRAFT_HEIGHT / 2.0));
                        line
                    },
                    move |bounds, line, window, _| {
                        paint_scene(bounds, &frame, &line, colors, window);
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            .child(hit);

        if !disabled {
            let move_state = state.clone();
            let down_state = state.clone();
            let hover_state = state.clone();
            playground = playground
                .on_mouse_move(move |event: &MouseMoveEvent, _, cx| {
                    move_state.update(cx, |s, cx| {
                        if s.pointer(event.position) {
                            cx.notify();
                        }
                    });
                })
                .on_mouse_down(MouseButton::Left, move |event, _, cx| {
                    down_state.update(cx, |s, cx| {
                        if s.pointer(event.position) {
                            cx.notify();
                        }
                    });
                })
                .on_hover(move |hovered, _, cx| {
                    if !*hovered {
                        hover_state.update(cx, |s, cx| {
                            if s.land() {
                                cx.notify();
                            }
                        });
                    }
                });
        }
        playground
    }
}

fn to_points(points: &[(f32, f32)]) -> Vec<Point<Pixels>> {
    points.iter().map(|&(x, y)| point(px(x), px(y))).collect()
}

fn fill(points: &[(f32, f32)], color: Hsla, window: &mut Window) {
    if points.len() < 3 || color.a <= 0.0 {
        return;
    }
    let mut builder = PathBuilder::fill();
    builder.add_polygon(&to_points(points), true);
    if let Ok(path) = builder.build() {
        window.paint_path(path, color);
    }
}

/// A rounded rect centred on the origin, clockwise.
fn rounded_rect(w: f32, h: f32, r: f32) -> Vec<(f32, f32)> {
    let r = r.min(w / 2.0).min(h / 2.0).max(0.0);
    let (x1, y1) = (w / 2.0, h / 2.0);
    let corners = [
        (x1 - r, -y1 + r, -90.0_f32),
        (x1 - r, y1 - r, 0.0),
        (-x1 + r, y1 - r, 90.0),
        (-x1 + r, -y1 + r, 180.0),
    ];
    let mut points = Vec::with_capacity(24);
    for (cx, cy, start) in corners {
        for s in 0..=5 {
            let a = (start + 90.0 * s as f32 / 5.0).to_radians();
            points.push((cx + r * a.cos(), cy + r * a.sin()));
        }
    }
    points
}

/// Rotates local points by `angle` (clockwise on screen) and moves them to `center`.
fn place(points: &[(f32, f32)], center: (f32, f32), angle: f32) -> Vec<(f32, f32)> {
    let (c, s) = (angle.cos(), angle.sin());
    points
        .iter()
        .map(|&(x, y)| (center.0 + x * c - y * s, center.1 + x * s + y * c))
        .collect()
}

fn paint_scene(
    bounds: Bounds<Pixels>,
    frame: &Frame,
    line: &gpui::ShapedLine,
    colors: Palette,
    window: &mut Window,
) {
    let (ox, oy) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
    let (width, height) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());

    paint_smoke(&frame.puffs, (ox, oy), colors.smoke, window);

    let label_w = line.width.as_f32() / frame.tap.max(0.01);
    let w = label_w + 34.0;
    let h = CRAFT_HEIGHT;
    let (half_w, half_h) = (w / 2.0, h / 2.0);
    let center = (
        ox + width / 2.0 + frame.shown.0,
        oy + height - NOZZLE - half_h + frame.shown.1,
    );
    let angle = frame.angle;
    let craft = |local: &[(f32, f32)]| place(local, center, angle);
    let dim = |c: Hsla| if frame.disabled { c.opacity(0.5) } else { c };

    // Valves and their jet cores: drawn pointing down, then turned onto their edge.
    let nozzles = [
        (-half_w + BOTTOM_INSET, half_h, 0.0_f32, frame.jets.bottom),
        (half_w - BOTTOM_INSET, half_h, 0.0, frame.jets.bottom),
        (-half_w, -SIDE_SPREAD, PI / 2.0, frame.jets.left),
        (-half_w, SIDE_SPREAD, PI / 2.0, frame.jets.left),
        (half_w, -SIDE_SPREAD, -PI / 2.0, frame.jets.right),
        (half_w, SIDE_SPREAD, -PI / 2.0, frame.jets.right),
    ];
    for (ax, ay, turn, power) in nozzles {
        let nozzle = |local: &[(f32, f32)]| craft(&place(local, (ax, ay), turn));
        // Jet core: 3px × 16px, scaleY(power) from the mouth, fading out.
        if power > 0.0 {
            const STRIPS: usize = 6;
            let length = 16.0 * power;
            for i in 0..STRIPS {
                let t0 = i as f32 / STRIPS as f32;
                let t1 = (i + 1) as f32 / STRIPS as f32;
                let fade = 1.0 - (t0 + t1) * 0.5;
                let (y0, y1) = (NOZZLE + length * t0, NOZZLE + length * t1);
                let half = 1.5 * (1.0 - 0.3 * t0);
                fill(
                    &nozzle(&[(-half, y0), (half, y0), (half, y1), (-half, y1)]),
                    dim(colors.jet.opacity(fade * power)),
                    window,
                );
            }
        }
        // Valve body: 8×5, rounded bottom, bordered on three sides.
        let body = |inset: f32| {
            let (x0, x1, y1) = (-4.0 + inset, 4.0 - inset, NOZZLE - inset);
            let r = (2.0 - inset).max(0.5);
            vec![
                (x0, 0.0),
                (x1, 0.0),
                (x1, y1 - r),
                (x1 - r * 0.3, y1 - r * 0.3),
                (x1 - r, y1),
                (x0 + r, y1),
                (x0 + r * 0.3, y1 - r * 0.3),
                (x0, y1 - r),
            ]
        };
        fill(&nozzle(&body(0.0)), dim(colors.border), window);
        fill(&nozzle(&body(1.0)), dim(colors.muted), window);
        fill(
            &nozzle(&[(-3.0, 3.0), (3.0, 3.0), (3.0, 4.0), (-3.0, 4.0)]),
            dim(colors.valve_shade),
            window,
        );
    }

    // The button, scaled by the tap spring around the craft centre.
    let s = frame.tap;
    let (bw, bh) = (w * s, h * s);
    if frame.focus_visible {
        fill(
            &craft(&rounded_rect(bw + 8.0, bh + 8.0, RADIUS * s + 4.0)),
            colors.ring,
            window,
        );
        fill(
            &craft(&rounded_rect(bw + 4.0, bh + 4.0, RADIUS * s + 2.0)),
            colors.background,
            window,
        );
    }
    // Soft drop shadow, faked with a few widening layers (CSS blur can't rotate here).
    let shadow_layers: &[(f32, f32, f32)] = if colors.dark {
        &[(2.0, 1.0, 0.06), (1.0, 1.0, 0.12), (0.0, 1.0, 0.2)]
    } else {
        &[(3.0, 2.0, 0.025), (1.5, 1.0, 0.03), (0.0, 1.0, 0.04)]
    };
    for &(grow, dy, alpha) in shadow_layers {
        let local: Vec<(f32, f32)> =
            rounded_rect(bw + grow * 2.0, bh + grow * 2.0, RADIUS * s + grow)
                .into_iter()
                .map(|(x, y)| (x, y + dy))
                .collect();
        fill(&craft(&local), dim(rgb_a(0x000000, alpha)), window);
    }
    fill(
        &craft(&rounded_rect(bw, bh, RADIUS * s)),
        dim(colors.border),
        window,
    );
    fill(
        &craft(&rounded_rect(
            bw - 2.0 * s,
            bh - 2.0 * s,
            (RADIUS - 1.0) * s,
        )),
        dim(colors.background),
        window,
    );
    if colors.dark {
        // inset 0 1px 0 white/5: a hairline just inside the top border.
        let (x0, x1, y0) = (-bw / 2.0 + RADIUS * s, bw / 2.0 - RADIUS * s, -bh / 2.0 + s);
        fill(
            &craft(&[(x0, y0), (x1, y0), (x1, y0 + s), (x0, y0 + s)]),
            dim(rgb_a(0xffffff, 0.05)),
            window,
        );
    }

    // Label: each glyph is placed along the banked baseline (GPUI can't rotate
    // glyph bitmaps, so letters stay upright while the line tilts with the craft).
    let font_size = line.font_size;
    let line_height = 20.0 * s;
    let ascent = line.ascent.as_f32();
    let descent = line.descent.as_f32();
    let baseline = -line_height / 2.0 + (line_height - (ascent + descent)) / 2.0 + ascent;
    let left = -line.width.as_f32() / 2.0;
    let color = dim(colors.foreground);
    let (c, sn) = (angle.cos(), angle.sin());
    for run in &line.runs {
        for glyph in &run.glyphs {
            let lx = left + glyph.position.x.as_f32();
            let ly = baseline + glyph.position.y.as_f32();
            let origin = point(
                px(center.0 + lx * c - ly * sn),
                px(center.1 + lx * sn + ly * c),
            );
            window
                .paint_glyph(origin, run.font_id, glyph.id, font_size, color)
                .ok();
        }
    }
}

/// Smoke: a faint haze of soft blobs, plus each stream drawn as a thin,
/// curling strand through its puffs (strokes bucketed by alpha and width, so
/// a frame is a few dozen paths however many puffs there are).
fn paint_smoke(
    puffs: &[(f32, f32, f32, f32, u32)],
    origin: (f32, f32),
    tint: Hsla,
    window: &mut Window,
) {
    const ALPHAS: usize = 10;
    const WIDTHS: [f32; 4] = [1.0, 1.6, 2.4, 3.4];
    let (ox, oy) = origin;

    for (i, (x, y, r, alpha)) in puffs
        .iter()
        .map(|&(x, y, r, a, _)| (x, y, r, a))
        .enumerate()
    {
        let _ = i;
        let a = tint.a * alpha * 0.7;
        if a < 0.004 {
            continue;
        }
        let core = r * 0.5;
        let disc = Bounds::centered_at(
            point(px(ox + x), px(oy + y)),
            gpui::size(px(core * 2.0), px(core * 2.0)),
        );
        window.paint_drop_shadows(
            disc,
            Corners::all(px(core)),
            &[BoxShadow {
                color: tint.alpha(a),
                offset: point(px(0.0), px(0.0)),
                blur_radius: px(r * 0.55),
                spread_radius: px(0.0),
                inset: false,
            }],
        );
    }

    let mut buckets: Vec<Option<PathBuilder>> = (0..ALPHAS * WIDTHS.len()).map(|_| None).collect();
    let mut last: Vec<(u32, f32, f32)> = Vec::new();
    for &(x, y, r, alpha, chain) in puffs {
        let previous = last.iter_mut().find(|(c, _, _)| *c == chain);
        let Some(previous) = previous else {
            last.push((chain, x, y));
            continue;
        };
        let (px0, py0) = (previous.1, previous.2);
        *previous = (chain, x, y);
        if (x - px0).hypot(y - py0) > 10.0 {
            continue;
        }
        let a = (alpha * 0.45).min(1.0);
        let level = (a * ALPHAS as f32).round() as usize;
        if level == 0 {
            continue;
        }
        let width = WIDTHS
            .iter()
            .position(|&w| 0.35 * r <= w)
            .unwrap_or(WIDTHS.len() - 1);
        let key = (level.min(ALPHAS) - 1) * WIDTHS.len() + width;
        let builder = buckets[key].get_or_insert_with(|| PathBuilder::stroke(px(WIDTHS[width])));
        builder.move_to(point(px(ox + px0), px(oy + py0)));
        builder.line_to(point(px(ox + x), px(oy + y)));
    }
    for (key, builder) in buckets.into_iter().enumerate() {
        let Some(builder) = builder else { continue };
        let level = key / WIDTHS.len() + 1;
        let a = tint.a * level as f32 / ALPHAS as f32;
        if let Ok(path) = builder.build() {
            window.paint_path(path, tint.alpha(a));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn swirl_is_divergence_free() {
        let h = 0.01;
        for &(x, y) in &[(10.0_f32, 20.0_f32), (120.0, 40.0), (300.0, 200.0)] {
            let (ax, _) = swirl(x + h, y, 1.0);
            let (bx, _) = swirl(x - h, y, 1.0);
            let (_, ay) = swirl(x, y + h, 1.0);
            let (_, by) = swirl(x, y - h, 1.0);
            let div = (ax - bx) / (2.0 * h) + (ay - by) / (2.0 * h);
            assert!(div.abs() < 0.5, "divergence {div}");
        }
    }

    #[test]
    fn jet_power_has_a_deadband() {
        assert_eq!(jet_power(50.0, 3200.0), 0.0);
        assert!((jet_power(3200.0, 3200.0) - 1.0).abs() < 1e-6);
    }
}
