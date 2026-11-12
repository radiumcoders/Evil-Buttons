//! ChromeButton: a metallic pill whose border is a ring of flowing liquid
//! chrome around a solid face that follows the light or dark theme.
//!
//! The React original renders the ring with a WebGL fragment shader. GPUI has
//! no custom shaders, so the same shader function is evaluated on the CPU at
//! points along the ring (two radial layers, a segment every ~1.25px) and the
//! ring is painted as filled segments. Pointer swirls, the press shock wave,
//! hover speed-up and the time integration all follow the original.

use gpui::{
    AnyElement, App, Bounds, BoxShadow, Context, Corners, ElementId, FocusHandle, FontWeight, Hsla,
    InteractiveElement, IntoElement, MouseButton, MouseDownEvent, MouseMoveEvent, ParentElement,
    PathBuilder, PathStyle, Pixels, Point, RenderOnce, Rgba, SharedString,
    StatefulInteractiveElement, Styled, TextAlign, TextRun, Window, WindowAppearance, canvas, div,
    linear_color_stop, linear_gradient, point, prelude::FluentBuilder, px, quad, transparent_black,
};
use lyon::tessellation::{FillOptions, FillRule};
use std::{cell::Cell, f32::consts::PI, rc::Rc};

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Easing, Instant, Transition};
use crate::surface::{brighten, ms, paint_focus_ring, rgb_a, scale_bounds, scaled_content};

/// The release curve, `cubic-bezier(0.34, 1.4, 0.64, 1)`.
const SPRINGY: Easing = Easing::CubicBezier(0.34, 1.4, 0.64, 1.0);
/// Colour levels the ring is quantised to, so it paints as a few dozen paths.
const LEVELS: usize = 96;

/// Which face the button shows.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum ChromeButtonTone {
    /// Follow the window's light or dark appearance.
    #[default]
    Auto,
    Dark,
    Light,
}

/// Pill, compact pill, or a round icon-only button.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum ChromeButtonSize {
    #[default]
    Default,
    Sm,
    Icon,
}

impl ChromeButtonSize {
    /// Shell height, ring thickness, face padding, gap and text size.
    fn metrics(self) -> (f32, f32, f32, f32, f32) {
        match self {
            Self::Default => (44.0, 3.0, 20.0, 10.0, 15.0),
            Self::Sm => (36.0, 2.5, 14.0, 8.0, 13.0),
            Self::Icon => (36.0, 2.5, 0.0, 0.0, 15.0),
        }
    }
}

/// A metallic pill ringed with flowing liquid chrome.
///
/// ```ignore
/// ChromeButton::new("continue").on_click(|_, _, _| println!("Continue"))
/// ```
#[derive(IntoElement)]
pub struct ChromeButton {
    id: ElementId,
    label: SharedString,
    children: Vec<AnyElement>,
    tone: ChromeButtonTone,
    size: ChromeButtonSize,
    speed: f32,
    interactive: bool,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl ChromeButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: "Continue".into(),
            children: Vec::new(),
            tone: ChromeButtonTone::Auto,
            size: ChromeButtonSize::Default,
            speed: 1.0,
            interactive: true,
            disabled: false,
            on_click: None,
        }
    }

    /// Label used when no children are given. Defaults to "Continue".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Follow the window appearance, or force a dark or light face. Defaults to `Auto`.
    pub fn tone(mut self, tone: ChromeButtonTone) -> Self {
        self.tone = tone;
        self
    }

    /// Pill, compact pill, or round icon button. Defaults to `Default`.
    pub fn size(mut self, size: ChromeButtonSize) -> Self {
        self.size = size;
        self
    }

    /// Speed multiplier for the metal flowing around the ring. Defaults to 1.
    pub fn speed(mut self, speed: f32) -> Self {
        self.speed = speed;
        self
    }

    /// Swirl the metal around the pointer, speed it up on hover and send a
    /// shock wave through it on press. Defaults to `true`.
    pub fn interactive(mut self, interactive: bool) -> Self {
        self.interactive = interactive;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    pub fn on_click(
        mut self,
        handler: impl Fn(&gpui::ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(handler));
        self
    }
}

impl ParentElement for ChromeButton {
    /// Face content (label and icons); replaces `label` when given.
    fn extend(&mut self, elements: impl IntoIterator<Item = AnyElement>) {
        self.children.extend(elements);
    }
}

