//! SlideToDetonate: a slide-to-confirm safety gate. Drag the handle across the
//! fuse (which pushes back) and let go past the threshold to detonate.

use gpui::{
    App, Bounds, BoxShadow, Context, Corners, CursorStyle, DispatchPhase, ElementId, FocusHandle,
    FontWeight, Hsla, InteractiveElement, IntoElement, KeyDownEvent, MouseButton, MouseMoveEvent,
    MouseUpEvent, ParentElement, PathBuilder, PathStyle, Pixels, RenderOnce, Rgba, SharedString,
    StatefulInteractiveElement, StrokeOptions, Styled, Subscription, Task, TextRun, Window, canvas,
    div, linear_color_stop, linear_gradient, point, prelude::FluentBuilder, px, quad,
    transparent_black,
};
use lyon::tessellation::{LineCap, LineJoin};
use std::{cell::Cell, rc::Rc};

use crate::icons::{Icon, paint_icon};
use crate::motion::{Duration, Easing, Instant, Transition};
use crate::surface::{brighten, ms, rgb_a};

/// Surface style: a recessed dark groove or a light one.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum SlideToDetonateVariant {
    #[default]
    Dark,
    Light,
}

type ConfirmHandler = Rc<dyn Fn(&mut Window, &mut App)>;

/// Drag the handle all the way across to fire `on_confirm`.
///
/// ```ignore
/// SlideToDetonate::new("launch")
///     .label("Slide to detonate")
///     .on_confirm(|_, _| launch_the_missiles())
/// ```
#[derive(IntoElement)]
pub struct SlideToDetonate {
    id: ElementId,
    label: SharedString,
    threshold: f32,
    reset_after: Duration,
    resistance: f32,
    smoothness: f32,
    variant: SlideToDetonateVariant,
    disabled: bool,
    on_confirm: Option<ConfirmHandler>,
}

impl SlideToDetonate {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: "Slide to detonate".into(),
            threshold: 0.9,
            reset_after: ms(1600),
            resistance: 0.35,
            smoothness: 0.4,
            variant: SlideToDetonateVariant::Dark,
            disabled: false,
            on_confirm: None,
        }
    }

    /// Track label shown while idle. Defaults to "Slide to detonate".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Fraction of the track (0–1) the handle must cross to arm the action. Defaults to 0.9.
    pub fn threshold(mut self, threshold: f32) -> Self {
        self.threshold = threshold;
        self
    }

    /// How long to stay detonated before resetting. `Duration::ZERO` stays. Defaults to 1.6s.
    pub fn reset_after(mut self, reset_after: Duration) -> Self {
        self.reset_after = reset_after;
        self
    }

    /// How hard the fuse pushes back (0–1). At 0 the handle tracks the pointer
    /// one to one; higher values make it lag further behind toward the end. Defaults to 0.35.
    pub fn resistance(mut self, resistance: f32) -> Self {
        self.resistance = resistance;
        self
    }

    /// How softly the handle follows the pointer (0–1). At 0 it is locked to
    /// the pointer; higher values glide behind on a looser spring. Defaults to 0.4.
    pub fn smoothness(mut self, smoothness: f32) -> Self {
        self.smoothness = smoothness;
        self
    }

    /// Dark (default) or light groove.
    pub fn variant(mut self, variant: SlideToDetonateVariant) -> Self {
        self.variant = variant;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired once the handle is released past the threshold.
    pub fn on_confirm(mut self, handler: impl Fn(&mut Window, &mut App) + 'static) -> Self {
        self.on_confirm = Some(Rc::new(handler));
        self
    }
}

const HANDLE: f32 = 40.0;
const TRACK_PADDING: f32 = 4.0;
const TRACK_WIDTH: f32 = 288.0;
const TRACK_HEIGHT: f32 = 48.0;
/// Keyboard step as a fraction of the track.
const KEY_STEP: f32 = 0.1;
/// Farthest in px the handle stretches when pulled back past the start.
const PULL_BACK: f32 = 10.0;
/// Label shimmer period.
const SHIMMER: f32 = 2.6;

#[derive(Clone, Copy, Debug, PartialEq)]
struct SpringConfig {
    stiffness: f32,
    damping: f32,
    mass: f32,
}

