//! Tiny, frame-clock-free motion primitives.
//!
//! Every animated value here is a pure function of wall-clock time, so a
//! component only has to ask "what is the value *now*?" during render and call
//! `window.request_animation_frame()` while anything is still moving. Time comes
//! from `web_time`, which is `std::time` on native and `performance.now()` in
//! the browser (where `std::time::Instant` panics).

pub use web_time::{Duration, Instant};

/// A timing curve, matching the CSS `transition-timing-function` vocabulary.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Easing {
    Linear,
    /// `cubic-bezier(x1, y1, x2, y2)`. `y` may leave 0..1 to overshoot.
    CubicBezier(f32, f32, f32, f32),
}

impl Easing {
    pub const EASE: Self = Self::CubicBezier(0.25, 0.1, 0.25, 1.0);
    pub const EASE_OUT: Self = Self::CubicBezier(0.0, 0.0, 0.58, 1.0);
    pub const EASE_IN_OUT: Self = Self::CubicBezier(0.42, 0.0, 0.58, 1.0);
    /// Tailwind's default `ease-in-out`, also Material's "standard" curve.
    pub const STANDARD: Self = Self::CubicBezier(0.4, 0.0, 0.2, 1.0);
    /// The springy release curve every Evil Buttons surface uses.
    pub const SPRINGY: Self = Self::CubicBezier(0.34, 1.35, 0.64, 1.0);

    pub fn apply(self, t: f32) -> f32 {
        let t = t.clamp(0.0, 1.0);
        match self {
            Self::Linear => t,
            Self::CubicBezier(x1, y1, x2, y2) => {
                if t == 0.0 || t == 1.0 {
                    return t;
                }
                let s = solve_bezier_x(t, x1, x2);
                bezier(s, y1, y2)
            }
        }
    }
}

fn bezier(s: f32, p1: f32, p2: f32) -> f32 {
    let inv = 1.0 - s;
    3.0 * inv * inv * s * p1 + 3.0 * inv * s * s * p2 + s * s * s
}

fn bezier_slope(s: f32, p1: f32, p2: f32) -> f32 {
    let inv = 1.0 - s;
    3.0 * inv * inv * p1 + 6.0 * inv * s * (p2 - p1) + 3.0 * s * s * (1.0 - p2)
}

/// Finds the curve parameter whose x equals `x` (Newton, then bisection).
fn solve_bezier_x(x: f32, x1: f32, x2: f32) -> f32 {
    let mut s = x;
    for _ in 0..8 {
        let err = bezier(s, x1, x2) - x;
        if err.abs() < 1e-5 {
            return s;
        }
        let slope = bezier_slope(s, x1, x2);
        if slope.abs() < 1e-6 {
            break;
        }
        s -= err / slope;
    }
    let (mut lo, mut hi) = (0.0_f32, 1.0_f32);
    s = x;
    for _ in 0..24 {
        let v = bezier(s, x1, x2);
        if (v - x).abs() < 1e-5 {
            break;
        }
        if v < x {
            lo = s;
        } else {
            hi = s;
        }
        s = (lo + hi) * 0.5;
    }
    s
}

/// A value that transitions like a CSS property: retargeting starts a new
/// transition from wherever the value currently is.
#[derive(Clone, Copy, Debug)]
pub struct Transition {
    from: f32,
    to: f32,
    start: Instant,
    duration: Duration,
    easing: Easing,
}

impl Transition {
    pub fn new(value: f32) -> Self {
        Self {
            from: value,
            to: value,
            start: Instant::now(),
            duration: Duration::ZERO,
            easing: Easing::Linear,
        }
    }

    pub fn value(&self, now: Instant) -> f32 {
        let t = self.progress(now);
        if t >= 1.0 {
            return self.to;
        }
        self.from + (self.to - self.from) * self.easing.apply(t)
    }

    fn progress(&self, now: Instant) -> f32 {
        if self.duration.is_zero() {
            return 1.0;
        }
        now.saturating_duration_since(self.start).as_secs_f32() / self.duration.as_secs_f32()
    }

    pub fn target(&self) -> f32 {
        self.to
    }

    pub fn is_animating(&self, now: Instant) -> bool {
        self.progress(now) < 1.0
    }

    /// Animates to `to`. Returns `false` (and does nothing) when already headed there.
    pub fn animate_to(&mut self, to: f32, duration: Duration, easing: Easing) -> bool {
        if self.to == to {
            return false;
        }
        let now = Instant::now();
        self.from = self.value(now);
        self.to = to;
        self.start = now;
        self.duration = duration;
        self.easing = easing;
        true
    }

    /// Restarts from `from` even when the target is unchanged (WAAPI-style replay).
    pub fn replay(&mut self, from: f32, to: f32, duration: Duration, easing: Easing) {
        self.from = from;
        self.to = to;
        self.start = Instant::now();
        self.duration = duration;
        self.easing = easing;
    }