struct ChromeState {
    scale: Transition,
    brightness: Transition,
    hovered: bool,
    pressed: bool,
    focus_visible: bool,
    /// Shader clock (seconds, already sped up by `speed` and hover).
    time: f32,
    /// Smoothed hover (0–1) driving the swirl and speed-up.
    hover: f32,
    last: Option<Instant>,
    /// Pointer in shell pixels, y up, as the shader expects.
    pointer: (f32, f32),
    /// Shock wave origin (shell pixels, y up) and start time on the shader clock.
    press: (f32, f32, f32),
    interactive: bool,
    bounds: Rc<Cell<Option<Bounds<Pixels>>>>,
    focus: FocusHandle,
}

impl ChromeState {
    fn to_shell(&self, position: Point<Pixels>) -> Option<(f32, f32)> {
        let b = self.bounds.get()?;
        Some((
            (position.x - b.origin.x).as_f32(),
            (b.bottom() - position.y).as_f32(),
        ))
    }

    fn wave(&mut self, at: (f32, f32)) {
        if self.interactive {
            self.press = (at.0, at.1, self.time);
        }
    }

    fn advance(&mut self, now: Instant, speed: f32) {
        let dt = self
            .last
            .map(|last| now.saturating_duration_since(last).as_secs_f32().min(0.05))
            .unwrap_or(0.0);
        self.last = Some(now);
        let target = if self.interactive && self.hovered {
            1.0
        } else {
            0.0
        };
        self.hover += (target - self.hover) * (dt * 8.0).min(1.0);
        self.time += dt * speed * (1.0 + self.hover * 1.2);
    }
}

impl Pressable for ChromeState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        if self.hovered == hovered {
            return false;
        }
        self.hovered = hovered;
        let to = if hovered { 1.1 } else { 1.0 };
        self.brightness.animate_to(to, ms(300), SPRINGY);
        true
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.focus_visible = keyboard;
        if keyboard && let Some(b) = self.bounds.get() {
            // Keyboard activation has no pointer: send the wave from the centre.
            self.wave((b.size.width.as_f32() / 2.0, b.size.height.as_f32() / 2.0));
        }
        if self.pressed {
            return false;
        }
        self.pressed = true;
        self.scale.animate_to(0.96, ms(100), Easing::EASE_OUT);
        true
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        if !self.pressed {
            return false;
        }
        self.pressed = false;
        self.scale.animate_to(1.0, ms(300), SPRINGY);
        true
    }
}

/// Uniforms for one frame of the metal shader.
#[derive(Clone, Copy, Debug)]
struct Metal {
    res: (f32, f32),
    time: f32,
    pointer: (f32, f32),
    hover: f32,
    press: (f32, f32, f32),
}