const SNAP_BACK: SpringConfig = SpringConfig {
    stiffness: 520.0,
    damping: 34.0,
    mass: 0.7,
};
const SNAP_END: SpringConfig = SpringConfig {
    stiffness: 700.0,
    damping: 40.0,
    mass: 1.0,
};

/// Spring that follows the pointer: stiff and critically damped at 0, loose and floaty at 1.
fn follow_spring(smoothness: f32) -> SpringConfig {
    let s = smoothness.clamp(0.0, 1.0);
    SpringConfig {
        stiffness: 1400.0 - s * 1220.0,
        damping: 70.0 - s * 46.0,
        mass: 0.4 + s * 0.4,
    }
}

/// Pointer travel (0–1) to handle travel (0–1); resistance bends the curve so the end is heavier.
fn resist(t: f32, resistance: f32) -> f32 {
    t.powf(1.0 + resistance * 1.5)
}

fn unresist(t: f32, resistance: f32) -> f32 {
    t.powf(1.0 / (1.0 + resistance * 1.5))
}

/// The handle's x, like a motion value: set directly or animated by a spring
/// that inherits the current velocity.
#[derive(Clone, Copy, Debug)]
struct Handle {
    value: f32,
    velocity: f32,
    target: f32,
    spring: Option<SpringConfig>,
    last: Instant,
}

impl Handle {
    fn new() -> Self {
        Self {
            value: 0.0,
            velocity: 0.0,
            target: 0.0,
            spring: None,
            last: Instant::now(),
        }
    }

    fn step(&mut self, now: Instant) -> f32 {
        let mut remaining = now
            .saturating_duration_since(self.last)
            .as_secs_f32()
            .min(0.064);
        self.last = now;
        let Some(c) = self.spring else {
            return self.value;
        };
        while remaining > 0.0 {
            let h = remaining.min(1.0 / 240.0);
            let force = -c.stiffness * (self.value - self.target) - c.damping * self.velocity;
            self.velocity += force / c.mass * h;
            self.value += self.velocity * h;
            remaining -= h;
        }
        if (self.value - self.target).abs() < 0.05 && self.velocity.abs() < 1.0 {
            self.value = self.target;
            self.velocity = 0.0;
            self.spring = None;
        }
        self.value
    }

    fn move_to(&mut self, to: f32, spring: Option<SpringConfig>) {
        let now = Instant::now();
        let dt = now.saturating_duration_since(self.last).as_secs_f32();
        self.step(now);
        match spring {
            Some(config) => {
                self.target = to;
                self.spring = Some(config);
            }
            None => {
                // A direct set; remember the speed so a later spring carries it.
                if dt > 0.0 {
                    self.velocity = (to - self.value) / dt.max(1.0 / 120.0);
                }
                self.value = to;
                self.target = to;
                self.spring = None;
            }
        }
    }

