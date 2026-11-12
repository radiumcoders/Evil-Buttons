//! StretchyButton: a rubbery pill you can grab and pull. Its outline and every
//! letter of its label stretch toward the cursor, and it wobbles back into
//! shape when you let go.
//!
//! Original idea and design: "Stretchy button" by Adi (@AdityaSur11),
//! <https://x.com/AdityaSur11/status/2117524680412393581>. This is an
//! independent re-implementation.

use gpui::{
    App, Bounds, ClickEvent, Context, CursorStyle, DispatchPhase, ElementId, FocusHandle,
    FontWeight, Hsla, InteractiveElement, IntoElement, MouseButton, MouseMoveEvent, MouseUpEvent,
    ParentElement, PathBuilder, Pixels, Point, RenderOnce, Rgba, SharedString,
    StatefulInteractiveElement, Styled, TextRun, Window, canvas, div, point,
    prelude::FluentBuilder, px, transparent_black,
};
use std::{cell::Cell, rc::Rc};

use crate::interaction::{ClickHandler, is_activation_key};
use crate::motion::Instant;
use crate::surface::rgb_a;

/// A rubbery pill you can grab and pull; it wobbles back when let go.
///
/// ```ignore
/// StretchyButton::new("stretch", "Stretch me").on_click(|_, _, _| println!("boing"))
/// ```
#[derive(IntoElement)]
pub struct StretchyButton {
    id: ElementId,
    label: SharedString,
    color: Hsla,
    stretch: f32,
    snap: f32,
    wobble: f32,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl StretchyButton {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            color: gpui::rgb(0x3d9df5).into(),
            stretch: 70.0,
            snap: 220.0,
            wobble: 0.6,
            disabled: false,
            on_click: None,
        }
    }

    /// Fill colour of the rubber body. Defaults to `#3d9df5`.
    pub fn color(mut self, color: impl Into<Hsla>) -> Self {
        self.color = color.into();
        self
    }

    /// How far in px the rubber gives before it stiffens up. Defaults to 70.
    pub fn stretch(mut self, stretch: f32) -> Self {
        self.stretch = stretch;
        self
    }

    /// Drag distance in px at which the button slips out of your grip. Defaults to 220.
    pub fn snap(mut self, snap: f32) -> Self {
        self.snap = snap;
        self
    }

    /// How much it jiggles when let go, from 0 (settles) to 1 (very wobbly). Defaults to 0.6.
    pub fn wobble(mut self, wobble: f32) -> Self {
        self.wobble = wobble;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired by a press that barely moves (a stretch is not a click).
    pub fn on_click(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(handler));
        self
    }
}

/// Drags shorter than this still count as a click.
const CLICK_SLOP: f32 = 6.0;
/// Spacing in px between outline samples.
const OUTLINE_STEP: f32 = 5.0;
const HEIGHT: f32 = 40.0;

/// One axis of the pull, springing home like motion's `animate(v, 0, spring)`.
#[derive(Clone, Copy, Debug)]
struct Axis {
    value: f32,
    velocity: f32,
    /// `Some((stiffness, damping, mass))` while springing home.
    spring: Option<(f32, f32, f32)>,
}

impl Axis {
    fn rest() -> Self {
        Self {
            value: 0.0,
            velocity: 0.0,
            spring: None,
        }
    }

    fn step(&mut self, dt: f32) {
        let Some((k, c, m)) = self.spring else {
            return;
        };
        let mut remaining = dt;
        while remaining > 0.0 {
            let h = remaining.min(1.0 / 240.0);
            let force = -k * self.value - c * self.velocity;
            self.velocity += force / m * h;
            self.value += self.velocity * h;
            remaining -= h;
        }
        if self.value.abs() < 0.01 && self.velocity.abs() < 0.5 {
            *self = Self::rest();
        }
    }
}

struct Drag {
    start: Point<Pixels>,
}

