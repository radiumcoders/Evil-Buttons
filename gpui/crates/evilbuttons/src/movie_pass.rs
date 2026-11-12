//! MoviePassButton: a cinema ticket that tears along its perforation on click,
//! hinging open (`Tilt`) or snapping apart (`Snap`), then mends itself.

use gpui::{
    App, Bounds, ClickEvent, Context, ElementId, FocusHandle, Font, FontWeight, Hsla,
    InteractiveElement, IntoElement, ParentElement, PathBuilder, Pixels, Point, RenderOnce,
    SharedString, StatefulInteractiveElement, Styled, Task, TextRun, Window, canvas, div,
    linear_color_stop, linear_gradient, point, prelude::FluentBuilder, px, transparent_black,
};
use std::{cell::Cell, rc::Rc};

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Duration, Instant};
use crate::surface::{PressFrame, PressMotion, brighten, ms, paint_focus_ring, rgb_a};

/// How the ticket tears on click.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum MoviePassVariant {
    /// Both halves hinge outward from the bottom of the perforation.
    #[default]
    Tilt,
    /// The stub splits off in a straight line, leaving a small gap.
    Snap,
}

type TearHandler = Rc<dyn Fn(&mut Window, &mut App)>;

/// A cinema ticket button that tears along its perforation on click.
///
/// ```ignore
/// MoviePassButton::new("admit", "Admit One")
///     .variant(MoviePassVariant::Snap)
///     .on_tear(|_, _| println!("Ripped!"))
/// ```
#[derive(IntoElement)]
pub struct MoviePassButton {
    id: ElementId,
    label: SharedString,
    stub: Option<SharedString>,
    variant: MoviePassVariant,
    reset_delay: Option<Duration>,
    stub_font: Option<SharedString>,
    disabled: bool,
    on_tear: Option<TearHandler>,
    on_click: Option<ClickHandler>,
}

impl MoviePassButton {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            stub: None,
            variant: MoviePassVariant::Tilt,
            reset_delay: Some(ms(1800)),
            stub_font: None,
            disabled: false,
            on_tear: None,
            on_click: None,
        }
    }

    /// How the ticket tears. Defaults to [`MoviePassVariant::Tilt`].
    pub fn variant(mut self, variant: MoviePassVariant) -> Self {
        self.variant = variant;
        self
    }

    /// Text on the tear-off stub. Defaults to a stacked "NO. 01".
    pub fn stub(mut self, stub: impl Into<SharedString>) -> Self {
        self.stub = Some(stub.into());
        self
    }

    /// How long before the ticket mends itself. `None` keeps it torn until
    /// the next click. Defaults to 1.8s.
    pub fn reset_delay(mut self, delay: Option<Duration>) -> Self {
        self.reset_delay = delay;
        self
    }

    /// Font family for the stub, e.g. your monospace font. Inherits by default.
    pub fn stub_font(mut self, family: impl Into<SharedString>) -> Self {
        self.stub_font = Some(family.into());
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired each time the ticket tears.
    pub fn on_tear(mut self, handler: impl Fn(&mut Window, &mut App) + 'static) -> Self {
        self.on_tear = Some(Rc::new(handler));
        self
    }

    /// Fired on every click, before the ticket tears or mends.
    pub fn on_click(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(handler));
        self
    }
}

/// `motion` spring config: stiffness, damping, mass.
type SpringParams = (f32, f32, f32);
const TILT_SPRING: SpringParams = (320.0, 13.0, 0.8);
const SNAP_SPRING: SpringParams = (700.0, 22.0, 0.6);
const MEND_SPRING: SpringParams = (420.0, 30.0, 1.0);

/// Torn pose per variant: `(main x, main rotate°, stub x, stub rotate°)`.
fn tear_pose(variant: MoviePassVariant) -> (f32, f32, f32, f32) {
    match variant {
        // Rotating around the shared bottom corners keeps the halves touching at
        // the bottom while a V opens along the perforation.
        MoviePassVariant::Tilt => (0.0, -6.0, 0.0, 10.0),
        MoviePassVariant::Snap => (-3.0, 0.0, 3.0, 0.0),
    }
}

/// A spring whose config can change mid-flight while keeping its velocity,
/// like `motion` switching from the tear spring to the mend spring.
#[derive(Clone, Copy)]
struct TearSpring {
    value: f32,
    velocity: f32,
    target: f32,
    params: SpringParams,
    last: Instant,
}