    fn animating(&self) -> bool {
        self.spring.is_some()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Phase {
    Idle,
    Sliding,
    Success,
}

struct SlideState {
    phase: Phase,
    armed: bool,
    handle: Handle,
    /// Pointer x (window coordinates) at which the handle would sit at the start.
    origin: f32,
    dragging: bool,
    hovered: bool,
    focus_visible: bool,
    /// `hover:brightness-110`, 200ms.
    brightness: Transition,
    /// Armed glow / lit icon, 0..1, 200ms.
    glow: Transition,
    bounds: Rc<Cell<Option<Bounds<Pixels>>>>,
    task: Option<Task<()>>,
    focus: FocusHandle,
    _blur: Option<Subscription>,
    // Latest props.
    threshold: f32,
    resistance: f32,
    smoothness: f32,
    reset_after: Duration,
    on_confirm: Option<ConfirmHandler>,
}

impl SlideState {
    fn range(&self) -> f32 {
        let width = self
            .bounds
            .get()
            .map_or(TRACK_WIDTH, |b| b.size.width.as_f32());
        (width - HANDLE - TRACK_PADDING * 2.0).max(0.0)
    }

    fn set_armed(&mut self, armed: bool) {
        self.armed = armed;
    }

    /// Detonates: snaps to the end, schedules the reset. Returns the handler to call.
    fn fire(&mut self, cx: &mut Context<Self>) -> Option<ConfirmHandler> {
        self.set_armed(false);
        self.dragging = false;
        self.phase = Phase::Success;
        let range = self.range();
        self.handle.move_to(range, Some(SNAP_END));
        let reset_after = self.reset_after;
        self.task = (!reset_after.is_zero()).then(|| {
            cx.spawn(async move |this, cx| {
                cx.background_executor().timer(reset_after).await;
                this.update(cx, |s, cx| {
                    s.phase = Phase::Idle;
                    s.handle.move_to(0.0, Some(SNAP_BACK));
                    cx.notify();
                })
                .ok();
            })
        });
        cx.notify();
        self.on_confirm.clone()
    }

    fn snap_back(&mut self) {
        self.set_armed(false);
        self.phase = Phase::Idle;
        self.handle.move_to(0.0, Some(SNAP_BACK));
    }

    fn start_drag(&mut self, pointer_x: f32) -> bool {
        let range = self.range();
        if self.phase == Phase::Success || range <= 0.0 {
            return false;
        }
        // Start from wherever the handle is, mapped back into pointer space.
        let current = (self.handle.step(Instant::now()) / range).clamp(0.0, 1.0);
        self.origin = pointer_x - unresist(current, self.resistance) * range;
        self.dragging = true;
        self.phase = Phase::Sliding;
        true
    }

    fn drag_to(&mut self, pointer_x: f32) {
        let range = self.range();
        if !self.dragging || range <= 0.0 {
            return;
        }
        let raw = pointer_x - self.origin;
        let next = if raw < 0.0 {
            // Rubber-band a little when pulled back past the start.
            -PULL_BACK * (1.0 - 1.0 / (1.0 + -raw / 60.0))
        } else {
            resist((raw / range).clamp(0.0, 1.0), self.resistance) * range
        };
        let spring = (self.smoothness > 0.0).then(|| follow_spring(self.smoothness));
        self.handle.move_to(next, spring);
        self.set_armed(next / range >= self.threshold.clamp(0.0, 1.0));
    }

    fn end_drag(&mut self, cx: &mut Context<Self>) -> Option<ConfirmHandler> {
        if !self.dragging {
            return None;
        }
        self.dragging = false;
        if self.armed {
            self.fire(cx)
        } else {
            self.snap_back();
            cx.notify();
            None
        }
    }

    fn key(&mut self, key: &str, cx: &mut Context<Self>) -> (bool, Option<ConfirmHandler>) {
        let range = self.range();
        if self.phase == Phase::Success || range <= 0.0 {
            return (false, None);
        }
        let current = (self.handle.step(Instant::now()) / range).clamp(0.0, 1.0);
        let next = match key {
            "right" | "up" => current + KEY_STEP,
            "left" | "down" => current - KEY_STEP,
            "home" => 0.0,
            "end" => 1.0,
            _ => return (false, None),
        }
        .clamp(0.0, 1.0);
        if next >= self.threshold.clamp(0.0, 1.0) {
            return (true, self.fire(cx));
        }
        self.phase = if next > 0.0 {
            Phase::Sliding
        } else {
            Phase::Idle
        };
        self.handle
            .move_to(next * range, Some(follow_spring(self.smoothness)));
        cx.notify();
        (true, None)
    }
}

struct Look {
    track_bg: Hsla,
    trail_from: Hsla,
    trail_to: Hsla,
    trail_to_armed: Hsla,
    handle_top: Hsla,
    handle_bottom: Hsla,
    text: Hsla,
    text_lit: Hsla,
    shimmer: u32,
    ring: Hsla,
    ring_offset: Hsla,
}

impl Look {
    fn new(variant: SlideToDetonateVariant) -> Self {
        match variant {
            SlideToDetonateVariant::Dark => Self {
                track_bg: gpui::rgb(0x1c1c1c).into(),
                trail_from: rgb_a(0xffffff, 0.0),
                trail_to: rgb_a(0xffffff, 0.12),
                trail_to_armed: rgb_a(0xffffff, 0.2),
                handle_top: gpui::rgb(0x3a3a3a).into(),
                handle_bottom: gpui::rgb(0x2a2a2a).into(),
                text: rgb_a(0xfafafa, 0.7),
                text_lit: rgb_a(0xfafafa, 1.0),
                shimmer: 0xfafafa,
                ring: rgb_a(0xffffff, 0.4),
                ring_offset: gpui::rgb(0x1c1c1c).into(),
            },
            SlideToDetonateVariant::Light => Self {
                track_bg: gpui::rgb(0xf5f5f5).into(),
                trail_from: rgb_a(0x000000, 0.0),
                trail_to: rgb_a(0x000000, 0.08),
                trail_to_armed: rgb_a(0x000000, 0.14),
                handle_top: gpui::rgb(0xffffff).into(),
                handle_bottom: gpui::rgb(0xfafafa).into(),
                text: gpui::rgb(0x737373).into(),
                text_lit: gpui::rgb(0x171717).into(),
                shimmer: 0x171717,
                ring: rgb_a(0x000000, 0.25),
                ring_offset: gpui::rgb(0xf5f5f5).into(),
            },
        }
    }
}

fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

fn mix(a: Hsla, b: Hsla, t: f32) -> Hsla {
    let (a, b) = (Rgba::from(a), Rgba::from(b));
    Rgba {
        r: lerp(a.r, b.r, t),
        g: lerp(a.g, b.g, t),
        b: lerp(a.b, b.b, t),
        a: lerp(a.a, b.a, t),
    }
    .into()
}

/// A CSS box-shadow (GPUI's blur radius is the gaussian sigma, half of CSS's).
fn shadow(x: f32, y: f32, blur: f32, spread: f32, color: Hsla, inset: bool) -> BoxShadow {
    BoxShadow {
        color,
        offset: point(px(x), px(y)),
        blur_radius: px(blur / 2.0),
        spread_radius: px(spread),
        inset,
    }
}

/// Lerps two equally long shadow lists.
fn shadows(rest: &[BoxShadow], lit: &[BoxShadow], t: f32) -> Vec<BoxShadow> {
    rest.iter()
        .zip(lit)
        .map(|(a, b)| BoxShadow {
            color: mix(a.color, b.color, t),
            offset: point(
                px(lerp(a.offset.x.as_f32(), b.offset.x.as_f32(), t)),
                px(lerp(a.offset.y.as_f32(), b.offset.y.as_f32(), t)),
            ),
            blur_radius: px(lerp(a.blur_radius.as_f32(), b.blur_radius.as_f32(), t)),
            spread_radius: px(lerp(a.spread_radius.as_f32(), b.spread_radius.as_f32(), t)),
            inset: a.inset,
        })
        .collect()
}

fn paint_track(bounds: Bounds<Pixels>, variant: SlideToDetonateVariant, window: &mut Window) {
    let look = Look::new(variant);
    let radii = Corners::all(bounds.size.height / 2.0);
    let (drop, inset) = match variant {
        SlideToDetonateVariant::Dark => (
            vec![
                shadow(0.0, 1.0, 0.0, 0.0, rgb_a(0xffffff, 0.04), false),
                shadow(0.0, 0.0, 0.0, 1.0, rgb_a(0x000000, 0.9), false),
            ],
            vec![
                shadow(0.0, 2.0, 6.0, 0.0, rgb_a(0x000000, 0.5), true),
                shadow(0.0, 0.0, 0.0, 1.0, rgb_a(0xffffff, 0.05), true),
            ],
        ),
        SlideToDetonateVariant::Light => (
            vec![
                shadow(0.0, 1.0, 0.0, 0.0, rgb_a(0xffffff, 0.9), false),
                shadow(0.0, 0.0, 0.0, 1.0, rgb_a(0x000000, 0.08), false),
            ],
            vec![
                shadow(0.0, 0.0, 0.0, 1.0, rgb_a(0x000000, 0.02), true),
                shadow(0.0, 1.0, 3.0, 0.0, rgb_a(0x000000, 0.08), true),
            ],
        ),
    };
    window.paint_drop_shadows(bounds, radii, &drop);
    window.paint_quad(quad(
        bounds,
        radii,
        look.track_bg,
        px(0.0),
        transparent_black(),
        Default::default(),
    ));
    window.paint_inset_shadows(bounds, radii, &inset);
}

#[derive(Clone, Copy)]
struct HandleFrame {
    variant: SlideToDetonateVariant,
    glow: f32,
    brightness: f32,
    focus_visible: bool,
    success: bool,
    icon_color: Hsla,
    /// The track, whose rounded ends clip the handle's shadows and glow.
    track: Option<Bounds<Pixels>>,
}

/// Paints drop shadows clipped to the pill `track` (CSS `overflow-hidden` on a
/// `rounded-full` box), one thin horizontal strip at a time.
fn paint_clipped_shadows(
    bounds: Bounds<Pixels>,
    radii: Corners<Pixels>,
    shadows: &[BoxShadow],
    track: Option<Bounds<Pixels>>,
    window: &mut Window,
) {
    let Some(track) = track else {
        window.paint_drop_shadows(bounds, radii, shadows);
        return;
    };
    let h = track.size.height.as_f32();
    let r = h / 2.0;
    let strip = 1.0;
    let mut y = 0.0;
    while y < h {
        let mid = (y + strip / 2.0 - r).abs().min(r);
        let inset = r - (r * r - mid * mid).sqrt();
        let mask = Bounds::new(
            point(track.origin.x + px(inset), track.origin.y + px(y)),
            gpui::size(track.size.width - px(2.0 * inset), px(strip)),
        );
        window.with_content_mask(Some(gpui::ContentMask { bounds: mask }), |window| {
            window.paint_drop_shadows(bounds, radii, shadows);
        });
        y += strip;
    }
}

fn paint_handle(bounds: Bounds<Pixels>, f: HandleFrame, window: &mut Window) {
    let look = Look::new(f.variant);
    let radii = Corners::all(bounds.size.height / 2.0);
    if f.focus_visible {
        window.paint_drop_shadows(
            bounds,
            radii,
            &[
                shadow(0.0, 0.0, 0.0, 4.0, look.ring, false),
                shadow(0.0, 0.0, 0.0, 2.0, look.ring_offset, false),
            ],
        );
    }
    let black = |a: f32| rgb_a(0x000000, a);
    let white = |a: f32| rgb_a(0xffffff, a);
    let (drop, inset) = match f.variant {
        SlideToDetonateVariant::Dark => (
            shadows(
                &[
                    shadow(0.0, 4.0, 10.0, -2.0, black(0.5), false),
                    shadow(0.0, 1.0, 2.0, 0.0, black(0.3), false),
                    shadow(0.0, 0.0, 0.0, 1.0, black(0.9), false),
                ],
                &[
                    shadow(0.0, 0.0, 16.0, -2.0, white(0.35), false),
                    shadow(0.0, 1.0, 2.0, 0.0, black(0.3), false),
                    shadow(0.0, 0.0, 0.0, 1.0, black(0.9), false),
                ],
                f.glow,
            ),
            shadows(
                &[
                    shadow(0.0, 1.0, 0.0, 0.0, white(0.16), true),
                    shadow(0.0, 0.0, 0.0, 1.0, white(0.06), true),
                ],
                &[
                    shadow(0.0, 1.0, 0.0, 0.0, white(0.2), true),
                    shadow(0.0, 0.0, 0.0, 1.0, white(0.18), true),
                ],
                f.glow,
            ),
        ),
        SlideToDetonateVariant::Light => (
            shadows(
                &[
                    shadow(0.0, 4.0, 10.0, -2.0, black(0.12), false),
                    shadow(0.0, 1.0, 2.0, 0.0, black(0.1), false),
                    shadow(0.0, 0.0, 0.0, 1.0, black(0.1), false),
                ],
                &[
                    shadow(0.0, 0.0, 14.0, -2.0, black(0.22), false),
                    shadow(0.0, 1.0, 2.0, 0.0, black(0.12), false),
                    shadow(0.0, 0.0, 0.0, 1.0, black(0.22), false),
                ],
                f.glow,
            ),
            vec![shadow(0.0, 1.0, 0.0, 0.0, white(1.0), true)],
        ),
    };
    paint_clipped_shadows(bounds, radii, &drop, f.track, window);
    window.paint_quad(quad(
        bounds,
        radii,
        linear_gradient(
            180.0,
            linear_color_stop(brighten(look.handle_top, f.brightness), 0.0),
            linear_color_stop(brighten(look.handle_bottom, f.brightness), 1.0),
        ),
        px(0.0),
        transparent_black(),
        Default::default(),
    ));
    window.paint_inset_shadows(bounds, radii, &inset);

    let icon = Bounds::centered_at(bounds.center(), gpui::size(px(16.0), px(16.0)));
    if f.success {
        paint_icon(Icon::Check, icon, 2.25, 1.0, f.icon_color, window);
    } else {
        paint_chevrons(icon, f.icon_color, window);
    }
}

/// `m6 17 5-5-5-5` + `m13 17 5-5-5-5` on a 24 grid.
fn paint_chevrons(bounds: Bounds<Pixels>, color: Hsla, window: &mut Window) {
    let unit = bounds.size.width.as_f32() / 24.0;
    let o = bounds.origin;
    let p = |x: f32, y: f32| point(o.x + px(x * unit), o.y + px(y * unit));
    let w = 2.0 * unit;
    let options = StrokeOptions::default()
        .with_line_width(w)
        .with_line_cap(LineCap::Round)
        .with_line_join(LineJoin::Round);
    let mut b = PathBuilder::stroke(px(w)).with_style(PathStyle::Stroke(options));
    for x in [6.0, 13.0] {
        b.move_to(p(x, 17.0));
        b.line_to(p(x + 5.0, 12.0));
        b.line_to(p(x, 7.0));
    }
    if let Ok(path) = b.build() {
        window.paint_path(path, color);
    }
}

/// Paints `text` glyph by glyph, centred in `bounds`, colouring each glyph by
/// its centre x (so a moving gradient can sweep across the letters).
fn paint_label(
    text: &SharedString,
    bounds: Bounds<Pixels>,
    color_at: impl Fn(f32, f32) -> Hsla,
    window: &mut Window,
    cx: &mut App,
) {
    let font_size = px(14.0);
    let line_height = px(20.0);
    let mut font = window.text_style().font();
    font.weight = FontWeight::MEDIUM;
    let run = TextRun {
        len: text.len(),
        font,
        color: gpui::black(),
        background_color: None,
        underline: None,
        strikethrough: None,
    };
    let line = window
        .text_system()
        .shape_line(text.clone(), font_size, &[run], None);
    let width = line.width;
    let origin = point(
        bounds.center().x - width / 2.0,
        bounds.center().y - line_height / 2.0,
    );
    let baseline = origin.y + (line_height - line.ascent - line.descent) / 2.0 + line.ascent;
    let xs: Vec<f32> = line
        .runs
        .iter()
        .flat_map(|r| r.glyphs.iter().map(|g| g.position.x.as_f32()))
        .chain(std::iter::once(width.as_f32()))
        .collect();
    let mut i = 0;
    for run in &line.runs {
        for glyph in &run.glyphs {
            let center = (xs[i] + xs[i + 1]) / 2.0;
            i += 1;
            let color = color_at(center, width.as_f32());
            let at = point(origin.x + glyph.position.x, baseline + glyph.position.y);
            if glyph.is_emoji {
                window
                    .paint_emoji(at, run.font_id, glyph.id, font_size)
                    .ok();
            } else {
                window
                    .paint_glyph(at, run.font_id, glyph.id, font_size, color)
                    .ok();
            }
        }
    }
    let _ = cx;
}

thread_local! {
    static CLOCK: Instant = Instant::now();
}

fn clock() -> f32 {
    CLOCK.with(|start| Instant::now().duration_since(*start).as_secs_f32())
}

impl RenderOnce for SlideToDetonate {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state = window.use_keyed_state(
            self.id.clone(),
            cx,
            |window, cx: &mut Context<SlideState>| {
                let focus = cx.focus_handle().tab_stop(true);
                // Keyboard progress doesn't linger once focus leaves.
                let blur = cx.on_blur(&focus, window, |s, _, cx| {
                    if s.phase != Phase::Success && s.handle.target != 0.0 {
                        s.dragging = false;
                        s.snap_back();
                        cx.notify();
                    }
                });
                SlideState {
                    phase: Phase::Idle,
                    armed: false,
                    handle: Handle::new(),
                    origin: 0.0,
                    dragging: false,
                    hovered: false,
                    focus_visible: false,
                    brightness: Transition::new(1.0),
                    glow: Transition::new(0.0),
                    bounds: Rc::new(Cell::new(None)),
                    task: None,
                    focus,
                    _blur: Some(blur),
                    threshold: 0.9,
                    resistance: 0.35,
                    smoothness: 0.4,
                    reset_after: ms(1600),
                    on_confirm: None,
                }
            },
        );

        let now = Instant::now();
        let disabled = self.disabled;
        let props = (
            self.threshold,
            self.resistance,
            self.smoothness,
            self.reset_after,
            self.on_confirm.clone(),
        );
        let (phase, armed, x, range, brightness, glow, dragging, animating) =
            state.update(cx, |s, _| {
                (
                    s.threshold,
                    s.resistance,
                    s.smoothness,
                    s.reset_after,
                    s.on_confirm,
                ) = props;
                let x = s.handle.step(now);
                let lit = s.armed || s.phase == Phase::Success;
                let ease = Easing::STANDARD;
                s.glow
                    .animate_to(if lit { 1.0 } else { 0.0 }, ms(200), ease);
                let hover = s.hovered && !disabled;
                s.brightness
                    .animate_to(if hover { 1.1 } else { 1.0 }, ms(200), ease);
                let animating = s.handle.animating()
                    || s.glow.is_animating(now)
                    || s.brightness.is_animating(now);
                (
                    s.phase,
                    s.armed,
                    x,
                    s.range(),
                    s.brightness.value(now),
                    s.glow.value(now).clamp(0.0, 1.0),
                    s.dragging,
                    animating,
                )
            });
        let (focus, focus_visible, bounds_cell) = {
            let s = state.read(cx);
            (
                s.focus.clone(),
                (s.focus_visible || window.last_input_was_keyboard()) && s.focus.is_focused(window),
                s.bounds.clone(),
            )
        };
        let success = phase == Phase::Success;
        // The label shimmers forever, so keep frames coming while it shows.
        let shimmering = !success && !disabled;
        if animating || shimmering {
            window.request_animation_frame();
        }

        let variant = self.variant;
        let look = Look::new(variant);
        let progress = if range > 0.0 {
            (x / range).clamp(0.0, 1.0)
        } else {
            0.0
        };
        let label_opacity = (1.0 - progress / 0.6).clamp(0.0, 1.0);
        let trail_width = x.max(0.0) + HANDLE;
        let trail_opacity = if progress < 0.15 {
            progress / 0.15 * 0.55
        } else {
            0.55 + (progress - 0.15) / 0.85 * 0.45
        };
        let trail_to = if armed || success {
            look.trail_to_armed
        } else {
            look.trail_to
        };
        let (trail_from, trail_to) = (
            look.trail_from.opacity(trail_opacity),
            trail_to.opacity(trail_opacity),
        );
        let handle_frame = HandleFrame {
            variant,
            glow,
            brightness,
            focus_visible,
            success,
            icon_color: mix(look.text, look.text_lit, glow),
            track: state.read(cx).bounds.get(),
        };

        // Shimmer: a 250%-wide gradient (40% → 95% → 40%) sliding right over 2.6s.
        let shimmer_peak = if shimmering {
            let p = 1.0 - (clock() % SHIMMER) / SHIMMER;
            1.25 - 1.5 * p
        } else {
            0.5
        };
        let shimmer_rgb = look.shimmer;
        let label = self.label.clone();

        let track_state = state.clone();
        div()
            .id(self.id.clone())
            .relative()
            .flex_none()
            .w(px(TRACK_WIDTH))
            .h(px(TRACK_HEIGHT))
            .when(disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    move |bounds, _, _| bounds_cell.set(Some(bounds)),
                    move |bounds, _, window, _| {
                        paint_track(bounds, variant, window);
                        if !dragging {
                            return;
                        }
                        // Follow the pointer anywhere in the window while dragging.
                        let moved = track_state.clone();
                        window.on_mouse_event(move |e: &MouseMoveEvent, phase, _, cx| {
                            if phase != DispatchPhase::Bubble {
                                return;
                            }
                            moved.update(cx, |s, cx| {
                                s.drag_to(e.position.x.as_f32());
                                cx.notify();
                            });
                        });
                        let released = track_state.clone();
                        window.on_mouse_event(move |e: &MouseUpEvent, phase, window, cx| {
                            if phase != DispatchPhase::Bubble || e.button != MouseButton::Left {
                                return;
                            }
                            if let Some(handler) = released.update(cx, |s, cx| s.end_drag(cx)) {
                                handler(window, cx);
                            }
                        });
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            .child(
                div()
                    .absolute()
                    .top_0()
                    .left_0()
                    .size_full()
                    .overflow_hidden()
                    // Trail that fills in behind the handle.
                    .child(
                        div()
                            .absolute()
                            .top(px(TRACK_PADDING))
                            .left(px(TRACK_PADDING))
                            .h(px(HANDLE))
                            .w(px(trail_width))
                            .rounded_full()
                            .bg(linear_gradient(
                                90.0,
                                linear_color_stop(trail_from, 0.0),
                                linear_color_stop(trail_to, 1.0),
                            )),
                    )
                    // Label, centred in the free part of the track right of the handle.
                    .when(!success && label_opacity > 0.001, |el| {
                        el.child(
                            canvas(
                                |_, _, _| {},
                                move |bounds, _, window, cx| {
                                    paint_label(
                                        &label,
                                        bounds,
                                        |center, width| {
                                            let d = (center / width - shimmer_peak).abs();
                                            let k = (1.0 - d / 0.25).max(0.0);
                                            rgb_a(shimmer_rgb, (0.4 + 0.55 * k) * label_opacity)
                                        },
                                        window,
                                        cx,
                                    );
                                },
                            )
                            .absolute()
                            .top_0()
                            .bottom_0()
                            .left(px(44.0))
                            .right_0(),
                        )
                    })
                    .child(self.handle(&state, &focus, handle_frame, x, phase)),
            )
    }
}

impl SlideToDetonate {
    fn handle(
        &self,
        state: &gpui::Entity<SlideState>,
        focus: &FocusHandle,
        frame: HandleFrame,
        x: f32,
        phase: Phase,
    ) -> impl IntoElement {
        let locked = self.disabled || phase == Phase::Success;
        let handle = div()
            .id("handle")
            .absolute()
            .top(px(TRACK_PADDING))
            .left(px(TRACK_PADDING + x))
            .size(px(HANDLE))
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| paint_handle(bounds, frame, window),
                )
                .size_full(),
            );
        if self.disabled {
            return handle.cursor_not_allowed();
        }
        let hover = state.clone();
        let down = state.clone();
        let keys = state.clone();
        let focus_for_down = focus.clone();
        handle
            .track_focus(focus)
            .cursor(if locked {
                CursorStyle::Arrow
            } else if phase == Phase::Sliding {
                CursorStyle::ClosedHand
            } else {
                CursorStyle::OpenHand
            })
            .on_hover(move |hovered, _, cx| {
                hover.update(cx, |s, cx| {
                    s.hovered = *hovered;
                    cx.notify();
                });
            })
            .on_mouse_down(MouseButton::Left, move |e, window, cx| {
                window.focus(&focus_for_down, cx);
                down.update(cx, |s, cx| {
                    s.focus_visible = false;
                    if s.start_drag(e.position.x.as_f32()) {
                        cx.notify();
                    }
                });
            })
            .on_key_down(move |e: &KeyDownEvent, window, cx| {
                let (handled, fired) = keys.update(cx, |s, cx| {
                    let r = s.key(e.keystroke.key.as_str(), cx);
                    if r.0 {
                        s.focus_visible = true;
                    }
                    r
                });
                if handled {
                    cx.stop_propagation();
                }
                if let Some(handler) = fired {
                    handler(window, cx);
                }
            })
    }
}
