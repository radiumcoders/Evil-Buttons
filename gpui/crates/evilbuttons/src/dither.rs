//! DitherButton: a bordered mono button over an animated 4×4 ordered-dither
//! wave, with a knocked-out label.

use gpui::{
    App, Bounds, ClickEvent, Context, Corners, Div, ElementId, FocusHandle, FontWeight, Hsla,
    InteractiveElement, IntoElement, ParentElement, PathBuilder, Pixels, Point, RenderOnce, Rgba,
    SharedString, StatefulInteractiveElement, Styled, Window, canvas, div, point,
    prelude::FluentBuilder, px, quad, transparent_black,
};
use std::rc::Rc;

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Easing, Instant, Transition};
use crate::surface::{ms, paint_focus_ring, rgb_a, scaled_content};

/// 4×4 Bayer matrix (values 1–16, compared against `/ 17`).
const BAYER: [[f32; 4]; 4] = [
    [16.0, 8.0, 14.0, 6.0],
    [5.0, 12.0, 2.0, 10.0],
    [13.0, 4.0, 15.0, 7.0],
    [1.0, 9.0, 3.0, 11.0],
];

/// A button with an animated ordered-dither wave behind a knocked-out label.
///
/// ```ignore
/// DitherButton::new("deploy", "Deploy Doom")
///     .colors(foreground, background)
///     .dither_color(rgb(0x10b981))
///     .dither_opacity(0.5)
///     .font_family("Geist Mono")
/// ```
#[derive(IntoElement)]
pub struct DitherButton {
    id: ElementId,
    label: SharedString,
    dither_color: Hsla,
    dither_background: Hsla,
    dither_opacity: f32,
    dither_size: f32,
    foreground: Hsla,
    background: Hsla,
    knockout: Option<Hsla>,
    border_width: f32,
    radius: f32,
    padding: (f32, f32),
    text_size: (f32, f32),
    letter_spacing: f32,
    font_family: Option<SharedString>,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl DitherButton {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            dither_color: rgb_a(0x999999, 1.0),
            dither_background: rgb_a(0x000000, 1.0),
            dither_opacity: 1.0,
            dither_size: 4.0,
            foreground: rgb_a(0xfafafa, 1.0),
            background: rgb_a(0x0a0a0a, 1.0),
            knockout: None,
            border_width: 2.0,
            radius: 6.0,
            padding: (28.0, 12.0),
            text_size: (14.0, 20.0),
            letter_spacing: 0.05,
            font_family: None,
            disabled: false,
            on_click: None,
        }
    }

    /// Colour of the dither's "on" pixels. Defaults to `#999999`.
    pub fn dither_color(mut self, color: impl Into<Hsla>) -> Self {
        self.dither_color = color.into();
        self
    }

    /// Colour of the dither's "off" pixels. Defaults to black, as the original's
    /// canvas resolves its transparent `background-color` to `rgb(0 0 0)`.
    pub fn dither_background(mut self, color: impl Into<Hsla>) -> Self {
        self.dither_background = color.into();
        self
    }

    /// Opacity of the whole dither layer (0–1). Defaults to 1.
    pub fn dither_opacity(mut self, opacity: f32) -> Self {
        self.dither_opacity = opacity.clamp(0.0, 1.0);
        self
    }

    /// Pixel scale of the dither (1–32). Higher is chunkier. Defaults to 4.
    pub fn dither_size(mut self, size: f32) -> Self {
        self.dither_size = size.round().clamp(1.0, 32.0);
        self
    }

    /// Text/border colour and button background. Defaults to near-white on near-black;
    /// pass your page's foreground and background to theme it.
    pub fn colors(mut self, foreground: impl Into<Hsla>, background: impl Into<Hsla>) -> Self {
        self.foreground = foreground.into();
        self.background = background.into();
        self
    }

    /// Colour of the label's knockout outline (the page background in the
    /// original). Defaults to the button background.
    pub fn knockout(mut self, color: impl Into<Hsla>) -> Self {
        self.knockout = Some(color.into());
        self
    }

    /// Border width in pixels. Defaults to 2.
    pub fn border_width(mut self, width: f32) -> Self {
        self.border_width = width.max(0.0);
        self
    }

    /// Corner radius in pixels. Defaults to 6; a large value makes a pill.
    pub fn radius(mut self, radius: f32) -> Self {
        self.radius = radius.max(0.0);
        self
    }

    /// Horizontal and vertical padding. Defaults to 28 × 12.
    pub fn padding(mut self, x: f32, y: f32) -> Self {
        self.padding = (x, y);
        self
    }

    /// Font size and line height. Defaults to 14 / 20.
    pub fn text_size(mut self, size: f32, line_height: f32) -> Self {
        self.text_size = (size, line_height);
        self
    }

    /// Letter spacing in em. Defaults to 0.05 (`tracking-wider`).
    pub fn letter_spacing(mut self, em: f32) -> Self {
        self.letter_spacing = em;
        self
    }

    /// Font family for the label, e.g. your monospace font. Inherits by default.
    pub fn font_family(mut self, family: impl Into<SharedString>) -> Self {
        self.font_family = Some(family.into());
        self
    }

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