impl TearSpring {
    fn new() -> Self {
        Self {
            value: 0.0,
            velocity: 0.0,
            target: 0.0,
            params: MEND_SPRING,
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
        let (k, c, m) = self.params;
        const STEP: f32 = 1.0 / 240.0;
        let mut remaining = elapsed;
        while remaining > 0.0 {
            let h = remaining.min(STEP);
            let force = -k * (self.value - self.target) - c * self.velocity;
            self.velocity += force / m * h;
            self.value += self.velocity * h;
            remaining -= h;
        }
        if (self.value - self.target).abs() < 0.0005 && self.velocity.abs() < 0.005 {
            self.value = self.target;
            self.velocity = 0.0;
        }
        self.value
    }

    fn retarget(&mut self, target: f32, params: SpringParams) {
        self.advance(Instant::now());
        self.target = target;
        self.params = params;
    }
}

struct MoviePassState {
    motion: PressMotion,
    torn: bool,
    /// 0 intact → 1 torn (may overshoot).
    tear: TearSpring,
    /// Variant the current tear used, so a mend unwinds the same pose.
    torn_variant: MoviePassVariant,
    reset: Option<Task<()>>,
    focus: FocusHandle,
}

impl MoviePassState {
    fn mend(&mut self) {
        self.torn = false;
        self.reset = None;
        self.tear.retarget(0.0, MEND_SPRING);
    }
}

impl Pressable for MoviePassState {
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

/// Notch radius of the corner cutouts; the two halves' notches meet as
/// half-circle punches at the perforation.
const NOTCH: f32 = 6.0;
/// `h-11`.
const HEIGHT: f32 = 44.0;

impl RenderOnce for MoviePassButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state = window.use_keyed_state(
            self.id.clone(),
            cx,
            |_, cx: &mut Context<MoviePassState>| MoviePassState {
                motion: PressMotion::new(),
                torn: false,
                tear: TearSpring::new(),
                torn_variant: MoviePassVariant::Tilt,
                reset: None,
                focus: cx.focus_handle().tab_stop(true),
            },
        );
        let main_cell: Rc<Cell<Option<Bounds<Pixels>>>> = Rc::new(Cell::new(None));

        let now = Instant::now();
        let (frame, tear, variant, focus, focus_visible) = state.update(cx, |s, _| {
            let tear = s.tear.advance(now);
            (
                s.motion.frame(now),
                tear,
                s.torn_variant,
                s.focus.clone(),
                (s.motion.focus_visible || window.last_input_was_keyboard())
                    && s.focus.is_focused(window),
            )
        });
        if frame.animating || !state.read(cx).tear.settled() {
            window.request_animation_frame();
        }

        let (mx, mr, sx, sr) = tear_pose(variant);
        let pose = Pose {
            main_x: mx * tear,
            main_rot: mr * tear,
            stub_x: sx * tear,
            stub_rot: sr * tear,
        };
        let label = self.label.clone();
        let stub = self.stub.clone();
        let stub_font = self.stub_font.clone();
        let main_for_paint = main_cell.clone();
        let main_for_prepaint = main_cell.clone();

        // Layout boxes. Text in them is invisible; the canvas paints every glyph
        // itself so the label and stub can tilt with their halves.
        let stub_box = match &stub {
            Some(text) => div().text_size(px(12.0)).child(text.clone()),
            None => div()
                .flex()
                .flex_col()
                .items_center()
                .child(div().text_size(px(8.0)).line_height(px(8.0)).child("NO."))
                .child(
                    div()
                        .mt(px(2.0))
                        .text_size(px(12.0))
                        .line_height(px(12.0))
                        .child("01"),
                ),
        };