fn smoothstep(e0: f32, e1: f32, x: f32) -> f32 {
    let t = ((x - e0) / (e1 - e0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

impl Metal {
    /// The fragment shader's `metal()`: brightness (0–1) at `(x, y)` in shell
    /// pixels, y up. Bands of chrome travel around the ring by angle, wobbled
    /// by stacked cosines so they slosh like liquid.
    fn sample(&self, x: f32, y: f32) -> f32 {
        let (rw, rh) = self.res;
        let t = self.time;
        let m = rw.min(rh);
        let (mut ux, mut uy) = ((2.0 * x - rw) / m, (2.0 * y - rh) / m);
        for i in 1..8 {
            let i = i as f32;
            ux += 0.22 / i * (i * 2.6 * uy + t).cos();
            uy += 0.22 / i * (i * 1.9 * ux + t * 0.8).cos();
        }

        let mut phase = 0.0;
        let mut shade = 0.0;
        // Pointer: tight dark and bright ripples swirl out from the cursor.
        if self.hover > 0.001 {
            let dist = ((x - self.pointer.0) / rh).hypot((y - self.pointer.1) / rh);
            let near = (-dist * dist * 1.5).exp() * self.hover;
            let swirl = (dist * 14.0 - t * 7.0).sin();
            phase += swirl * 2.2 * near;
            shade += swirl * 0.45 * near;
        }
        // Press: a shock front runs out from the click, bright at its leading
        // edge with a dark trough behind it.
        let age = t - self.press.2;
        if age > 0.0 && age < 2.0 {
            let r = ((x - self.press.0) / rh).hypot((y - self.press.1) / rh);
            let front = r - age * 4.0;
            let fade = (-age * 1.8).exp();
            phase += (-front * front * 2.0).exp() * fade * 5.0;
            let behind = front + 0.45;
            shade += ((-front * front * 8.0).exp() - (-behind * behind * 8.0).exp()) * fade * 0.95;
        }

        // Normalised so a pill's ends and sides share one angular speed.
        let (qx, qy) = ((2.0 * x - rw) / rw, (2.0 * y - rh) / rh);
        let angle = qy.atan2(qx);
        let s = (angle * 3.0 - t * 2.2 + (ux + uy) * 1.1 + phase).sin();
        let mm = 0.5 + 0.5 * s;
        let mut c = 0.3 + 0.7 * smoothstep(0.0, 0.75, mm);
        c += 0.55 * (0.035 / (s - 0.35).abs()).min(1.0);
        c -= 0.35 * (0.02 / (s + 0.6).abs()).min(1.0);
        (c + shade).clamp(0.0, 1.0)
    }
}

/// A point on the shell's outer edge and the inward normal there.
#[derive(Clone, Copy)]
struct Edge {
    x: f32,
    y: f32,
    nx: f32,
    ny: f32,
}

/// Samples the pill outline (top edge, right cap, bottom edge, left cap),
/// roughly every `step` px along the ring's centre line.
fn pill_edges(bounds: Bounds<Pixels>, ring: f32, step: f32) -> Vec<Edge> {
    let (x0, y0) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
    let (w, h) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
    let r = h / 2.0;
    let straight = (w - h).max(0.0);
    let (cy, left_cx, right_cx) = (y0 + r, x0 + r, x0 + r + straight);
    let cap = PI * (r - ring / 2.0).max(1.0);
    let n_straight = (straight / step).ceil() as usize;
    let n_cap = (cap / step).ceil().max(8.0) as usize;
    let mut edges = Vec::with_capacity(2 * (n_straight + n_cap) + 1);
    let arc = |edges: &mut Vec<Edge>, cx: f32, from: f32| {
        for i in 0..n_cap {
            let a = from + PI * i as f32 / n_cap as f32;
            let (s, c) = a.sin_cos();
            edges.push(Edge {
                x: cx + r * c,
                y: cy + r * s,
                nx: -c,
                ny: -s,
            });
        }
    };
    for i in 0..n_straight {
        let x = left_cx + straight * i as f32 / n_straight as f32;
        edges.push(Edge {
            x,
            y: y0,
            nx: 0.0,
            ny: 1.0,
        });
    }
    arc(&mut edges, right_cx, -PI / 2.0);
    for i in 0..n_straight {
        let x = right_cx - straight * i as f32 / n_straight as f32;
        edges.push(Edge {
            x,
            y: y0 + h,
            nx: 0.0,
            ny: -1.0,
        });
    }
    arc(&mut edges, left_cx, PI / 2.0);
    edges
}

/// Paints the liquid-metal ring as quantised colour bands of thin segments.
fn paint_ring(
    bounds: Bounds<Pixels>,
    ring: f32,
    metal: Metal,
    tint: f32,
    brightness: f32,
    window: &mut Window,
) {
    let edges = pill_edges(bounds, ring, 1.25);
    let n = edges.len();
    let (x0, bottom) = (bounds.origin.x.as_f32(), bounds.bottom().as_f32());
    let mut bands: Vec<Option<PathBuilder>> = (0..LEVELS).map(|_| None).collect();
    // Two radial layers: the outer half, and the inner half (tucked under the face).
    let layers = [(0.0, ring * 0.5), (ring * 0.5, ring + 1.0)];
    for i in 0..n {
        let (a, b) = (edges[i], edges[(i + 1) % n]);
        let (mx, my) = ((a.x + b.x) * 0.5, (a.y + b.y) * 0.5);
        let (mnx, mny) = ((a.nx + b.nx) * 0.5, (a.ny + b.ny) * 0.5);
        for (inner, outer) in layers {
            let d = (inner + outer.min(ring)) * 0.5;
            let (sx, sy) = (mx + mnx * d, my + mny * d);
            let c = metal.sample(sx - x0, bottom - sy);
            let level = ((c * (LEVELS - 1) as f32).round() as usize).min(LEVELS - 1);
            let at = |e: Edge, depth: f32| point(px(e.x + e.nx * depth), px(e.y + e.ny * depth));
            let builder = bands[level].get_or_insert_with(|| {
                PathBuilder::fill().with_style(PathStyle::Fill(
                    FillOptions::default().with_fill_rule(FillRule::NonZero),
                ))
            });
            builder.add_polygon(
                &[at(a, inner), at(b, inner), at(b, outer), at(a, outer)],
                true,
            );
        }
    }
    for (level, builder) in bands.into_iter().enumerate() {
        let Some(builder) = builder else {
            continue;
        };
        let c = level as f32 / (LEVELS - 1) as f32;
        // Slightly cool lights and warm shadows read as steel rather than grey.
        let mix = |lo: f32, hi: f32| ((lo + (hi - lo) * c) * tint * brightness).min(1.0);
        let color = Rgba {
            r: mix(0.09, 1.0),
            g: mix(0.085, 1.0),
            b: mix(0.08, 1.02),
            a: 1.0,
        };
        if let Ok(path) = builder.build() {
            window.paint_path(path, color);
        }
    }
}

/// Text with CSS `letter-spacing` (GPUI has none): the label is laid out
/// invisibly for its natural width plus the spacing after every glyph (as CSS
/// adds it), and each glyph is painted at its kerned position plus the
/// spacing accumulated before it.
fn letter_spaced(
    label: SharedString,
    size: f32,
    line_height: f32,
    spacing: f32,
    color: Hsla,
) -> gpui::Div {
    let count = label.chars().count() as f32;
    let text = label.clone();
    div()
        .relative()
        .flex_none()
        .text_size(px(size))
        .line_height(px(line_height))
        .whitespace_nowrap()
        .child(div().invisible().mr(px(spacing * count)).child(label))
        .child(
            canvas(
                |_, _, _| {},
                move |bounds, _, window, cx| {
                    let font = window.text_style().font();
                    let run = |len: usize| TextRun {
                        len,
                        font: font.clone(),
                        color,
                        background_color: None,
                        underline: None,
                        strikethrough: None,
                    };
                    let font_size = px(size);
                    let line = window.text_system().shape_line(
                        text.clone(),
                        font_size,
                        &[run(text.len())],
                        None,
                    );
                    let positions: Vec<(usize, Pixels)> = line
                        .runs
                        .iter()
                        .flat_map(|r| r.glyphs.iter().map(|g| (g.index, g.position.x)))
                        .collect();
                    for (i, (byte, ch)) in text.char_indices().enumerate() {
                        let Some(&(_, x)) = positions.iter().find(|(index, _)| *index == byte)
                        else {
                            continue;
                        };
                        let glyph: SharedString = ch.to_string().into();
                        let shaped = window.text_system().shape_line(
                            glyph.clone(),
                            font_size,
                            &[run(glyph.len())],
                            None,
                        );
                        let origin = point(
                            bounds.origin.x + x + px(spacing * i as f32),
                            bounds.origin.y,
                        );
                        shaped
                            .paint(origin, px(line_height), TextAlign::Left, None, window, cx)
                            .ok();
                    }
                },
            )
            .absolute()
            .top_0()
            .left_0()
            .size_full(),
        )
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

#[derive(Clone, Copy)]
struct Face {
    light: bool,
    ring: f32,
    brightness: f32,
    focus_visible: bool,
}

fn paint_chrome(bounds: Bounds<Pixels>, face: Face, metal: Metal, window: &mut Window) {
    let black = |a: f32| rgb_a(0x000000, a);
    let white = |a: f32| rgb_a(0xffffff, a);
    let radius = bounds.size.height / 2.0;
    let radii = Corners::all(radius);
    let b = face.brightness;

    if face.focus_visible {
        let offset = rgb_a(if face.light { 0xffffff } else { 0x0a0a0a }, 1.0);
        paint_focus_ring(bounds, radius, rgb_a(0xa1a1a1, 1.0), offset, window);
    }
    // Shell shadows.
    let shell = if face.light {
        [
            shadow(0.0, 10.0, 24.0, -8.0, black(0.3), false),
            shadow(0.0, 2.0, 4.0, 0.0, black(0.12), false),
            shadow(0.0, 0.0, 0.0, 1.0, black(0.18), false),
        ]
    } else {
        [
            shadow(0.0, 8.0, 20.0, -8.0, black(0.7), false),
            shadow(0.0, 2.0, 4.0, 0.0, black(0.5), false),
            shadow(0.0, 0.0, 0.0, 1.0, black(0.7), false),
        ]
    };
    window.paint_drop_shadows(bounds, radii, &shell);

    // The static silver the React shell shows before the shader paints; here it
    // only fills sub-pixel seams under the ring.
    window.paint_quad(quad(
        bounds,
        radii,
        linear_gradient(
            135.0,
            linear_color_stop(brighten(gpui::rgb(0xd9d9dc), b), 0.0),
            linear_color_stop(brighten(gpui::rgb(0x6a6a6f), b), 1.0),
        ),
        px(0.0),
        transparent_black(),
        Default::default(),
    ));
    // On a white face the ring sits a little darker so it still frames the button.
    let tint = if face.light { 0.9 } else { 1.0 };
    paint_ring(bounds, face.ring, metal, tint, b, window);
    // Tube shading on the ring: a lit top lip and a shadowed underside.
    window.paint_inset_shadows(
        bounds,
        radii,
        &[
            shadow(0.0, 1.0, 0.0, 0.0, white(0.55), true),
            shadow(0.0, -1.0, 1.0, 0.0, black(0.45), true),
        ],
    );

    // Face.
    let inner = bounds.dilate(px(-face.ring));
    let inner_radii = Corners::all(inner.size.height / 2.0);
    let (top, mid, bottom) = if face.light {
        (0xffffff, 0xfafafa, 0xf0f0f0)
    } else {
        (0x1d1d1d, 0x111111, 0x0d0d0d)
    };
    let (ring, ring_alpha) = if face.light {
        (0.25, 0.28)
    } else {
        (0.55, 0.9)
    };
    window.paint_drop_shadows(
        inner,
        inner_radii,
        &[shadow(0.0, 0.0, 0.0, 1.0, black(ring), false)],
    );
    let tone = |hex: u32, a: f32| {
        let mut c = brighten(gpui::rgb(hex), b);
        c.a = a;
        c
    };
    // A three-stop gradient (0%, 60%, 100%) as two layers: mid → bottom below
    // 60%, and top fading out over the upper 60%.
    window.paint_quad(quad(
        inner,
        inner_radii,
        linear_gradient(
            180.0,
            linear_color_stop(tone(mid, 1.0), 0.6),
            linear_color_stop(tone(bottom, 1.0), 1.0),
        ),
        px(0.0),
        transparent_black(),
        Default::default(),
    ));
    window.paint_quad(quad(
        inner,
        inner_radii,
        linear_gradient(
            180.0,
            linear_color_stop(tone(top, 1.0), 0.0),
            linear_color_stop(tone(top, 0.0), 0.6),
        ),
        px(0.0),
        transparent_black(),
        Default::default(),
    ));
    let lip = if face.light { white(0.9) } else { white(0.05) };
    window.paint_inset_shadows(
        inner,
        inner_radii,
        &[
            shadow(0.0, 1.0, 3.0, 0.0, black(ring_alpha), true),
            shadow(0.0, -1.0, 0.0, 0.0, lip, true),
        ],
    );
}

impl RenderOnce for ChromeButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let light = match self.tone {
            ChromeButtonTone::Light => true,
            ChromeButtonTone::Dark => false,
            ChromeButtonTone::Auto => !matches!(
                window.appearance(),
                WindowAppearance::Dark | WindowAppearance::VibrantDark
            ),
        };
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<ChromeState>| {
                ChromeState {
                    scale: Transition::new(1.0),
                    brightness: Transition::new(1.0),
                    hovered: false,
                    pressed: false,
                    focus_visible: false,
                    time: 0.0,
                    hover: 0.0,
                    last: None,
                    pointer: (0.0, 0.0),
                    press: (0.0, 0.0, -10.0),
                    interactive: true,
                    bounds: Rc::new(Cell::new(None)),
                    focus: cx.focus_handle().tab_stop(true),
                }
            });

        let now = Instant::now();
        let (height, ring, pad, gap, text_size) = self.size.metrics();
        let (interactive, speed) = (self.interactive, self.speed);
        let (scale, brightness, uniforms, bounds_cell, focus) = state.update(cx, |s, _| {
            s.interactive = interactive;
            s.advance(now, speed);
            let res = s
                .bounds
                .get()
                .map(|b| (b.size.width.as_f32(), b.size.height.as_f32()))
                .unwrap_or((1.0, 1.0));
            (
                s.scale.value(now),
                s.brightness.value(now),
                Metal {
                    res,
                    time: s.time,
                    pointer: s.pointer,
                    hover: s.hover,
                    press: s.press,
                },
                s.bounds.clone(),
                s.focus.clone(),
            )
        });
        let focus_visible = {
            let s = state.read(cx);
            (s.focus_visible || window.last_input_was_keyboard()) && s.focus.is_focused(window)
        };
        // The metal never stops flowing.
        window.request_animation_frame();

        let face = Face {
            light,
            ring: ring * scale,
            brightness,
            focus_visible,
        };
        let text = brighten(
            gpui::rgb(if light { 0x171717 } else { 0xfafafa }),
            brightness,
        );
        let icon_only = self.size == ChromeButtonSize::Icon;
        let content = |size: f32| {
            div()
                .flex()
                .flex_none()
                .items_center()
                .gap(px(gap))
                .whitespace_nowrap()
                .text_size(px(size))
        };
        let has_children = !self.children.is_empty();

        let mut button = div()
            .id(self.id.clone())
            .relative()
            .flex()
            .flex_none()
            .h(px(height))
            .when(icon_only, |el| el.w(px(height)))
            .p(px(ring))
            .font_weight(FontWeight::MEDIUM)
            .text_color(text)
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    move |bounds, _, _| bounds_cell.set(Some(bounds)),
                    move |bounds, _, window, _| {
                        let mut metal = uniforms;
                        metal.res = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
                        paint_chrome(scale_bounds(bounds, scale), face, metal, window);
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            );
        let face_box = div()
            .relative()
            .flex()
            .flex_1()
            .h_full()
            .items_center()
            .justify_center()
            .when(!icon_only, |el| el.px(px(pad)));
        button = if has_children {
            // Custom content stays at its own size.
            button.child(face_box.child(content(text_size).children(self.children)))
        } else {
            // The label scales with the press, as CSS `scale()` would.
            let label = self.label.clone();
            button.child(face_box.child(scaled_content(scale, move |s| {
                div()
                    .flex()
                    .items_center()
                    .gap(px(gap * s))
                    .whitespace_nowrap()
                    // tracking-tight: -0.025em of the button's 16px.
                    .child(letter_spaced(
                        label.clone(),
                        text_size * s,
                        24.0 * s,
                        -0.4 * s,
                        text,
                    ))
                    .into_any_element()
            })))
        };

        let button = wire(button, &state, &focus, self.disabled);
        if self.disabled {
            return button;
        }
        let moved = state.clone();
        let down = state.clone();
        let button = button
            .on_mouse_move(move |event: &MouseMoveEvent, _, cx| {
                moved.update(cx, |s, _| {
                    if let Some(at) = s.to_shell(event.position) {
                        s.pointer = at;
                    }
                });
            })
            .on_mouse_down(MouseButton::Left, move |event: &MouseDownEvent, _, cx| {
                down.update(cx, |s, _| {
                    if let Some(at) = s.to_shell(event.position) {
                        s.pointer = at;
                        s.wave(at);
                    }
                });
            });
        match self.on_click.clone() {
            Some(handler) => button.on_click(move |event, window, cx| handler(event, window, cx)),
            None => button,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gpui::size;

    #[test]
    fn metal_stays_in_range_and_moves() {
        let metal = Metal {
            res: (130.0, 44.0),
            time: 1.3,
            pointer: (20.0, 20.0),
            hover: 1.0,
            press: (65.0, 22.0, 1.0),
        };
        let later = Metal { time: 2.1, ..metal };
        let mut changed = 0;
        for i in 0..50 {
            let x = i as f32 * 2.6;
            let (a, b) = (metal.sample(x, 1.5), later.sample(x, 1.5));
            assert!((0.0..=1.0).contains(&a));
            if (a - b).abs() > 0.05 {
                changed += 1;
            }
        }
        assert!(changed > 10, "the metal should flow over time");
    }

    #[test]
    fn pill_outline_closes() {
        let bounds = Bounds::new(point(px(10.0), px(20.0)), size(px(130.0), px(44.0)));
        let edges = pill_edges(bounds, 3.0, 1.25);
        let first = edges[0];
        let last = edges[edges.len() - 1];
        // The left cap ends just before where the top edge starts.
        assert!((first.x - last.x).abs() < 3.0 && (first.y - last.y).abs() < 3.0);
        for e in &edges {
            assert!((e.nx.hypot(e.ny) - 1.0).abs() < 1e-3);
        }
    }
}