struct DitherState {
    /// 0 rest → 1 pressed (`active:translate-y-0.5 active:scale-[0.99]`).
    press: Transition,
    start: Instant,
    focus_visible: bool,
    focus: FocusHandle,
}

impl Pressable for DitherState {
    fn set_hovered(&mut self, _: bool) -> bool {
        false
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.focus_visible = keyboard;
        self.press.animate_to(1.0, ms(150), Easing::STANDARD)
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        self.press.animate_to(0.0, ms(150), Easing::STANDARD)
    }
}

/// Advance of every character of `text` in `font` at `size`, unrounded, taken
/// from one shaped line (per-character text elements round their width up,
/// which would widen the label).
fn char_advances(text: &str, font: &gpui::Font, size: f32, window: &Window) -> Rc<[f32]> {
    let run = gpui::TextRun {
        len: text.len(),
        font: font.clone(),
        color: gpui::black(),
        background_color: None,
        underline: None,
        strikethrough: None,
    };
    let line = window
        .text_system()
        .shape_line(text.to_string().into(), px(size), &[run], None);
    // Glyph x by the byte index of its character.
    let mut starts: Vec<(usize, f32)> = line
        .runs
        .iter()
        .flat_map(|r| r.glyphs.iter().map(|g| (g.index, g.position.x.as_f32())))
        .collect();
    starts.sort_by_key(|(index, _)| *index);
    let width = line.width.as_f32();
    let x_at = |byte: usize| {
        starts
            .iter()
            .find(|(index, _)| *index >= byte)
            .map(|(_, x)| *x)
            .unwrap_or(width)
    };
    let bytes: Vec<usize> = text.char_indices().map(|(i, _)| i).collect();
    bytes
        .iter()
        .enumerate()
        .map(|(n, &start)| {
            let end = bytes.get(n + 1).map_or(width, |&next| x_at(next));
            (end - x_at(start)).max(0.0)
        })
        .collect()
}

/// The label with CSS letter-spacing (after every character), every box sized
/// to its true advance plus `spacing`, all at scale `s`.
fn spaced(label: &SharedString, advances: &[f32], spacing: f32, s: f32) -> Div {
    div().flex().flex_none().whitespace_nowrap().children(
        label
            .chars()
            .zip(advances.iter().copied())
            .map(move |(c, advance)| {
                div()
                    .flex_none()
                    .w(px((advance + spacing) * s))
                    .child(c.to_string())
            }),
    )
}
impl RenderOnce for DitherButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<DitherState>| {
                DitherState {
                    press: Transition::new(0.0),
                    start: Instant::now(),
                    focus_visible: false,
                    focus: cx.focus_handle().tab_stop(true),
                }
            });
        let now = Instant::now();
        let (press, time, focus, focus_visible) = {
            let s = state.read(cx);
            (
                s.press.value(now),
                now.saturating_duration_since(s.start).as_secs_f32(),
                s.focus.clone(),
                (s.focus_visible || window.last_input_was_keyboard()) && s.focus.is_focused(window),
            )
        };
        // The wave never stops.
        window.request_animation_frame();

        let scale = 1.0 - 0.01 * press;
        let shift = 2.0 * press;
        let label: SharedString = self.label.to_uppercase().into();
        let (size, line) = self.text_size;
        let mut font = window.text_style().font();
        if let Some(family) = self.font_family.clone() {
            font.family = family;
        }
        font.weight = FontWeight::BOLD;
        let advances = char_advances(&label, &font, size, window);
        let spacing = self.letter_spacing * size;
        let knockout = self.knockout.unwrap_or(self.background);
        let fg = self.foreground;
        let dither = Dither {
            on: self.dither_color,
            off: self.dither_background,
            backdrop: self.background,
            opacity: self.dither_opacity,
            size: self.dither_size,
            time,
        };
        let (bg, border_width, radius) = (self.background, self.border_width, self.radius);

        let button = div()
            .id(self.id)
            .relative()
            .top(px(shift))
            .flex()
            .flex_none()
            .items_center()
            .justify_center()
            .px(px(self.padding.0))
            .py(px(self.padding.1))
            // Reserve the border in layout; the canvas paints it.
            .border(px(border_width))
            .border_color(transparent_black())
            .font_weight(FontWeight::BOLD)
            .when_some(self.font_family, |el, family| el.font_family(family))
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| {
                        let b = crate::surface::scale_bounds(bounds, scale);
                        let r = radius.min(b.size.height.as_f32() * 0.5);
                        if focus_visible {
                            paint_focus_ring(
                                b,
                                px(r),
                                rgb_a(0xa1a1a1, 1.0),
                                rgb_a(0x0a0a0a, 1.0),
                                window,
                            );
                        }
                        window.paint_quad(quad(
                            b,
                            Corners::all(px(r)),
                            bg,
                            px(border_width * scale),
                            fg,
                            Default::default(),
                        ));
                        let inset = border_width * scale;
                        let inner = Bounds {
                            origin: point(b.origin.x + px(inset), b.origin.y + px(inset)),
                            size: gpui::size(
                                b.size.width - px(2.0 * inset),
                                b.size.height - px(2.0 * inset),
                            ),
                        };
                        dither.paint(inner, (r - inset).max(0.0), scale, window);
                    },
                )
                .absolute()
                .top(px(-border_width))
                .left(px(-border_width))
                .right(px(-border_width))
                .bottom(px(-border_width)),
            )
            .child(scaled_content(scale, move |s| {
                // `text-shadow` in the page background on all 8 sides knocks the label out.
                let offsets = [
                    (1.0, 1.0),
                    (-1.0, 1.0),
                    (1.0, -1.0),
                    (-1.0, -1.0),
                    (0.0, 2.0),
                    (0.0, -2.0),
                    (2.0, 0.0),
                    (-2.0, 0.0),
                ];
                div()
                    .relative()
                    .text_size(px(size * s))
                    .line_height(px(line * s))
                    .children(offsets.iter().map(|&(x, y)| {
                        spaced(&label, &advances, spacing, s)
                            .absolute()
                            .left(px(x * s))
                            .top(px(y * s))
                            .text_color(knockout)
                    }))
                    .child(
                        spaced(&label, &advances, spacing, s)
                            .relative()
                            .text_color(fg),
                    )
                    .into_any_element()
            }));

        let button = wire(button, &state, &focus, self.disabled);
        match self.on_click.filter(|_| !self.disabled) {
            Some(handler) => button.on_click(move |e, w, cx| handler(e, w, cx)),
            None => button,
        }
    }
}