struct StretchState {
    dx: Axis,
    dy: Axis,
    last: Instant,
    /// Grab point in button coordinates.
    anchor: (f32, f32),
    drag: Option<Drag>,
    suppress_click: bool,
    focus_visible: bool,
    bounds: Rc<Cell<Option<Bounds<Pixels>>>>,
    focus: FocusHandle,
    stretch: f32,
    snap: f32,
    wobble: f32,
}

impl StretchState {
    fn advance(&mut self, now: Instant) {
        let dt = now
            .saturating_duration_since(self.last)
            .as_secs_f32()
            .min(0.064);
        self.last = now;
        self.dx.step(dt);
        self.dy.step(dt);
    }

    fn animating(&self) -> bool {
        self.dx.spring.is_some() || self.dy.spring.is_some()
    }

    /// Lower damping wobbles longer; a kick carries momentum into the spring.
    fn spring_back(&mut self, kick: Option<(f32, f32)>) {
        self.advance(Instant::now());
        let damping = 6.0 + (1.0 - self.wobble.clamp(0.0, 1.0)) * 22.0;
        let spring = Some((420.0, damping, 0.9));
        self.dx.spring = spring;
        self.dy.spring = spring;
        if let Some((vx, vy)) = kick {
            self.dx.velocity = vx;
            self.dy.velocity = vy;
        }
    }

    fn release(&mut self) -> bool {
        if self.drag.take().is_none() {
            return false;
        }
        self.spring_back(None);
        true
    }

    fn drag_to(&mut self, pointer: Point<Pixels>) {
        let Some(drag) = self.drag.as_ref() else {
            return;
        };
        let raw_x = (pointer.x - drag.start.x).as_f32();
        let raw_y = (pointer.y - drag.start.y).as_f32();
        let distance = raw_x.hypot(raw_y);
        if distance > CLICK_SLOP {
            self.suppress_click = true;
        }
        if distance > self.snap {
            // Pulled too far: it slips out of your fingers and boings home.
            self.release();
            return;
        }
        // Rubber: gives easily at first, then stiffens toward `stretch`.
        let give = if distance > 0.0 {
            self.stretch * (distance / self.stretch).tanh() / distance
        } else {
            0.0
        };
        self.dx = Axis {
            value: raw_x * give,
            velocity: 0.0,
            spring: None,
        };
        self.dy = Axis {
            value: raw_y * give,
            velocity: 0.0,
            spring: None,
        };
    }
}

/// Evenly spaced points around a pill, clockwise from the top left.
fn sample_pill(width: f32, height: f32) -> Vec<(f32, f32)> {
    let r = height.min(width) / 2.0;
    let straight = (width - 2.0 * r).max(0.0);
    let arc = std::f32::consts::PI * r;
    let perimeter = 2.0 * straight + 2.0 * arc;
    let count = ((perimeter / OUTLINE_STEP).round() as usize).max(32);
    (0..count)
        .map(|i| {
            let mut s = i as f32 / count as f32 * perimeter;
            if s < straight {
                return (r + s, 0.0);
            }
            s -= straight;
            if s < arc {
                let a = -std::f32::consts::FRAC_PI_2 + s / r;
                return (width - r + a.cos() * r, r + a.sin() * r);
            }
            s -= arc;
            if s < straight {
                return (width - r - s, height);
            }
            s -= straight;
            let a = std::f32::consts::FRAC_PI_2 + s / r;
            (r + a.cos() * r, r + a.sin() * r)
        })
        .collect()
}

