//! StretchyButton: a slab of dark goo that would rather you didn't. Grab it
//! and pull, and a strand of it comes with you, thinning out and glowing hotter
//! the further you go while the label begs you to stop. Let go and it slaps
//! back into shape; pull too far and the strand tears.
//!
//! The body is a signed distance field: the button's rounded rect, smoothly
//! unioned with a neck and a blob that follow the pull. Each frame the field
//! is traced into an outline (marching squares) and painted as a path. At rest
//! the button is the plain graded surface Minimal, Hold and Copy use.

use gpui::{
    App, Bounds, BoxShadow, ClickEvent, Context, Corners, CursorStyle, DispatchPhase, ElementId,
    FillOptions, FillRule, FocusHandle, FontWeight, Hsla, InteractiveElement, IntoElement,
    MouseButton, MouseMoveEvent, MouseUpEvent, ParentElement, PathBuilder, PathStyle, Pixels,
    Point, RenderOnce, Rgba, SharedString, StatefulInteractiveElement, Styled, Task, Window,
    canvas, div, linear_color_stop, linear_gradient, point, prelude::FluentBuilder, px,
};
use std::{cell::Cell, rc::Rc};

use crate::interaction::{ClickHandler, is_activation_key};
use crate::motion::{Duration, Easing, Instant, Transition};
use crate::surface::{
    PressFrame, PressMotion, brighten, ms, paint_focus_ring, paint_graded_surface, rgb_a,
    scaled_content, surface_text,
};

type TearHandler = Rc<dyn Fn(&mut Window, &mut App)>;

/// A slab of goo you can grab and pull. It resists, heats up and complains,
/// slaps back when you let go, and tears if you pull too far.
///
/// ```ignore
/// StretchyButton::new("goo")
///     .label("Don't pull")
///     .on_click(|_, _, _| println!("poked"))
///     .on_tear(|_, _| println!("now look what you did"))
/// ```
#[derive(IntoElement)]
pub struct StretchyButton {
    id: ElementId,
    label: SharedString,
    strain_labels: Vec<SharedString>,
    snap_label: SharedString,
    accent: Hsla,
    reach: f32,
    tear_at: f32,
    wobble: f32,
    disabled: bool,
    on_click: Option<ClickHandler>,
    on_tear: Option<TearHandler>,
}

impl StretchyButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: "Don't pull".into(),
            strain_labels: vec!["Let go".into(), "Don't.".into()],
            snap_label: "Ow.".into(),
            accent: gpui::rgb(0xe5341f).into(),
            reach: 80.0,
            tear_at: 170.0,
            wobble: 0.6,
            disabled: false,
            on_click: None,
            on_tear: None,
        }
    }

    /// Label at rest. Defaults to "Don't pull".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Labels shown in turn as the strain builds, from first pull to breaking
    /// point. Empty keeps the resting label. Defaults to "Let go", "Don't.".
    pub fn strain_labels<I, S>(mut self, labels: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<SharedString>,
    {
        self.strain_labels = labels.into_iter().map(Into::into).collect();
        self
    }

    /// Label shown for a moment after the strand tears. Defaults to "Ow.".
    pub fn snap_label(mut self, label: impl Into<SharedString>) -> Self {
        self.snap_label = label.into();
        self
    }

    /// Colour the goo glows as it heats up under strain. Defaults to Evil Buttons red, `#e5341f`.
    pub fn accent(mut self, color: impl Into<Hsla>) -> Self {
        self.accent = color.into();
        self
    }

    /// How far in px the strand can be drawn out; it pulls back harder the
    /// closer you get. Defaults to 80.
    pub fn reach(mut self, reach: f32) -> Self {
        self.reach = reach;
        self
    }

    /// Drag distance in px at which the strand tears. `f32::INFINITY` never
    /// tears. Defaults to 170.
    pub fn tear_at(mut self, tear_at: f32) -> Self {
        self.tear_at = tear_at;
        self
    }

    /// How hard it slaps back and jiggles, from 0 (settles) to 1 (very wobbly). Defaults to 0.6.
    pub fn wobble(mut self, wobble: f32) -> Self {
        self.wobble = wobble;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired by a press that barely moves, or Space/Enter. A pull is not a click.
    pub fn on_click(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(handler));
        self
    }

    /// Fired when the strand tears.
    pub fn on_tear(mut self, handler: impl Fn(&mut Window, &mut App) + 'static) -> Self {
        self.on_tear = Some(Rc::new(handler));
        self
    }
}

/// Drags shorter than this still count as a click.
const CLICK_SLOP: f32 = 6.0;
const HEIGHT: f32 = 38.0;
const RADIUS: f32 = 12.0;
/// Marching-squares cell size in px.
const GRID: f32 = 1.25;
/// Blend radius where the strand flows out of the slab.
const MELT: f32 = 16.0;
/// How long the torn ends take to snap back.
const TEAR_RETRACT: Duration = Duration::from_millis(170);
/// How long the snap label stays up.
const SNAP_LABEL_FOR: Duration = Duration::from_millis(1100);

type V2 = (f32, f32);