#[derive(Clone, Copy)]
struct Dither {
    on: Hsla,
    off: Hsla,
    /// What the dither layer is composited over (the button background).
    backdrop: Hsla,
    opacity: f32,
    size: f32,
    time: f32,
}

/// `a` over `b` at `alpha`, as an opaque colour.
fn mix(b: Hsla, a: Hsla, alpha: f32) -> Hsla {
    let (a, b) = (Rgba::from(a), Rgba::from(b));
    let t = alpha * a.a;
    Rgba {
        r: b.r + (a.r - b.r) * t,
        g: b.g + (a.g - b.g) * t,
        b: b.b + (a.b - b.b) * t,
        a: 1.0,
    }
    .into()
}

impl Dither {
    /// Is grid pixel `(x, y)` "on" for a `w`×`h` grid?
    fn on_at(&self, x: usize, y: usize, w: usize, h: usize) -> bool {
        let angle = (self.time * 0.4545).sin() * 0.112;
        let (dx, dy) = (-angle.sin(), angle.cos());
        let pos_x = (x as f32 - w as f32 * 0.5) * self.size;
        let pos_y = (y as f32 - h as f32 * 0.5) * self.size;
        let value = ((pos_x * dx + pos_y * dy) * 0.048 - self.time * 1.412).sin() * 0.5 + 0.5;
        value < BAYER[y & 3][x & 3] / 17.0
    }