/// Smooth closed path through the points (Catmull-Rom as cubic Béziers).
fn smooth_path(points: &[(f32, f32)], origin: Point<Pixels>, builder: &mut PathBuilder) {
    let n = points.len();
    let p = |(x, y): (f32, f32)| point(origin.x + px(x), origin.y + px(y));
    builder.move_to(p(points[0]));
    for i in 0..n {
        let p0 = points[(i + n - 1) % n];
        let p1 = points[i];
        let p2 = points[(i + 1) % n];
        let p3 = points[(i + 2) % n];
        builder.cubic_bezier_to(
            p(p2),
            p((p1.0 + (p2.0 - p0.0) / 6.0, p1.1 + (p2.1 - p0.1) / 6.0)),
            p((p2.0 - (p3.0 - p1.0) / 6.0, p2.1 - (p3.1 - p1.1) / 6.0)),
        );
    }
    builder.close();
}

// `color-mix(in oklab, color, black 14%)` for the rim.
fn to_linear(c: f32) -> f32 {
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

fn to_srgb(c: f32) -> f32 {
    let c = c.max(0.0);
    if c <= 0.0031308 {
        c * 12.92
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    }
}

fn darken_oklab(color: Hsla, toward_black: f32) -> Hsla {
    let c = Rgba::from(color);
    let (r, g, b) = (to_linear(c.r), to_linear(c.g), to_linear(c.b));
    let l = (0.412_221_46 * r + 0.536_332_55 * g + 0.051_445_995 * b).cbrt();
    let m = (0.211_903_5 * r + 0.680_699_5 * g + 0.107_396_96 * b).cbrt();
    let s = (0.088_302_46 * r + 0.281_718_85 * g + 0.629_978_7 * b).cbrt();
    let k = 1.0 - toward_black;
    let lab = [
        (0.210_454_26 * l + 0.793_617_8 * m - 0.004_072_047 * s) * k,
        (1.977_998_5 * l - 2.428_592_2 * m + 0.450_593_7 * s) * k,
        (0.025_904_037 * l + 0.782_771_77 * m - 0.808_675_77 * s) * k,
    ];
    let l_ = (lab[0] + 0.396_337_78 * lab[1] + 0.215_803_76 * lab[2]).powi(3);
    let m_ = (lab[0] - 0.105_561_346 * lab[1] - 0.063_854_17 * lab[2]).powi(3);
    let s_ = (lab[0] - 0.089_484_18 * lab[1] - 1.291_485_5 * lab[2]).powi(3);
    Rgba {
        r: to_srgb(4.076_741_7 * l_ - 3.307_711_6 * m_ + 0.230_969_94 * s_).min(1.0),
        g: to_srgb(-1.268_438 * l_ + 2.609_757_4 * m_ - 0.341_319_38 * s_).min(1.0),
        b: to_srgb(-0.004_196_086_3 * l_ - 0.703_418_6 * m_ + 1.707_614_7 * s_).min(1.0),
        a: c.a,
    }
    .into()
}

#[derive(Clone, Copy)]
struct Pull {
    ox: f32,
    oy: f32,
    anchor: (f32, f32),
}

impl Pull {
    /// A soft gaussian field around the grab point: wide along the button,
    /// tall enough that the whole thickness moves together.
    fn field(&self, width: f32, height: f32) -> impl Fn(f32, f32) -> (f32, f32, f32) {
        let sx = (width * 0.55).max(36.0);
        let sy = (height * 1.6).max(36.0);
        let (ax, ay) = self.anchor;
        move |x, y| {
            let u = (x - ax) / sx;
            let v = (y - ay) / sy;
            let w = (-u * u - v * v).exp();
            // Also the field's slope, for how much a letter stretches.
            (
                w,
                w * -2.0 * (x - ax) / (sx * sx),
                w * -2.0 * (y - ay) / (sy * sy),
            )
        }
    }
}

#[derive(Clone)]
struct Paint {
    pull: Pull,
    fill: Hsla,
    rim: Hsla,
    focus_visible: bool,
    label: SharedString,
}

fn paint_body(bounds: Bounds<Pixels>, p: &Paint, window: &mut Window, cx: &mut App) {
    let (width, height) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
    let field = p.pull.field(width, height);
    let (ox, oy) = (p.pull.ox, p.pull.oy);
    let outline: Vec<(f32, f32)> = sample_pill(width, height)
        .into_iter()
        .map(|(x, y)| {
            let (w, _, _) = field(x, y);
            (x + ox * w, y + oy * w)
        })
        .collect();

    // drop-shadow(0 1px 2px rgb(0 0 0 / 0.12)), approximated by soft offset copies.
    for (dy, alpha) in [(0.5, 0.05), (1.0, 0.06), (2.0, 0.04)] {
        let mut b = PathBuilder::fill();
        smooth_path(&outline, bounds.origin + point(px(0.0), px(dy)), &mut b);
        if let Ok(path) = b.build() {
            window.paint_path(path, rgb_a(0x000000, alpha));
        }
    }
    let mut b = PathBuilder::fill();
    smooth_path(&outline, bounds.origin, &mut b);
    if let Ok(path) = b.build() {
        window.paint_path(path, p.fill);
    }
    let (rim, rim_width) = if p.focus_visible {
        (rgb_a(0xa1a1a1, 1.0), 2.5)
    } else {
        (p.rim, 1.25)
    };
    let mut b = PathBuilder::stroke(px(rim_width));
    smooth_path(&outline, bounds.origin, &mut b);
    if let Ok(path) = b.build() {
        window.paint_path(path, rim);
    }

    // Each letter rides the same field: it moves with it and grows or shrinks
    // with its stretch. (GPUI can't rotate glyphs, so they don't lean.)
    let font_size = 14.0;
    let line_height = 20.0;
    let mut font = window.text_style().font();
    font.weight = FontWeight::MEDIUM;
    let run = TextRun {
        len: p.label.len(),
        font,
        color: gpui::white(),
        background_color: None,
        underline: None,
        strikethrough: None,
    };
    let line = window
        .text_system()
        .shape_line(p.label.clone(), px(font_size), &[run], None);
    let line_w = line.width.as_f32();
    let left = (width - line_w) / 2.0;
    let center_y = height / 2.0;
    let baseline = center_y - line_height / 2.0
        + (line_height - line.ascent.as_f32() - line.descent.as_f32()) / 2.0
        + line.ascent.as_f32();
    let xs: Vec<f32> = line
        .runs
        .iter()
        .flat_map(|r| r.glyphs.iter().map(|g| g.position.x.as_f32()))
        .chain(std::iter::once(line_w))
        .collect();
    let mut i = 0;
    for run in &line.runs {
        for glyph in &run.glyphs {
            let gx = left + xs[i];
            let cx_ = left + (xs[i] + xs[i + 1]) / 2.0;
            i += 1;
            let (w, wx, wy) = field(cx_, center_y);
            let scale_x = (1.0 + ox * wx).max(0.5);
            let scale_y = (1.0 + oy * wy).max(0.6);
            // Quantise so the glyph atlas isn't flooded with sizes.
            // Size follows the vertical stretch; the horizontal spread comes
            // from the letters' positions.
            let _ = scale_x;
            let scale = (scale_y * 16.0).round() / 16.0;
            let size = font_size * scale;
            let x = cx_ + ox * w - (cx_ - gx) * scale;
            let y = center_y + oy * w + (baseline - center_y) * scale;
            let at = bounds.origin + point(px(x), px(y));
            if glyph.is_emoji {
                window.paint_emoji(at, run.font_id, glyph.id, px(size)).ok();
            } else {
                window
                    .paint_glyph(at, run.font_id, glyph.id, px(size), gpui::white())
                    .ok();
            }
        }
    }
    let _ = cx;
}

impl RenderOnce for StretchyButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<StretchState>| {
                StretchState {
                    dx: Axis::rest(),
                    dy: Axis::rest(),
                    last: Instant::now(),
                    anchor: (0.0, 0.0),
                    drag: None,
                    suppress_click: false,
                    focus_visible: false,
                    bounds: Rc::new(Cell::new(None)),
                    focus: cx.focus_handle().tab_stop(true),
                    stretch: 70.0,
                    snap: 220.0,
                    wobble: 0.6,
                }
            });
        let (stretch, snap, wobble) = (self.stretch.max(1.0), self.snap, self.wobble);
        let now = Instant::now();
        let (pull, grabbing, animating) = state.update(cx, |s, _| {
            s.stretch = stretch;
            s.snap = snap;
            s.wobble = wobble;
            s.advance(now);
            (
                Pull {
                    ox: s.dx.value,
                    oy: s.dy.value,
                    anchor: s.anchor,
                },
                s.drag.is_some(),
                s.animating(),
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
        if animating {
            window.request_animation_frame();
        }

        let paint = Paint {
            pull,
            fill: self.color,
            rim: darken_oklab(self.color, 0.14),
            focus_visible,
            label: self.label.clone(),
        };
        let interactive = !self.disabled;
        let canvas_state = state.clone();
        let button = div()
            .id(self.id.clone())
            .relative()
            .flex()
            .flex_none()
            .h(px(HEIGHT))
            .px(px(20.0))
            .items_center()
            .justify_center()
            .whitespace_nowrap()
            .text_size(px(14.0))
            .line_height(px(20.0))
            .font_weight(FontWeight::MEDIUM)
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    move |bounds, _, _| bounds_cell.set(Some(bounds)),
                    move |bounds, _, window, cx| {
                        paint_body(bounds, &paint, window, cx);
                        if !grabbing {
                            return;
                        }
                        // Track the pull anywhere in the window (pointer capture).
                        let moved = canvas_state.clone();
                        window.on_mouse_event(move |e: &MouseMoveEvent, phase, _, cx| {
                            if phase != DispatchPhase::Bubble {
                                return;
                            }
                            moved.update(cx, |s, cx| {
                                if e.pressed_button == Some(MouseButton::Left) {
                                    s.drag_to(e.position);
                                } else {
                                    s.release();
                                }
                                cx.notify();
                            });
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
            // Lays out the label; the canvas paints the bending letters.
            .child(
                div()
                    .text_color(transparent_black())
                    .child(self.label.clone()),
            );
        if !interactive {
            return button;
        }

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
            .on_mouse_down(MouseButton::Left, move |e, window, cx| {
                window.focus(&focus_for_down, cx);
                down.update(cx, |s, cx| {
                    let Some(b) = s.bounds.get() else {
                        return;
                    };
                    let (w, h) = (b.size.width.as_f32(), b.size.height.as_f32());
                    s.anchor = (
                        (e.position.x - b.origin.x).as_f32().clamp(0.0, w),
                        (e.position.y - b.origin.y).as_f32().clamp(0.0, h),
                    );
                    s.dx = Axis::rest();
                    s.dy = Axis::rest();
                    s.drag = Some(Drag { start: e.position });
                    s.suppress_click = false;
                    s.focus_visible = false;
                    cx.notify();
                });
            })
            .on_key_down(move |e, _, cx| {
                if is_activation_key(e.keystroke.key.as_str()) {
                    keys.update(cx, |s, _| s.focus_visible = true);
                }
            })
            .on_click(move |e, window, cx| {
                let fire = click.update(cx, |s, cx| {
                    if s.suppress_click && !e.is_keyboard() {
                        // A stretch is not a click.
                        s.suppress_click = false;
                        return false;
                    }
                    if e.is_keyboard()
                        && let Some(b) = s.bounds.get()
                    {
                        s.anchor = (b.size.width.as_f32() / 2.0, b.size.height.as_f32() / 2.0);
                    }
                    // A plain press dents the rubber where you hit it and lets it jiggle.
                    s.spring_back(Some((0.0, 260.0)));
                    cx.notify();
                    true
                });
                if fire && let Some(handler) = on_click.as_ref() {
                    handler(e, window, cx);
                }
            })
    }
}