        let button = div()
            .id(self.id)
            .relative()
            .flex()
            .flex_none()
            .h(px(HEIGHT))
            .items_stretch()
            .text_size(px(14.0))
            .line_height(px(20.0))
            .font_weight(FontWeight::MEDIUM)
            .text_color(transparent_black())
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, cx| {
                        let Some(main) = main_for_paint.get() else {
                            return;
                        };
                        if focus_visible {
                            paint_focus_ring(
                                bounds,
                                px(0.0),
                                rgb_a(0xa1a1a1, 1.0),
                                rgb_a(0x0a0a0a, 1.0),
                                window,
                            );
                        }
                        let ticket = Ticket {
                            bounds,
                            main_w: main.size.width.as_f32(),
                            pose,
                            frame,
                        };
                        ticket.paint(&label, stub.as_ref(), stub_font.as_ref(), window, cx);
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            .child(
                div()
                    .relative()
                    .flex()
                    .items_center()
                    .px(px(24.0))
                    .whitespace_nowrap()
                    .child(
                        canvas(
                            move |bounds, _, _| main_for_prepaint.set(Some(bounds)),
                            |_, _, _, _| {},
                        )
                        .absolute()
                        .top_0()
                        .left_0()
                        .size_full(),
                    )
                    .child(self.label.clone()),
            )
            .child(
                div()
                    .flex()
                    .min_w(px(48.0))
                    .px(px(12.0))
                    .items_center()
                    .justify_center()
                    .whitespace_nowrap()
                    .when_some(self.stub_font.clone(), |el, f| el.font_family(f))
                    .child(stub_box),
            );

        let button = wire(button, &state, &focus, self.disabled);
        if self.disabled {
            return button;
        }
        let click_state = state.clone();
        let (reset_delay, tear_variant) = (self.reset_delay, self.variant);
        let on_tear = self.on_tear.clone();
        let on_click = self.on_click.clone();
        button.on_click(move |event, window, cx| {
            if let Some(handler) = on_click.as_ref() {
                handler(event, window, cx);
            }
            let tore = click_state.update(cx, |s, cx| {
                cx.notify();
                if s.torn {
                    s.mend();
                    return false;
                }
                s.torn = true;
                s.torn_variant = tear_variant;
                let params = match tear_variant {
                    MoviePassVariant::Tilt => TILT_SPRING,
                    MoviePassVariant::Snap => SNAP_SPRING,
                };
                s.tear.retarget(1.0, params);
                s.reset = reset_delay.map(|delay| {
                    cx.spawn(async move |this, cx| {
                        cx.background_executor().timer(delay).await;
                        this.update(cx, |s, cx| {
                            s.mend();
                            cx.notify();
                        })
                        .ok();
                    })
                });
                true
            });
            if tore && let Some(handler) = on_tear.as_ref() {
                handler(window, cx);
            }
        })
    }
}

#[derive(Clone, Copy)]
struct Pose {
    main_x: f32,
    main_rot: f32,
    stub_x: f32,
    stub_rot: f32,
}

/// A 2D affine map from a half's local box to window coordinates:
/// rotate about the half's pivot, translate, then the button's press scale.
#[derive(Clone, Copy)]
struct Placement {
    /// Half origin within the button, in window coordinates.
    origin: (f32, f32),
    pivot: (f32, f32),
    cos: f32,
    sin: f32,
    dx: f32,
    center: (f32, f32),
    scale: f32,
}

impl Placement {
    fn map(&self, (x, y): (f32, f32)) -> (f32, f32) {
        let (px_, py_) = (x - self.pivot.0, y - self.pivot.1);
        let rx = px_ * self.cos - py_ * self.sin + self.pivot.0;
        let ry = px_ * self.sin + py_ * self.cos + self.pivot.1;
        let (wx, wy) = (self.origin.0 + rx + self.dx, self.origin.1 + ry);
        (
            self.center.0 + (wx - self.center.0) * self.scale,
            self.center.1 + (wy - self.center.1) * self.scale,
        )
    }