    /// Paints the dither into `bounds`, clipped to corner radius `radius`.
    /// The grid is sized from the unscaled box, like the canvas backing store.
    fn paint(&self, bounds: Bounds<Pixels>, radius: f32, scale: f32, window: &mut Window) {
        let (x0, y0) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
        let (w, h) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
        if w <= 0.0 || h <= 0.0 {
            return;
        }
        let off = mix(self.backdrop, self.off, self.opacity);
        let on = mix(self.backdrop, self.on, self.opacity);
        window.paint_quad(quad(
            bounds,
            Corners::all(px(radius)),
            off,
            px(0.0),
            transparent_black(),
            Default::default(),
        ));

        let gw = ((w / scale / self.size).floor() as usize).max(1);
        let gh = ((h / scale / self.size).floor() as usize).max(1);
        let sf = window.scale_factor();
        // Cell edges snapped to device pixels so neighbouring runs never seam.
        let snap = |v: f32| (v * sf).round() / sf;
        let xs: Vec<f32> = (0..=gw)
            .map(|i| snap(x0 + w * i as f32 / gw as f32))
            .collect();
        let ys: Vec<f32> = (0..=gh)
            .map(|j| snap(y0 + h * j as f32 / gh as f32))
            .collect();
        let clip = rounded_rect_polygon(bounds, radius, 6);
        let r = radius.min(w * 0.5).min(h * 0.5);

        for j in 0..gh {
            let mut i = 0;
            while i < gw {
                if !self.on_at(i, j, gw, gh) {
                    i += 1;
                    continue;
                }
                let start = i;
                while i < gw && self.on_at(i, j, gw, gh) {
                    i += 1;
                }
                let (left, right, top, bottom) = (xs[start], xs[i], ys[j], ys[j + 1]);
                let in_corner = r > 0.0
                    && (top < y0 + r || bottom > y0 + h - r)
                    && (left < x0 + r || right > x0 + w - r);
                if in_corner {
                    let rect = [(left, top), (right, top), (right, bottom), (left, bottom)];
                    let poly = clip_convex(&rect, &clip);
                    if poly.len() >= 3 {
                        let points: Vec<Point<Pixels>> =
                            poly.iter().map(|&(x, y)| point(px(x), px(y))).collect();
                        let mut builder = PathBuilder::fill();
                        builder.add_polygon(&points, true);
                        if let Ok(path) = builder.build() {
                            window.paint_path(path, on);
                        }
                    }
                } else {
                    window.paint_quad(quad(
                        Bounds {
                            origin: point(px(left), px(top)),
                            size: gpui::size(px(right - left), px(bottom - top)),
                        },
                        Corners::default(),
                        on,
                        px(0.0),
                        transparent_black(),
                        Default::default(),
                    ));
                }
            }
        }
    }
}

/// Clockwise polygon of a rounded rect.
fn rounded_rect_polygon(bounds: Bounds<Pixels>, radius: f32, segments: usize) -> Vec<(f32, f32)> {
    let (x0, y0) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
    let (x1, y1) = (
        x0 + bounds.size.width.as_f32(),
        y0 + bounds.size.height.as_f32(),
    );
    let r = radius
        .min(bounds.size.width.as_f32() * 0.5)
        .min(bounds.size.height.as_f32() * 0.5);
    let corners = [
        (x1 - r, y0 + r, -90.0_f32),
        (x1 - r, y1 - r, 0.0),
        (x0 + r, y1 - r, 90.0),
        (x0 + r, y0 + r, 180.0),
    ];
    let mut points = Vec::with_capacity(4 * (segments + 1));
    for (cx, cy, start) in corners {
        for s in 0..=segments {
            let angle = (start + 90.0 * s as f32 / segments as f32).to_radians();
            points.push((cx + r * angle.cos(), cy + r * angle.sin()));
        }
    }
    points
}

/// Sutherland–Hodgman: clips `subject` against the convex, clockwise `clip`.
fn clip_convex(subject: &[(f32, f32)], clip: &[(f32, f32)]) -> Vec<(f32, f32)> {
    let mut output = subject.to_vec();
    for i in 0..clip.len() {
        if output.is_empty() {
            break;
        }
        let a = clip[i];
        let b = clip[(i + 1) % clip.len()];
        let inside = |p: (f32, f32)| (b.0 - a.0) * (p.1 - a.1) - (b.1 - a.1) * (p.0 - a.0) >= 0.0;
        let intersect = |p: (f32, f32), q: (f32, f32)| {
            let (dx, dy) = (q.0 - p.0, q.1 - p.1);
            let (ex, ey) = (b.0 - a.0, b.1 - a.1);
            let denom = dx * ey - dy * ex;
            if denom.abs() < f32::EPSILON {
                return p;
            }
            let t = ((a.0 - p.0) * ey - (a.1 - p.1) * ex) / denom;
            (p.0 + dx * t, p.1 + dy * t)
        };
        let input = std::mem::take(&mut output);
        for j in 0..input.len() {
            let current = input[j];
            let previous = input[(j + input.len() - 1) % input.len()];
            match (inside(current), inside(previous)) {
                (true, true) => output.push(current),
                (true, false) => {
                    output.push(intersect(previous, current));
                    output.push(current);
                }
                (false, true) => output.push(intersect(previous, current)),
                (false, false) => {}
            }
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dither_matches_threshold_formula() {
        let d = Dither {
            on: rgb_a(0xffffff, 1.0),
            off: rgb_a(0x000000, 1.0),
            backdrop: rgb_a(0x000000, 1.0),
            opacity: 1.0,
            size: 4.0,
            time: 0.0,
        };
        // At t=0 the wave is sin(posY·0.048)·0.5+0.5; at the grid centre value = 0.5.
        assert!(d.on_at(10, 5, 20, 10) == (0.5 < BAYER[1][2] / 17.0));
    }

    #[test]
    fn mix_composites_over_backdrop() {
        let c = Rgba::from(mix(rgb_a(0x000000, 1.0), rgb_a(0xffffff, 1.0), 0.5));
        assert!((c.r - 0.5).abs() < 1e-3 && c.a == 1.0);
    }
}