    pub fn snap(&mut self, value: f32) {
        *self = Self::new(value);
    }
}

/// A damped spring, matching `motion`'s `{ type: "spring", stiffness, damping, mass }`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SpringConfig {
    pub stiffness: f32,
    pub damping: f32,
    pub mass: f32,
}

impl SpringConfig {
    pub const fn new(stiffness: f32, damping: f32) -> Self {
        Self {
            stiffness,
            damping,
            mass: 1.0,
        }
    }
}

/// A spring-driven value, advanced lazily to "now" whenever it is read.
#[derive(Clone, Copy, Debug)]
pub struct Spring {
    value: f32,
    velocity: f32,
    target: f32,
    config: SpringConfig,
    last: Instant,
}

impl Spring {
    pub fn new(value: f32, config: SpringConfig) -> Self {
        Self {
            value,
            velocity: 0.0,
            target: value,
            config,
            last: Instant::now(),
        }
    }

    /// Advances the simulation to `now` and returns the current value.
    pub fn value(&mut self, now: Instant) -> f32 {
        let elapsed = now
            .saturating_duration_since(self.last)
            .as_secs_f32()
            .min(0.064);
        self.last = now;
        if self.is_settled() {
            return self.value;
        }
        const STEP: f32 = 1.0 / 240.0;
        let mut remaining = elapsed;
        while remaining > 0.0 {
            let h = remaining.min(STEP);
            let force = -self.config.stiffness * (self.value - self.target)
                - self.config.damping * self.velocity;
            self.velocity += force / self.config.mass * h;
            self.value += self.velocity * h;
            remaining -= h;
        }
        if (self.value - self.target).abs() < 0.0005 && self.velocity.abs() < 0.005 {
            self.value = self.target;
            self.velocity = 0.0;
        }
        self.value
    }

    pub fn set_target(&mut self, target: f32) {
        // Bring the simulation up to date first, so the new target starts from here.
        self.value(Instant::now());
        self.target = target;
    }

    pub fn is_settled(&self) -> bool {
        self.value == self.target && self.velocity == 0.0
    }
}

/// Samples piecewise-linear keyframes `(offset, value)` at eased time `t`.
pub fn keyframes(t: f32, frames: &[(f32, f32)]) -> f32 {
    let t = t.clamp(0.0, 1.0);
    let mut prev = frames[0];
    for &frame in &frames[1..] {
        if t <= frame.0 {
            let span = (frame.0 - prev.0).max(f32::EPSILON);
            return prev.1 + (frame.1 - prev.1) * ((t - prev.0) / span);
        }
        prev = frame;
    }
    prev.1
}

/// A one-shot timeline (WAAPI-style): progress 0..1 over `duration` from `start`.
#[derive(Clone, Copy, Debug)]
pub struct Timeline {
    start: Instant,
    duration: Duration,
}

impl Timeline {
    pub fn start(duration: Duration) -> Self {
        Self {
            start: Instant::now(),
            duration,
        }
    }

    /// Raw (un-eased) progress, clamped to 0..1.
    pub fn progress(&self, now: Instant) -> f32 {
        if self.duration.is_zero() {
            return 1.0;
        }
        (now.saturating_duration_since(self.start).as_secs_f32() / self.duration.as_secs_f32())
            .clamp(0.0, 1.0)
    }

    pub fn is_done(&self, now: Instant) -> bool {
        self.progress(now) >= 1.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bezier_endpoints_and_overshoot() {
        assert_eq!(Easing::SPRINGY.apply(0.0), 0.0);
        assert_eq!(Easing::SPRINGY.apply(1.0), 1.0);
        let peak = (1..100)
            .map(|i| Easing::SPRINGY.apply(i as f32 / 100.0))
            .fold(0.0_f32, f32::max);
        assert!(
            peak > 1.0,
            "springy curve should overshoot, peaked at {peak}"
        );
        assert!((Easing::Linear.apply(0.3) - 0.3).abs() < 1e-6);
        assert!((Easing::EASE_IN_OUT.apply(0.5) - 0.5).abs() < 1e-3);
    }

    #[test]
    fn keyframes_interpolate() {
        let frames = [(0.0, 0.0), (0.25, 1.0), (1.0, 0.0)];
        assert!((keyframes(0.125, &frames) - 0.5).abs() < 1e-6);
        assert_eq!(keyframes(0.25, &frames), 1.0);
        assert_eq!(keyframes(2.0, &frames), 0.0);
    }

    #[test]
    fn spring_settles_on_target() {
        let mut spring = Spring::new(0.0, SpringConfig::new(420.0, 30.0));
        spring.set_target(1.0);
        let mut now = Instant::now();
        for _ in 0..200 {
            now += Duration::from_millis(16);
            spring.value(now);
        }
        assert!(spring.is_settled());
        assert_eq!(spring.value(now), 1.0);
    }
}