    fn point(&self, p: (f32, f32)) -> Point<Pixels> {
        let (x, y) = self.map(p);
        point(px(x), px(y))
    }
}

struct Ticket {
    bounds: Bounds<Pixels>,
    main_w: f32,
    pose: Pose,
    frame: PressFrame,
}

/// A ticket half (`w`×`h`) with concave quarter-circle notches of radius `r` at
/// every corner, grown outward by `d` (negative shrinks): the edges move out by
/// `d` and each notch circle (still centred on its corner) shrinks to `r − d`.
/// Clockwise, local coords.
fn notched_outline(w: f32, h: f32, r: f32, d: f32) -> Vec<(f32, f32)> {
    const SEG: usize = 6;
    let radius = r - d;
    // (corner, direction into the half, whether the path reaches it along the
    // horizontal edge first).
    let corners = [
        ((w, 0.0), (-1.0, 1.0), true),
        ((w, h), (-1.0, -1.0), false),
        ((0.0, h), (1.0, -1.0), true),
        ((0.0, 0.0), (1.0, 1.0), false),
    ];
    let mut points = Vec::with_capacity(4 * (SEG + 1));
    for ((cx, cy), (sx, sy), horizontal_first) in corners {
        let (x_line, y_line) = (cx - sx * d, cy - sy * d);
        if radius <= d.abs() {
            // The notch is swallowed: a square corner.
            points.push((x_line, y_line));
            continue;
        }
        let reach = (radius * radius - d * d).sqrt();
        let on_h = (cx + sx * reach, y_line);
        let on_v = (x_line, cy + sy * reach);
        let (from, to) = if horizontal_first {
            (on_h, on_v)
        } else {
            (on_v, on_h)
        };
        let a0 = (from.1 - cy).atan2(from.0 - cx);
        let mut a1 = (to.1 - cy).atan2(to.0 - cx);
        let pi = std::f32::consts::PI;
        if a1 - a0 > pi {
            a1 -= 2.0 * pi;
        } else if a0 - a1 > pi {
            a1 += 2.0 * pi;
        }
        for s in 0..=SEG {
            let a = a0 + (a1 - a0) * s as f32 / SEG as f32;
            points.push((cx + radius * a.cos(), cy + radius * a.sin()));
        }
    }
    points
}

fn fill_polygon(
    points: &[Point<Pixels>],
    background: impl Into<gpui::Background>,
    window: &mut Window,
) {
    let mut builder = PathBuilder::fill();
    builder.add_polygon(points, true);
    if let Ok(path) = builder.build() {
        window.paint_path(path, background);
    }
}

impl Ticket {
    fn placements(&self) -> [(Placement, f32, f32); 2] {
        let (bx, by) = (self.bounds.origin.x.as_f32(), self.bounds.origin.y.as_f32());
        let w = self.bounds.size.width.as_f32();
        let h = self.bounds.size.height.as_f32();
        let center = (bx + w * 0.5, by + h * 0.5);
        let stub_w = (w - self.main_w).max(0.0);
        let place = |origin: (f32, f32), pivot: (f32, f32), deg: f32, dx: f32| {
            let a = deg.to_radians();
            Placement {
                origin,
                pivot,
                cos: a.cos(),
                sin: a.sin(),
                dx,
                center,
                scale: self.frame.scale,
            }
        };
        [
            // Main half pivots on its bottom-right corner (`transform-origin: 100% 100%`).
            (
                place(
                    (bx, by),
                    (self.main_w, h),
                    self.pose.main_rot,
                    self.pose.main_x,
                ),
                self.main_w,
                h,
            ),
            // Stub pivots on its bottom-left corner (`0% 100%`).
            (
                place(
                    (bx + self.main_w, by),
                    (0.0, h),
                    self.pose.stub_rot,
                    self.pose.stub_x,
                ),
                stub_w,
                h,
            ),
        ]
    }