fn add(a: V2, b: V2) -> V2 {
    (a.0 + b.0, a.1 + b.1)
}
fn sub(a: V2, b: V2) -> V2 {
    (a.0 - b.0, a.1 - b.1)
}
fn mul(a: V2, s: f32) -> V2 {
    (a.0 * s, a.1 * s)
}
fn len(a: V2) -> f32 {
    a.0.hypot(a.1)
}
fn dot(a: V2, b: V2) -> f32 {
    a.0 * b.0 + a.1 * b.1
}
fn smoothstep(e0: f32, e1: f32, x: f32) -> f32 {
    let t = ((x - e0) / (e1 - e0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// Integrates `x'' = -k (x - target) - c x'` in small fixed steps.
#[derive(Clone, Copy, Debug, Default)]
struct Spring2 {
    pos: V2,
    vel: V2,
}

impl Spring2 {
    fn step(&mut self, target: V2, (k, c): (f32, f32), dt: f32) {
        let mut remaining = dt;
        while remaining > 0.0 {
            let h = remaining.min(1.0 / 240.0);
            let ax = -k * (self.pos.0 - target.0) - c * self.vel.0;
            let ay = -k * (self.pos.1 - target.1) - c * self.vel.1;
            self.vel = add(self.vel, mul((ax, ay), h));
            self.pos = add(self.pos, mul(self.vel, h));
            remaining -= h;
        }
    }

    fn settle_at(&mut self, target: V2) -> bool {
        if len(sub(self.pos, target)) < 0.05 && len(self.vel) < 2.0 {
            *self = Self {
                pos: target,
                vel: (0.0, 0.0),
            };
        }
        self.pos == target && self.vel == (0.0, 0.0)
    }
}

/// A 1-D spring that rests at 0.
#[derive(Clone, Copy, Debug, Default)]
struct Spring1 {
    value: f32,
    vel: f32,
}

impl Spring1 {
    fn step(&mut self, (k, c): (f32, f32), dt: f32) {
        let mut remaining = dt;
        while remaining > 0.0 {
            let h = remaining.min(1.0 / 240.0);
            self.vel += (-k * self.value - c * self.vel) * h;
            self.value += self.vel * h;
            remaining -= h;
        }
        if self.value.abs() < 0.02 && self.vel.abs() < 1.0 {
            *self = Self::default();
        }
    }

    fn resting(&self) -> bool {
        self.value == 0.0 && self.vel == 0.0
    }
}

struct Drag {
    start: Point<Pixels>,
    raw: V2,
}

/// The strand as it was when it tore: the stub on the body and the tail on
/// the blob both snap back from the break.
#[derive(Clone, Copy, Debug)]
struct Tear {
    at: Instant,
    exit: V2,
    dir: V2,
    length: f32,
    neck: f32,
}

struct StretchState {
    motion: PressMotion,
    /// The pull: follows the pointer's offset while held, springs home after.
    pull: Spring2,
    squash: Spring1,
    squash_axis: V2,
    dent: Spring1,
    dent_x: f32,
    /// Grab point in button coordinates.
    anchor: V2,
    drag: Option<Drag>,
    tear: Option<Tear>,
    /// The blob is flying home on its own after a tear.
    detached: bool,
    heat: Transition,
    snapped_until: Option<Instant>,
    snap_task: Option<Task<()>>,
    suppress_click: bool,
    last: Instant,
    born: Instant,
    bounds: Rc<Cell<Option<Bounds<Pixels>>>>,
    focus: FocusHandle,
    reach: f32,
    tear_at: f32,
    wobble: f32,
    on_tear: Option<TearHandler>,
}

impl StretchState {
    fn looseness(&self) -> f32 {
        1.0 - self.wobble.clamp(0.0, 1.0)
    }

    fn advance(&mut self, now: Instant) {
        let dt = now
            .saturating_duration_since(self.last)
            .as_secs_f32()
            .min(0.064);
        self.last = now;
        if dt <= 0.0 {
            return;
        }
        let loose = self.looseness();
        let before = self.pull;
        match self.drag.as_ref() {
            // Follows the hand closely, with just a hint of lag.
            Some(drag) => self.pull.step(drag.raw, (1600.0, 70.0), dt),
            // Lets go underdamped, so it slaps past home and back.
            None => {
                self.pull.step((0.0, 0.0), (300.0, 5.0 + loose * 22.0), dt);
                self.pull.settle_at((0.0, 0.0));
            }
        }
        // The blob slamming home through the middle squashes the whole slab.
        let speed = len(before.vel);
        if self.drag.is_none() && dot(before.pos, self.pull.pos) < 0.0 && speed > 250.0 {
            self.squash_axis = mul(before.vel, 1.0 / speed);
            self.squash.vel += (speed * 0.07).min(100.0) * (0.4 + self.wobble);
            self.detached = false;
        }
        self.squash.step((620.0, 9.0 + loose * 22.0), dt);
        self.dent.step((520.0, 9.0 + loose * 18.0), dt);
        if self
            .tear
            .is_some_and(|t| now.saturating_duration_since(t.at) >= TEAR_RETRACT)
        {
            self.tear = None;
        }
        if self.detached && self.drag.is_none() && self.pull.pos == (0.0, 0.0) {
            self.detached = false;
        }
    }

    fn animating(&self, now: Instant) -> bool {
        self.drag.is_some()
            || self.pull.pos != (0.0, 0.0)
            || self.pull.vel != (0.0, 0.0)
            || !self.squash.resting()
            || !self.dent.resting()
            || self.tear.is_some()
            || self.heat.is_animating(now)
    }

    fn strain(&self) -> f32 {
        let Some(drag) = self.drag.as_ref() else {
            return 0.0;
        };
        let limit = if self.tear_at.is_finite() {
            self.tear_at
        } else {
            self.reach * 2.2
        };
        (len(drag.raw) / limit.max(1.0)).clamp(0.0, 1.0)
    }

    fn release(&mut self) -> bool {
        if self.drag.take().is_none() {
            return false;
        }
        self.motion.release();
        let now = Instant::now();
        self.advance(now);
        let heat = self.heat.value(now);
        self.heat.replay(heat, 0.0, ms(420), Easing::EASE_OUT);
        true
    }

    /// Returns true if the strand tore.
    fn drag_to(&mut self, pointer: Point<Pixels>, cx: &mut Context<Self>) -> bool {
        let Some(drag) = self.drag.as_mut() else {
            return false;
        };
        let raw = (
            (pointer.x - drag.start.x).as_f32(),
            (pointer.y - drag.start.y).as_f32(),
        );
        drag.raw = raw;
        let distance = len(raw);
        if distance > CLICK_SLOP {
            self.suppress_click = true;
        }
        if distance > self.tear_at {
            self.tear_free(cx);
            return true;
        }
        let now = Instant::now();
        self.advance(now);
        self.heat.snap(smoothstep(0.12, 1.0, self.strain()));
        false
    }

    fn tear_free(&mut self, cx: &mut Context<Self>) {
        let now = Instant::now();
        self.advance(now);
        if let Some(b) = self.bounds.get() {
            let size = (b.size.width.as_f32(), b.size.height.as_f32());
            let pose = self.pose(now, 1.0);
            let s = strand(&pose, size);
            if s.length > 1.0 {
                self.tear = Some(Tear {
                    at: now,
                    exit: s.exit,
                    dir: s.dir,
                    length: s.length,
                    neck: s.neck,
                });
            }
        }
        self.drag = None;
        self.motion.release();
        self.detached = true;
        // It doesn't just let go: it yanks itself back.
        let distance = len(self.pull.pos).max(1.0);
        self.pull.vel = add(self.pull.vel, mul(self.pull.pos, -900.0 / distance));
        self.heat.replay(1.0, 0.0, ms(650), Easing::EASE_OUT);
        self.snapped_until = Some(now + SNAP_LABEL_FOR);
        self.snap_task = Some(cx.spawn(async move |this, cx| {
            cx.background_executor().timer(SNAP_LABEL_FOR).await;
            this.update(cx, |s, cx| {
                s.snapped_until = None;
                cx.notify();
            })
            .ok();
        }));
    }

    fn pose(&self, now: Instant, scale: f32) -> Pose {
        let strain = self.strain();
        // At breaking point the blob trembles in your grip.
        let tremble = smoothstep(0.6, 1.0, strain);
        let t = now.saturating_duration_since(self.born).as_secs_f32();
        Pose {
            pull: self.pull.pos,
            anchor: self.anchor,
            scale,
            squash: self.squash.value,
            squash_axis: self.squash_axis,
            dent: self.dent.value,
            dent_x: self.dent_x,
            reach: self.reach.max(1.0),
            tremble: (
                (t * 47.0).sin() * 1.1 * tremble,
                (t * 61.0).cos() * 1.1 * tremble,
            ),
            tear: self.tear.map(|tear| {
                let p = (now.saturating_duration_since(tear.at).as_secs_f32()
                    / TEAR_RETRACT.as_secs_f32())
                .clamp(0.0, 1.0);
                (tear, 1.0 - Easing::EASE_OUT.apply(p))
            }),
            detached: self.detached,
        }
    }
}

/// Everything the painter needs about the current deformation.
#[derive(Clone, Copy, Debug)]
struct Pose {
    pull: V2,
    anchor: V2,
    scale: f32,
    squash: f32,
    squash_axis: V2,
    dent: f32,
    dent_x: f32,
    reach: f32,
    tremble: V2,
    /// The torn strand and how much of it is still left (1 → 0).
    tear: Option<(Tear, f32)>,
    detached: bool,
}

impl Pose {
    fn deformed(&self) -> bool {
        self.pull != (0.0, 0.0) || self.squash != 0.0 || self.dent != 0.0 || self.tear.is_some()
    }
}

/// The slab: a rounded box, stretched toward the pull and squashed by slaps.
#[derive(Clone, Copy, Debug)]
struct Body {
    center: V2,
    half: V2,
    radius: f32,
    dent: f32,
    dent_x: f32,
}

impl Body {
    fn new(pose: &Pose, (w, h): V2) -> Self {
        let pull = len(pose.pull);
        let dir = if pull > 0.0 {
            mul(pose.pull, 1.0 / pull)
        } else {
            (0.0, 0.0)
        };
        // The near side gives a little before any goo comes loose; the far
        // side stays put.
        let give = 7.0 * (pull / 60.0).tanh();
        let mut center = add((w / 2.0, h / 2.0), mul(dir, give / 2.0));
        let mut half = (
            (w / 2.0) * pose.scale + dir.0.abs() * give / 2.0,
            (h / 2.0) * pose.scale + dir.1.abs() * give / 2.0,
        );
        let (ax, ay) = pose.squash_axis;
        let j = pose.squash;
        half.0 += j * (-ax * ax * 0.8 + ay * ay * 0.55);
        half.1 += j * (-ay * ay * 0.6 + ax * ax * 0.3);
        half = (half.0.max(4.0), half.1.max(4.0));
        center.1 += j * ay * ay * 0.15;
        Self {
            center,
            half,
            radius: (RADIUS * pose.scale).min(half.0).min(half.1),
            dent: pose.dent,
            dent_x: pose.dent_x,
        }
    }

    fn sdf(&self, p: V2) -> f32 {
        let q = (
            (p.0 - self.center.0).abs() - self.half.0 + self.radius,
            (p.1 - self.center.1).abs() - self.half.1 + self.radius,
        );
        let outside = len((q.0.max(0.0), q.1.max(0.0)));
        let d = outside + q.0.max(q.1).min(0.0) - self.radius;
        if self.dent == 0.0 {
            return d;
        }
        // A poke pinches the slab in where it landed.
        let u = (p.0 - self.dent_x) / 15.0;
        d + self.dent * (-u * u).exp()
    }
}

/// The pulled strand, in button coordinates.
#[derive(Clone, Copy, Debug)]
struct Strand {
    /// Where it leaves the body.
    exit: V2,
    dir: V2,
    /// How far the blob is from the body.
    length: f32,
    neck: f32,
    tip: V2,
    blob: f32,
}

fn strand(pose: &Pose, size: V2) -> Strand {
    let body = Body::new(pose, size);
    let pull = len(pose.pull);
    let dir = if pull > 0.0 {
        mul(pose.pull, 1.0 / pull)
    } else {
        (0.0, -1.0)
    };
    // March from the grab point to the edge of the slab.
    let mut t = 0.0;
    for _ in 0..24 {
        let d = body.sdf(add(pose.anchor, mul(dir, t)));
        if d > -0.05 {
            break;
        }
        t -= d;
    }
    let exit = add(pose.anchor, mul(dir, t));
    // Only what's past the edge is pulled out, and it resists harder the
    // further it goes.
    let beyond = (pull - t).max(0.0);
    let length = pose.reach * (beyond / pose.reach).tanh();
    let h = size.1;
    let neck = (h * 0.25 * (30.0 / (30.0 + length)).powf(0.6)).max(2.5);
    let blob = h * 0.34 * (1.0 - 0.12 * (length / pose.reach)) * smoothstep(0.0, 26.0, length);
    let tip = add(
        add(exit, mul(dir, length)),
        mul(pose.tremble, smoothstep(0.0, 30.0, length)),
    );
    Strand {
        exit,
        dir,
        length,
        neck,
        tip,
        blob,
    }
}

#[derive(Clone, Copy, Debug)]
struct Capsule {
    a: V2,
    b: V2,
    r: f32,
}

impl Capsule {
    fn sdf(&self, p: V2) -> f32 {
        let pa = sub(p, self.a);
        let ba = sub(self.b, self.a);
        let bb = dot(ba, ba);
        let h = if bb > 0.0 {
            (dot(pa, ba) / bb).clamp(0.0, 1.0)
        } else {
            0.0
        };
        len(sub(pa, mul(ba, h))) - self.r
    }
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
    if k <= 0.0 {
        return a.min(b);
    }
    let h = (k - (a - b).abs()).max(0.0) / k;
    a.min(b) - h * h * k * 0.25
}

/// The whole goo: slab plus whatever has been pulled out of it.
#[derive(Clone, Debug)]
struct Goo {
    body: Body,
    pieces: Vec<Capsule>,
    /// Blend radius between the slab and the strand.
    melt: f32,
}

impl Goo {
    fn new(pose: &Pose, size: V2) -> (Self, Strand) {
        let body = Body::new(pose, size);
        let s = strand(pose, size);
        let mut pieces = Vec::new();
        let emerge = smoothstep(0.0, 14.0, s.length);
        if !pose.detached && s.length > 0.0 {
            pieces.push(Capsule {
                a: sub(s.exit, mul(s.dir, 4.0)),
                b: s.tip,
                r: s.neck * emerge,
            });
        }
        if s.blob > 0.0 {
            pieces.push(Capsule {
                a: s.tip,
                b: s.tip,
                r: s.blob,
            });
        }
        let mut melt = MELT * emerge;
        if let Some((tear, left)) = pose.tear {
            let half = tear.length / 2.0 * left;
            let r = tear.neck * (0.5 + 0.5 * left);
            pieces.push(Capsule {
                a: sub(tear.exit, mul(tear.dir, 4.0)),
                b: add(tear.exit, mul(tear.dir, half)),
                r,
            });
            pieces.push(Capsule {
                a: s.tip,
                b: sub(s.tip, mul(tear.dir, half)),
                r,
            });
            melt = melt.max(MELT * left);
        }
        (Self { body, pieces, melt }, s)
    }

    fn strand_sdf(&self, p: V2) -> f32 {
        let mut goo = f32::INFINITY;
        for piece in &self.pieces {
            goo = smin(goo, piece.sdf(p), 6.0);
        }
        goo
    }

    fn sdf(&self, p: V2) -> f32 {
        smin(self.body.sdf(p), self.strand_sdf(p), self.melt)
    }

    /// Bounding box of everything, padded.
    fn extent(&self) -> (V2, V2) {
        let b = &self.body;
        let mut lo = sub(b.center, b.half);
        let mut hi = add(b.center, b.half);
        for c in &self.pieces {
            for p in [c.a, c.b] {
                lo = (lo.0.min(p.0 - c.r), lo.1.min(p.1 - c.r));
                hi = (hi.0.max(p.0 + c.r), hi.1.max(p.1 + c.r));
            }
        }
        let pad = 3.0 + self.melt * 0.25;
        (sub(lo, (pad, pad)), add(hi, (pad, pad)))
    }
}

/// Traces the zero contour of `f` into closed loops (marching squares).
fn trace(f: impl Fn(V2) -> f32, (lo, hi): (V2, V2), step: f32) -> Vec<Vec<V2>> {
    let nx = (((hi.0 - lo.0) / step).ceil() as usize).max(1);
    let ny = (((hi.1 - lo.1) / step).ceil() as usize).max(1);
    let at = |i: usize, j: usize| (lo.0 + i as f32 * step, lo.1 + j as f32 * step);
    let mut values = Vec::with_capacity((nx + 1) * (ny + 1));
    for j in 0..=ny {
        for i in 0..=nx {
            values.push(f(at(i, j)));
        }
    }
    let v = |i: usize, j: usize| values[j * (nx + 1) + i];
    // Edge ids: horizontal edges first, then vertical ones.
    let horizontal = |i: usize, j: usize| j * nx + i;
    let vertical = |i: usize, j: usize| (ny + 1) * nx + j * (nx + 1) + i;
    let edges = (ny + 1) * nx + ny * (nx + 1);
    let mut links = vec![[usize::MAX; 2]; edges];
    let mut points = vec![(0.0, 0.0); edges];
    let crossing = |a: V2, va: f32, b: V2, vb: f32| {
        let t = (va / (va - vb)).clamp(0.0, 1.0);
        add(a, mul(sub(b, a), t))
    };
    let link = |links: &mut Vec<[usize; 2]>, a: usize, b: usize| {
        for (from, to) in [(a, b), (b, a)] {
            let slot = &mut links[from];
            if slot[0] == usize::MAX {
                slot[0] = to;
            } else {
                slot[1] = to;
            }
        }
    };
    for j in 0..ny {
        for i in 0..nx {
            let c = [v(i, j), v(i + 1, j), v(i + 1, j + 1), v(i, j + 1)];
            let inside = c.map(|x| x < 0.0);
            if inside.iter().all(|&x| x) || inside.iter().all(|&x| !x) {
                continue;
            }
            let p = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
            // Edges: top, right, bottom, left, as (id, corner a, corner b).
            let sides = [
                (horizontal(i, j), 0, 1),
                (vertical(i + 1, j), 1, 2),
                (horizontal(i, j + 1), 3, 2),
                (vertical(i, j), 0, 3),
            ];
            let mut cut = [usize::MAX; 4];
            for (k, &(id, a, b)) in sides.iter().enumerate() {
                if inside[a] != inside[b] {
                    points[id] = crossing(p[a], c[a], p[b], c[b]);
                    cut[k] = id;
                }
            }
            let crossings: Vec<usize> = cut.iter().copied().filter(|&x| x != usize::MAX).collect();
            if crossings.len() == 2 {
                link(&mut links, crossings[0], crossings[1]);
            } else if crossings.len() == 4 {
                // Saddle: the centre decides which diagonal is connected.
                let centre = c.iter().sum::<f32>() / 4.0 < 0.0;
                if centre == inside[0] {
                    link(&mut links, cut[0], cut[1]);
                    link(&mut links, cut[2], cut[3]);
                } else {
                    link(&mut links, cut[3], cut[0]);
                    link(&mut links, cut[1], cut[2]);
                }
            }
        }
    }
    let mut seen = vec![false; edges];
    let mut loops = Vec::new();
    for start in 0..edges {
        if seen[start] || links[start][0] == usize::MAX {
            continue;
        }
        let mut path = Vec::new();
        let (mut prev, mut cur) = (usize::MAX, start);
        loop {
            seen[cur] = true;
            let p = points[cur];
            if path.last().is_none_or(|&q: &V2| len(sub(p, q)) > 0.2) {
                path.push(p);
            }
            let [a, b] = links[cur];
            let next = if a != prev { a } else { b };
            if next == usize::MAX || next == start || seen[next] {
                break;
            }
            prev = cur;
            cur = next;
        }
        if path.len() >= 3 {
            loops.push(path);
        }
    }
    loops
}

/// Outward unit normals for a closed loop.
fn normals(points: &[V2], f: &impl Fn(V2) -> f32) -> Vec<V2> {
    let n = points.len();
    let mut out: Vec<V2> = (0..n)
        .map(|i| {
            let d = sub(points[(i + 1) % n], points[(i + n - 1) % n]);
            let l = len(d).max(1e-6);
            (d.1 / l, -d.0 / l)
        })
        .collect();
    // Orient them with the field.
    let i = (0..n)
        .max_by(|&a, &b| points[a].0.total_cmp(&points[b].0))
        .unwrap_or(0);
    if f(add(points[i], out[i])) < f(sub(points[i], out[i])) {
        for v in &mut out {
            *v = mul(*v, -1.0);
        }
    }
    out
}

fn add_loop(builder: &mut PathBuilder, origin: Point<Pixels>, points: impl Iterator<Item = V2>) {
    let mut first = true;
    for (x, y) in points {
        let p = point(origin.x + px(x), origin.y + px(y));
        if first {
            builder.move_to(p);
            first = false;
        } else {
            builder.line_to(p);
        }
    }
    builder.close();
}

/// The traced outline with its normals, ready to fill, stroke or offset.
struct Outline {
    loops: Vec<(Vec<V2>, Vec<V2>)>,
    origin: Point<Pixels>,
}

impl Outline {
    fn shape(&self, offset: f32, shift: V2, builder: &mut PathBuilder) {
        for (points, normals) in &self.loops {
            add_loop(
                builder,
                self.origin,
                points
                    .iter()
                    .zip(normals)
                    .map(|(&p, &n)| add(add(p, mul(n, offset)), shift)),
            );
        }
    }

    fn fill(
        &self,
        offset: f32,
        shift: V2,
        color: impl Into<gpui::Background>,
        window: &mut Window,
    ) {
        let mut b = PathBuilder::fill();
        self.shape(offset, shift, &mut b);
        if let Ok(path) = b.build() {
            window.paint_path(path, color);
        }
    }

    fn stroke(&self, offset: f32, width: f32, color: Hsla, window: &mut Window) {
        let mut b = PathBuilder::stroke(px(width));
        self.shape(offset, (0.0, 0.0), &mut b);
        if let Ok(path) = b.build() {
            window.paint_path(path, color);
        }
    }

    fn y_range(&self, offset: f32, shift: V2) -> (f32, f32) {
        let mut range = (f32::INFINITY, f32::NEG_INFINITY);
        for (points, normals) in &self.loops {
            for (&p, &n) in points.iter().zip(normals) {
                let y = p.1 + n.1 * offset + shift.1;
                range = (range.0.min(y), range.1.max(y));
            }
        }
        range
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

fn with_alpha(color: Hsla, alpha: f32) -> Hsla {
    Hsla {
        a: color.a * alpha.clamp(0.0, 1.0),
        ..color
    }
}

/// A capsule as a polygon, for the glowing core.
fn capsule_polygon(c: Capsule, origin: Point<Pixels>, builder: &mut PathBuilder) {
    let d = sub(c.b, c.a);
    let base = d.1.atan2(d.0);
    let steps = 10;
    let mut points = Vec::with_capacity(2 * steps + 2);
    for (center, from) in [
        (c.b, base - std::f32::consts::FRAC_PI_2),
        (c.a, base + std::f32::consts::FRAC_PI_2),
    ] {
        for k in 0..=steps {
            let a = from + std::f32::consts::PI * k as f32 / steps as f32;
            points.push(add(center, (a.cos() * c.r, a.sin() * c.r)));
        }
    }
    add_loop(builder, origin, points.into_iter());
}

#[derive(Clone)]
struct Paint {
    pose: Pose,
    frame: PressFrame,
    heat: f32,
    accent: Hsla,
    focus_visible: bool,
}

fn shadow(y: f32, blur: f32, spread: f32, alpha: f32) -> BoxShadow {
    BoxShadow {
        color: rgb_a(0x000000, alpha),
        offset: point(px(0.0), px(y)),
        blur_radius: px(blur / 2.0),
        spread_radius: px(spread),
        inset: false,
    }
}

fn paint_goo(bounds: Bounds<Pixels>, p: &Paint, window: &mut Window) {
    let radius = px(RADIUS);
    if !p.pose.deformed() {
        if p.focus_visible {
            paint_focus_ring(
                bounds,
                radius,
                rgb_a(0xa1a1a1, 1.0),
                rgb_a(0x0a0a0a, 1.0),
                window,
            );
        }
        paint_graded_surface(bounds, p.frame, radius, window);
        return;
    }

    let size = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
    let (goo, s) = Goo::new(&p.pose, size);
    let field = |q: V2| goo.sdf(q);
    let loops = trace(field, goo.extent(), GRID);
    if loops.is_empty() {
        return;
    }
    let outline = Outline {
        loops: loops
            .into_iter()
            .map(|points| {
                let n = normals(&points, &field);
                (points, n)
            })
            .collect(),
        origin: bounds.origin,
    };
    let body = goo.body;
    let b = p.frame.brightness;
    let settle = p.frame.settle;

    if p.focus_visible {
        outline.stroke(3.0, 2.0, rgb_a(0xa1a1a1, 1.0), window);
        outline.stroke(1.0, 2.0, rgb_a(0x0a0a0a, 1.0), window);
    }

    // The slab's soft shadows, plus a cheap one under the strand.
    let corner = Bounds {
        origin: bounds.origin
            + point(
                px(body.center.0 - body.half.0),
                px(body.center.1 - body.half.1),
            ),
        size: gpui::size(px(body.half.0 * 2.0), px(body.half.1 * 2.0)),
    };
    let lerp = |a: f32, b: f32| a + (b - a) * settle;
    window.paint_drop_shadows(
        corner,
        Corners::all(px(body.radius)),
        &[
            shadow(
                lerp(4.0, 1.0),
                lerp(12.0, 3.0),
                lerp(-4.0, -2.0),
                lerp(0.4, 0.3),
            ),
            shadow(lerp(1.0, 0.0), lerp(2.0, 1.0), 0.0, lerp(0.25, 0.2)),
        ],
    );
    for (dy, alpha) in [(1.0, 0.10), (2.0, 0.07), (3.5, 0.04)] {
        outline.fill(0.0, (0.0, dy), rgb_a(0x000000, alpha), window);
    }

    // Heat bleeding out of the strand (the slab's fill covers the rest).
    if p.heat > 0.01 && !goo.pieces.is_empty() {
        let strand_field = |q: V2| goo.strand_sdf(q);
        let halo = Outline {
            loops: trace(strand_field, goo.extent(), GRID * 2.0)
                .into_iter()
                .map(|points| {
                    let n = normals(&points, &strand_field);
                    (points, n)
                })
                .collect(),
            origin: bounds.origin,
        };
        halo.stroke(4.0, 7.0, with_alpha(p.accent, 0.08 * p.heat), window);
        halo.stroke(2.0, 3.0, with_alpha(p.accent, 0.14 * p.heat), window);
    }

    // Fill: a 1px highlight on top, then the graded body shifted down by 1px.
    let top = brighten(gpui::rgb(0x353535), b);
    let bottom = brighten(gpui::rgb(0x272727), b);
    outline.fill(
        0.0,
        (0.0, 0.0),
        mix(top, gpui::white(), lerp(0.14, 0.08)),
        window,
    );
    let (y0, y1) = outline.y_range(0.0, (0.0, 1.0));
    let span = (y1 - y0).max(1.0);
    let body_top = body.center.1 - body.half.1;
    let body_bottom = body.center.1 + body.half.1;
    outline.fill(
        0.0,
        (0.0, 1.0),
        linear_gradient(
            180.0,
            linear_color_stop(top, (body_top - y0) / span),
            linear_color_stop(bottom, (body_bottom - y0) / span),
        ),
        window,
    );

    // The glowing core: a soft filament from an ember in the slab out to
    // the blob, built from stacked translucent layers.
    let emerge = smoothstep(0.0, 14.0, s.length);
    let source = match p.pose.tear {
        Some((tear, left)) => Some((tear.exit, tear.dir, left)),
        None if s.length > 0.5 && !p.pose.detached => Some((s.exit, s.dir, emerge)),
        None => None,
    };
    if p.heat > 0.01
        && let Some((exit, dir, presence)) = source
    {
        let ember = (body.half.1 * 0.75).min(13.0);
        let ember_at = sub(exit, mul(dir, ember));
        const LAYERS: usize = 7;
        for i in 0..LAYERS {
            let t = i as f32 / (LAYERS - 1) as f32;
            let f = 1.0 - 0.8 * t;
            let mut builder = PathBuilder::fill().with_style(PathStyle::Fill(
                FillOptions::default().with_fill_rule(FillRule::NonZero),
            ));
            let mut add = |c: Capsule| capsule_polygon(c, bounds.origin, &mut builder);
            add(Capsule {
                a: ember_at,
                b: ember_at,
                r: ember * f,
            });
            if !p.pose.detached && s.length > 0.5 {
                add(Capsule {
                    a: ember_at,
                    b: s.tip,
                    r: s.neck * f * emerge * 0.9,
                });
                add(Capsule {
                    a: s.tip,
                    b: s.tip,
                    r: s.blob * f * 0.85,
                });
            }
            if let Ok(path) = builder.build() {
                let alpha = (0.07 + 0.11 * t) * p.heat * presence;
                window.paint_path(path, with_alpha(p.accent, alpha));
            }
        }
    }

    outline.stroke(-0.5, 1.0, rgb_a(0xffffff, lerp(0.06, 0.05)), window);
    outline.stroke(0.5, 1.0, rgb_a(0x000000, 0.9), window);
}

impl RenderOnce for StretchyButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<StretchState>| {
                let now = Instant::now();
                StretchState {
                    motion: PressMotion::new(),
                    pull: Spring2::default(),
                    squash: Spring1::default(),
                    squash_axis: (0.0, 1.0),
                    dent: Spring1::default(),
                    dent_x: 0.0,
                    anchor: (0.0, 0.0),
                    drag: None,
                    tear: None,
                    detached: false,
                    heat: Transition::new(0.0),
                    snapped_until: None,
                    snap_task: None,
                    suppress_click: false,
                    last: now,
                    born: now,
                    bounds: Rc::new(Cell::new(None)),
                    focus: cx.focus_handle().tab_stop(true),
                    reach: 80.0,
                    tear_at: 170.0,
                    wobble: 0.6,
                    on_tear: None,
                }
            });
        let now = Instant::now();
        let (reach, tear_at, wobble) = (self.reach.max(1.0), self.tear_at.max(1.0), self.wobble);
        let on_tear = self.on_tear.clone();
        let (paint, grabbing, animating, strain, snapped, focus, bounds_cell) =
            state.update(cx, |s, _| {
                s.reach = reach;
                s.tear_at = tear_at;
                s.wobble = wobble;
                s.on_tear = on_tear;
                s.advance(now);
                let frame = s.motion.frame(now);
                let paint = Paint {
                    pose: s.pose(now, frame.scale),
                    frame,
                    heat: s.heat.value(now).clamp(0.0, 1.0),
                    accent: self.accent,
                    focus_visible: false,
                };
                (
                    paint,
                    s.drag.is_some(),
                    s.animating(now) || frame.animating,
                    s.strain(),
                    s.snapped_until.is_some_and(|t| now < t),
                    s.focus.clone(),
                    s.bounds.clone(),
                )
            });
        let focus_visible = {
            let s = state.read(cx);
            (s.motion.focus_visible || window.last_input_was_keyboard()) && focus.is_focused(window)
        };
        let paint = Paint {
            focus_visible,
            ..paint
        };
        if animating {
            window.request_animation_frame();
        }

        let label = if snapped {
            self.snap_label.clone()
        } else if grabbing && strain >= 0.22 && !self.strain_labels.is_empty() {
            let n = self.strain_labels.len();
            let i = (((strain - 0.22) / 0.78) * n as f32) as usize;
            self.strain_labels[i.min(n - 1)].clone()
        } else {
            self.label.clone()
        };
        // Reserve the widest label so the slab never changes width.
        let all_labels: Vec<SharedString> = std::iter::once(self.label.clone())
            .chain(self.strain_labels.iter().cloned())
            .chain(std::iter::once(self.snap_label.clone()))
            .collect();

        let size = bounds_cell
            .get()
            .map(|b| (b.size.width.as_f32(), b.size.height.as_f32()));
        let shift = size
            .filter(|_| paint.pose.deformed())
            .map(|size| {
                let body = Body::new(&paint.pose, size);
                sub(body.center, (size.0 / 2.0, size.1 / 2.0))
            })
            .unwrap_or((0.0, 0.0));
        // The label warms up with the goo.
        let text = mix(
            surface_text(paint.frame.brightness),
            mix(gpui::white(), self.accent, 0.35),
            paint.heat * 0.7,
        );
        let scale = paint.frame.scale;

        let interactive = !self.disabled;
        let canvas_state = state.clone();
        let button = div()
            .id(self.id.clone())
            .relative()
            .flex()
            .flex_none()
            .h(px(HEIGHT))
            .px(px(18.0))
            .items_center()
            .justify_center()
            .whitespace_nowrap()
            .font_weight(FontWeight::MEDIUM)
            .text_size(px(14.0))
            .line_height(px(20.0))
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    move |bounds, _, _| bounds_cell.set(Some(bounds)),
                    move |bounds, _, window, _| {
                        paint_goo(bounds, &paint, window);
                        if !grabbing {
                            return;
                        }
                        // Track the pull anywhere in the window (pointer capture).
                        let moved = canvas_state.clone();
                        window.on_mouse_event(move |e: &MouseMoveEvent, phase, window, cx| {
                            if phase != DispatchPhase::Bubble {
                                return;
                            }
                            let tore = moved.update(cx, |s, cx| {
                                let tore = if e.pressed_button == Some(MouseButton::Left) {
                                    s.drag_to(e.position, cx)
                                } else {
                                    s.release();
                                    false
                                };
                                cx.notify();
                                tore.then(|| s.on_tear.clone()).flatten()
                            });
                            if let Some(handler) = tore {
                                handler(window, cx);
                            }
                        });
                        let released = canvas_state.clone();
                        window.on_mouse_event(move |e: &MouseUpEvent, phase, _, cx| {
                            if phase == DispatchPhase::Bubble && e.button == MouseButton::Left {
                                released.update(cx, |s, cx| {
                                    if s.release() {
                                        cx.notify();
                                    }
                                });
                            }
                        });
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            // Sizes the slab to its widest label.
            .child(
                div()
                    .invisible()
                    .flex()
                    .flex_col()
                    .children(all_labels.into_iter().map(|l| div().h(px(0.0)).child(l))),
            )
            .child(
                div()
                    .absolute()
                    .top(px(shift.1))
                    .left(px(shift.0))
                    .size_full()
                    .flex()
                    .items_center()
                    .justify_center()
                    .text_color(text)
                    .child(scaled_content(scale, move |s| {
                        div()
                            .text_size(px(14.0 * s))
                            .line_height(px(20.0 * s))
                            .child(label.clone())
                            .into_any_element()
                    })),
            );
        if !interactive {
            return button;
        }

        let hover = state.clone();
        let down = state.clone();
        let keys = state.clone();
        let click = state.clone();
        let focus_for_down = focus.clone();
        let on_click = self.on_click.clone();
        button
            .track_focus(&focus)
            .cursor(if grabbing {
                CursorStyle::ClosedHand
            } else {
                CursorStyle::OpenHand
            })
            .on_hover(move |hovered, _, cx| {
                hover.update(cx, |s, cx| {
                    if s.motion.set_hovered(*hovered) {
                        cx.notify();
                    }
                });
            })
            .on_mouse_down(MouseButton::Left, move |e, window, cx| {
                window.focus(&focus_for_down, cx);
                down.update(cx, |s, cx| {
                    let Some(b) = s.bounds.get() else {
                        return;
                    };
                    let (w, h) = (b.size.width.as_f32(), b.size.height.as_f32());
                    s.advance(Instant::now());
                    s.anchor = (
                        (e.position.x - b.origin.x).as_f32().clamp(4.0, w - 4.0),
                        (e.position.y - b.origin.y).as_f32().clamp(4.0, h - 4.0),
                    );
                    s.drag = Some(Drag {
                        start: e.position,
                        raw: (0.0, 0.0),
                    });
                    s.detached = false;
                    s.suppress_click = false;
                    s.motion.focus_visible = false;
                    s.motion.press();
                    cx.notify();
                });
            })
            .on_key_down(move |e, _, cx| {
                if is_activation_key(e.keystroke.key.as_str()) {
                    keys.update(cx, |s, _| s.motion.focus_visible = true);
                }
            })
            .on_click(move |e, window, cx| {
                let fire = click.update(cx, |s, cx| {
                    if s.suppress_click && !e.is_keyboard() {
                        // A pull is not a click.
                        s.suppress_click = false;
                        return false;
                    }
                    s.advance(Instant::now());
                    let b = s.bounds.get();
                    s.dent_x = match (b, e.is_keyboard()) {
                        (Some(b), false) => (e.position().x - b.origin.x).as_f32(),
                        (Some(b), true) => b.size.width.as_f32() / 2.0,
                        (None, _) => 0.0,
                    };
                    // A poke dents the slab where it landed and sets it jiggling.
                    s.dent.vel += 110.0 * (0.5 + s.wobble);
                    s.squash_axis = (0.0, 1.0);
                    s.squash.vel += 30.0 * (0.5 + s.wobble);
                    cx.notify();
                    true
                });
                if fire && let Some(handler) = on_click.as_ref() {
                    handler(e, window, cx);
                }
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rest_pose() -> Pose {
        Pose {
            pull: (0.0, 0.0),
            anchor: (60.0, 19.0),
            scale: 1.0,
            squash: 0.0,
            squash_axis: (0.0, 1.0),
            dent: 0.0,
            dent_x: 0.0,
            reach: 80.0,
            tremble: (0.0, 0.0),
            tear: None,
            detached: false,
        }
    }

    #[test]
    fn rest_traces_the_slab() {
        let (goo, _) = Goo::new(&rest_pose(), (120.0, HEIGHT));
        let loops = trace(|p| goo.sdf(p), goo.extent(), GRID);
        assert_eq!(loops.len(), 1);
        let (lo, hi) = loops[0].iter().fold(
            ((f32::MAX, f32::MAX), (f32::MIN, f32::MIN)),
            |(lo, hi), &(x, y)| ((lo.0.min(x), lo.1.min(y)), (hi.0.max(x), hi.1.max(y))),
        );
        assert!(lo.0.abs() < 0.2 && lo.1.abs() < 0.2, "{lo:?}");
        assert!(
            (hi.0 - 120.0).abs() < 0.2 && (hi.1 - HEIGHT).abs() < 0.2,
            "{hi:?}"
        );
    }

    #[test]
    fn pulling_draws_out_a_resisting_strand() {
        let mut pose = rest_pose();
        pose.pull = (0.0, -60.0);
        let near = strand(&pose, (120.0, HEIGHT));
        pose.pull = (0.0, -400.0);
        let far = strand(&pose, (120.0, HEIGHT));
        assert!(near.length > 10.0);
        assert!(far.length > near.length && far.length <= 80.0);
        assert!(far.neck < near.neck);
        let (goo, s) = Goo::new(&pose, (120.0, HEIGHT));
        assert!(goo.sdf(s.tip) < 0.0, "the blob is part of the goo");
        assert_eq!(trace(|p| goo.sdf(p), goo.extent(), GRID).len(), 1);
    }
}