    fn paint(
        &self,
        label: &SharedString,
        stub: Option<&SharedString>,
        stub_font: Option<&SharedString>,
        window: &mut Window,
        cx: &mut App,
    ) {
        let halves = self.placements();
        let s = self.frame.settle;
        let lerp = |a: f32, b: f32| a + (b - a) * s;

        // `filter: drop-shadow(...)` follows the notched outline, so each layer
        // is painted as grown copies of both halves, under both halves.
        // `drop-shadow()`'s blur length is the Gaussian's standard deviation.
        // 0 4px 5px rgb(0 0 0/.25) → 0 1px 1.5px rgb(0 0 0/.2)
        soft_shadow(
            &halves,
            lerp(4.0, 1.0),
            lerp(5.0, 1.5),
            lerp(0.25, 0.2),
            window,
        );
        // 0 1px 1px rgb(0 0 0/.25) → 0 0 1px rgb(0 0 0/.2)
        soft_shadow(&halves, lerp(1.0, 0.0), 1.0, lerp(0.25, 0.2), window);
        // Hairline ring: two `0 0 0.5px rgb(0 0 0/.9)` drop-shadows (σ tuned to
        // match Chrome's rendering of such a small blur).
        soft_shadow(&halves, 0.0, 0.3, 0.9, window);
        soft_shadow(&halves, 0.0, 0.3, 0.9, window);

        let b = self.frame.brightness;
        let (top, bottom) = (
            brighten(gpui::rgb(0x353535), b),
            brighten(gpui::rgb(0x272727), b),
        );
        for (index, (place, w, h)) in halves.into_iter().enumerate() {
            let angle = place.sin.atan2(place.cos).to_degrees();
            let outline: Vec<Point<Pixels>> = notched_outline(w, h, NOTCH, 0.0)
                .into_iter()
                .map(|p| place.point(p))
                .collect();
            fill_polygon(
                &outline,
                linear_gradient(
                    180.0 + angle,
                    linear_color_stop(top, 0.0),
                    linear_color_stop(bottom, 1.0),
                ),
                window,
            );
            // inset 0 1px 0 rgb(255 255 255/.14), cut by the notches.
            let highlight: Vec<Point<Pixels>> = [
                (NOTCH, 0.0),
                (w - NOTCH, 0.0),
                (w - NOTCH, 1.0),
                (NOTCH, 1.0),
            ]
            .into_iter()
            .map(|p| place.point(p))
            .collect();
            fill_polygon(&highlight, rgb_a(0xffffff, 0.14), window);

            if index == 1 {
                // Perforation: a 1px dashed line (2.5px on / 2.5px off), inset-y-2.
                let mut y = 8.0;
                while y < h - 8.0 {
                    let y1 = (y + 2.5).min(h - 8.0);
                    let dash: Vec<Point<Pixels>> = [(0.0, y), (1.0, y), (1.0, y1), (0.0, y1)]
                        .into_iter()
                        .map(|p| place.point(p))
                        .collect();
                    fill_polygon(&dash, rgb_a(0xfafafa, 0.7 * 0.4), window);
                    y += 5.0;
                }
            }
        }

        // Glyphs follow their half's rotation along the baseline (each glyph stays upright).
        let base = window.text_style();
        let text_color = surface_text_color(b);
        let [(main, _, h), (stub_place, stub_w, _)] = halves;
        let mut sans = base.font();
        sans.weight = FontWeight::MEDIUM;
        let mut mono = sans.clone();
        if let Some(family) = stub_font {
            mono.family = family.clone();
        }
        // Main label: `px-6`, vertically centred on a 20px line.
        paint_line(
            label,
            &sans,
            14.0,
            0.0,
            text_color,
            Anchor::Left(24.0),
            h * 0.5 - 10.0,
            20.0,
            &main,
            window,
            cx,
        );
        // `text-neutral-50/70`.
        let stub_color = text_color.opacity(0.7);
        match stub {
            Some(text) => paint_line(
                text,
                &mono,
                12.0,
                0.0,
                stub_color,
                Anchor::Center(stub_w * 0.5),
                h * 0.5 - 8.0,
                16.0,
                &stub_place,
                window,
                cx,
            ),
            None => {
                // "NO." (8px, tracking .2em, 60%) over "01" (12px semibold), leading-none.
                let top = h * 0.5 - 11.0;
                paint_line(
                    &"NO.".into(),
                    &mono,
                    8.0,
                    1.6,
                    stub_color.opacity(0.6),
                    Anchor::Center(stub_w * 0.5),
                    top,
                    8.0,
                    &stub_place,
                    window,
                    cx,
                );
                let mut bold = mono.clone();
                bold.weight = FontWeight::SEMIBOLD;
                paint_line(
                    &"01".into(),
                    &bold,
                    12.0,
                    0.0,
                    stub_color,
                    Anchor::Center(stub_w * 0.5),
                    top + 10.0,
                    12.0,
                    &stub_place,
                    window,
                    cx,
                );
            }
        }
    }
}

/// `text-neutral-50` under the halves' `brightness()` filter.
fn surface_text_color(brightness: f32) -> Hsla {
    brighten(gpui::rgb(0xfafafa), brightness)
}

/// Standard normal CDF (Abramowitz–Stegun erf approximation).
fn normal_cdf(x: f32) -> f32 {
    let z = x.abs() / std::f32::consts::SQRT_2;
    let t = 1.0 / (1.0 + 0.3275911 * z);
    let poly = t
        * (0.254_829_6
            + t * (-0.284_496_74 + t * (1.421_413_7 + t * (-1.453_152 + t * 1.061_405_4))));
    let erf = 1.0 - poly * (-z * z).exp();
    0.5 * (1.0 + erf.copysign(x))
}

/// Paints grown copies of both halves so they read as one blurred
/// drop shadow of the whole ticket outline.
fn soft_shadow(
    halves: &[(Placement, f32, f32); 2],
    dy: f32,
    sigma: f32,
    alpha: f32,
    window: &mut Window,
) {
    // Layers grown from +2.5σ down to −2.5σ; each pixel's darkness follows the
    // Gaussian edge profile A·Φ(−s/σ) at its distance s outside the outline.
    // About one layer per 1.7px of spread keeps the steps invisible.
    let layers = ((sigma * 3.0).ceil() as usize).clamp(4, 16);
    let mut previous = 0.0;
    for k in 0..layers {
        let grow = 2.5 - 5.0 * (k as f32 + 0.5) / layers as f32;
        let target = alpha * normal_cdf(-grow);
        // Over-compositing: choose this layer's alpha so the stack reaches `target`.
        let layer = 1.0 - (1.0 - target) / (1.0 - previous);
        previous = target;
        for (place, w, h) in halves.iter() {
            let points: Vec<Point<Pixels>> = notched_outline(*w, *h, NOTCH, grow * sigma)
                .into_iter()
                .map(|(x, y)| place.point((x, y + dy)))
                .collect();
            fill_polygon(&points, rgb_a(0x000000, layer), window);
        }
    }
}

enum Anchor {
    /// Left edge of the line box at this local x.
    Left(f32),
    /// Centre of the line box (including trailing letter-spacing) at this local x.
    Center(f32),
}

/// Shapes `text` and paints each glyph at its place along the half's rotated
/// baseline. `tracking` is CSS letter-spacing in px.
#[allow(clippy::too_many_arguments)]
fn paint_line(
    text: &SharedString,
    font: &Font,
    size: f32,
    tracking: f32,
    color: Hsla,
    anchor: Anchor,
    line_top: f32,
    line_height: f32,
    place: &Placement,
    window: &mut Window,
    _cx: &mut App,
) {
    if text.is_empty() || color.a <= 0.001 {
        return;
    }
    let run = TextRun {
        len: text.len(),
        font: font.clone(),
        color,
        background_color: None,
        underline: None,
        strikethrough: None,
    };
    let line = window
        .text_system()
        .shape_line(text.clone(), px(size), &[run], None);
    let glyphs = line.runs.iter().map(|r| r.glyphs.len()).sum::<usize>();
    let width = line.width.as_f32() + tracking * glyphs as f32;
    let left = match anchor {
        Anchor::Left(x) => x,
        Anchor::Center(x) => x - width * 0.5,
    };
    let ascent = line.ascent.as_f32();
    let descent = line.descent.as_f32();
    let baseline = line_top + (line_height - (ascent + descent)) * 0.5 + ascent;
    let scaled = px(size * place.scale);
    let mut index = 0;
    for run in line.runs.iter() {
        for glyph in run.glyphs.iter() {
            let local = (
                left + glyph.position.x.as_f32() + tracking * index as f32,
                baseline,
            );
            let origin = place.point(local);
            if glyph.is_emoji {
                window
                    .paint_emoji(origin, run.font_id, glyph.id, scaled)
                    .ok();
            } else {
                window
                    .paint_glyph(origin, run.font_id, glyph.id, scaled, color)
                    .ok();
            }
            index += 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tear_spring_overshoots_then_settles() {
        let mut spring = TearSpring::new();
        spring.retarget(1.0, TILT_SPRING);
        let mut now = spring.last;
        let mut peak: f32 = 0.0;
        for _ in 0..240 {
            now += Duration::from_millis(16);
            peak = peak.max(spring.advance(now));
        }
        assert!(peak > 1.0, "tilt spring should overshoot, peaked at {peak}");
        assert!(spring.settled());
    }

    #[test]
    fn grown_outline_moves_edges_out() {
        let outline = notched_outline(100.0, 44.0, NOTCH, 2.0);
        let min_y = outline.iter().map(|p| p.1).fold(f32::MAX, f32::min);
        let max_x = outline.iter().map(|p| p.0).fold(f32::MIN, f32::max);
        assert!((min_y + 2.0).abs() < 1e-3 && (max_x - 102.0).abs() < 1e-3);
    }

    #[test]
    fn notches_cut_every_corner() {
        let outline = notched_outline(100.0, 44.0, NOTCH, 0.0);
        // No point may sit inside a corner's notch circle.
        for (x, y) in outline {
            for (cx, cy) in [(0.0, 0.0), (100.0, 0.0), (0.0, 44.0), (100.0, 44.0)] {
                let d = ((x - cx) * (x - cx) + (y - cy) * (y - cy)).sqrt();
                assert!(d >= NOTCH - 1e-3);
            }
        }
    }
}
