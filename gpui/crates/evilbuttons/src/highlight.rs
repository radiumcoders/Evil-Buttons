//! HighlightButton: a cursor spotlight, a border that lights up near the
//! pointer, and a ripple from wherever you click.

use gpui::{
    App, Bounds, BoxShadow, ClickEvent, Context, Corners, ElementId, FocusHandle, FontWeight, Hsla,
    InteractiveElement, IntoElement, MouseButton, MouseMoveEvent, ParentElement, PathBuilder,
    Pixels, Point, RenderOnce, SharedString, StatefulInteractiveElement, Styled, Window,
    WindowAppearance, canvas, div, point, prelude::FluentBuilder, px, quad, transparent_black,
};
use std::{cell::Cell, f32::consts::TAU, rc::Rc};

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Easing, Instant, Timeline, Transition};
use crate::surface::{
    PressMotion, ms, paint_focus_ring, paint_graded_surface, rgb_a, scale_bounds, scaled_content,
};

/// `cubic-bezier(0.22, 1, 0.36, 1)`, the ripple's curve.
const RIPPLE_EASE: Easing = Easing::CubicBezier(0.22, 1.0, 0.36, 1.0);

/// Surface style of a [`HighlightButton`].
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum HighlightButtonVariant {
    /// The graded dark Evil Buttons surface.
    #[default]
    Default,
    /// A flat, muted fill.
    Secondary,
    /// The page background with a hairline border.
    Outline,
}

/// A button with a cursor spotlight, a lit border near the pointer, and a click ripple.
///
/// ```ignore
/// HighlightButton::new("send", "Send")
///     .variant(HighlightButtonVariant::Outline)
///     .on_click(|_, _, _| send())
/// ```
#[derive(IntoElement)]
pub struct HighlightButton {
    id: ElementId,
    label: SharedString,
    variant: HighlightButtonVariant,
    highlight_color: Option<Hsla>,
    highlight_size: f32,
    border_color: Option<Hsla>,
    dark: Option<bool>,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl HighlightButton {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            variant: HighlightButtonVariant::Default,
            highlight_color: None,
            highlight_size: 90.0,
            border_color: None,
            dark: None,
            disabled: false,
            on_click: None,
        }
    }

    /// Surface style. Defaults to [`HighlightButtonVariant::Default`].
    pub fn variant(mut self, variant: HighlightButtonVariant) -> Self {
        self.variant = variant;
        self
    }

    /// Colour of the cursor spotlight and click ripple. Defaults to the text colour at 28%.
    pub fn highlight_color(mut self, color: impl Into<Hsla>) -> Self {
        self.highlight_color = Some(color.into());
        self
    }

    /// Radius in px of the cursor spotlight. Defaults to `90`.
    pub fn highlight_size(mut self, size: f32) -> Self {
        self.highlight_size = size.max(1.0);
        self
    }

    /// Colour the border lights up with near the cursor. Defaults to the text colour at 75%.
    pub fn border_color(mut self, color: impl Into<Hsla>) -> Self {
        self.border_color = Some(color.into());
        self
    }

    /// Use the dark-theme colours for the secondary and outline surfaces.
    /// Defaults to the window's appearance.
    pub fn dark(mut self, dark: bool) -> Self {
        self.dark = Some(dark);
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

/// Theme colours for one variant.
struct Look {
    text: Hsla,
    background: Hsla,
    hover_background: Hsla,
    border: Hsla,
    drops: Vec<BoxShadow>,
    insets: Vec<BoxShadow>,
    ring: Hsla,
    ring_offset: Hsla,
}

fn shadow(x: f32, y: f32, blur: f32, spread: f32, color: Hsla, inset: bool) -> BoxShadow {
    BoxShadow {
        color,
        offset: point(px(x), px(y)),
        blur_radius: px(blur),
        spread_radius: px(spread),
        inset,
    }
}

fn look(variant: HighlightButtonVariant, dark: bool) -> Look {
    let (foreground, page, secondary, secondary_fg, accent, border, ring) = if dark {
        (
            0xfafafa,
            0x0a0a0a,
            0x262626,
            0xfafafa,
            0x262626,
            rgb_a(0xffffff, 0.1),
            0x737373,
        )
    } else {
        (
            0x0a0a0a,
            0xffffff,
            0xf5f5f5,
            0x171717,
            0xf5f5f5,
            rgb_a(0xe5e5e5, 1.0),
            0xa1a1a1,
        )
    };
    let (drops, insets) = if dark {
        (
            vec![shadow(0.0, 1.0, 2.0, 0.0, rgb_a(0x000000, 0.4), false)],
            vec![shadow(0.0, 1.0, 0.0, 0.0, rgb_a(0xffffff, 0.05), true)],
        )
    } else {
        (
            vec![
                shadow(0.0, 2.0, 6.0, -3.0, rgb_a(0x000000, 0.07), false),
                shadow(0.0, 1.0, 2.0, 0.0, rgb_a(0x000000, 0.05), false),
            ],
            vec![shadow(0.0, -1.0, 0.0, 0.0, rgb_a(0x000000, 0.03), true)],
        )
    };
    let base = |text: u32, bg: Hsla, hover: Hsla, border: Hsla| Look {
        text: rgb_a(text, 1.0),
        background: bg,
        hover_background: hover,
        border,
        drops: drops.clone(),
        insets: insets.clone(),
        ring: rgb_a(ring, 1.0),
        ring_offset: rgb_a(page, 1.0),
    };
    match variant {
        HighlightButtonVariant::Default => Look {
            text: rgb_a(0xfafafa, 1.0),
            ..base(
                0xfafafa,
                transparent_black(),
                transparent_black(),
                transparent_black(),
            )
        },
        // `bg-secondary/80` and `bg-accent/40` are translucent; they're composited
        // over the page here, because GPUI's drop shadows would show through
        // a translucent fill (CSS clips box-shadows under the box).
        HighlightButtonVariant::Secondary => base(
            secondary_fg,
            rgb_a(secondary, 1.0),
            mix(rgb_a(page, 1.0), rgb_a(secondary, 1.0), 0.8),
            transparent_black(),
        ),
        HighlightButtonVariant::Outline => base(
            foreground,
            rgb_a(page, 1.0),
            mix(rgb_a(page, 1.0), rgb_a(accent, 1.0), 0.4),
            border,
        ),
    }
}

struct Ripple {
    x: f32,
    y: f32,
    size: f32,
    timeline: Timeline,
}

struct HighlightState {
    motion: PressMotion,
    /// Spotlight and lit-border visibility (hover, 300ms).
    glow: Transition,
    /// Secondary/outline hover fill (300ms springy).
    hover_fill: Transition,
    /// Pointer in button-local layout pixels; `None` = centre.
    pointer: Option<(f32, f32)>,
    ripples: Vec<Ripple>,
    bounds: Rc<Cell<Option<Bounds<Pixels>>>>,
    focus: FocusHandle,
}

impl HighlightState {
    fn track(&mut self, position: Point<Pixels>) -> Option<(f32, f32, Bounds<Pixels>)> {
        let bounds = self.bounds.get()?;
        let x = (position.x - bounds.origin.x).as_f32();
        let y = (position.y - bounds.origin.y).as_f32();
        self.pointer = Some((x, y));
        Some((x, y, bounds))
    }

    fn add_ripple(&mut self, x: f32, y: f32, bounds: Bounds<Pixels>) {
        let (w, h) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
        // Big enough to reach the farthest corner from where it starts.
        let size = 2.0 * (x.max(w - x)).hypot(y.max(h - y));
        self.ripples.push(Ripple {
            x,
            y,
            size,
            timeline: Timeline::start(ms(600)),
        });
    }
}

impl Pressable for HighlightState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        let target = if hovered { 1.0 } else { 0.0 };
        self.glow.animate_to(target, ms(300), Easing::STANDARD);
        self.hover_fill.animate_to(target, ms(300), Easing::SPRINGY);
        self.motion.set_hovered(hovered);
        true
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.motion.focus_visible = keyboard;
        self.motion.press()
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        self.motion.release()
    }
}

impl RenderOnce for HighlightButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state = window.use_keyed_state(
            self.id.clone(),
            cx,
            |_, cx: &mut Context<HighlightState>| HighlightState {
                motion: PressMotion::new(),
                glow: Transition::new(0.0),
                hover_fill: Transition::new(0.0),
                pointer: None,
                ripples: Vec::new(),
                bounds: Rc::new(Cell::new(None)),
                focus: cx.focus_handle().tab_stop(true),
            },
        );

        let dark = self.dark.unwrap_or(matches!(
            window.appearance(),
            WindowAppearance::Dark | WindowAppearance::VibrantDark
        ));
        let variant = self.variant;
        let look = look(variant, dark);
        let highlight = self.highlight_color.unwrap_or(look.text.opacity(0.28));
        let border_glow = self.border_color.unwrap_or(look.text.opacity(0.75));
        let spot_radius = self.highlight_size * 0.7;
        let ring_radius = self.highlight_size * 0.9 * 0.75;

        let now = Instant::now();
        let (
            frame,
            glow,
            hover_fill,
            pointer,
            ripples,
            bounds_cell,
            focus,
            focus_visible,
            animating,
        ) = state.update(cx, |s, _| {
            s.ripples.retain(|r| !r.timeline.is_done(now));
            let frame = s.motion.frame(now);
            let ripples: Vec<(f32, f32, f32, f32)> = s
                .ripples
                .iter()
                .map(|r| {
                    (
                        r.x,
                        r.y,
                        r.size,
                        RIPPLE_EASE.apply(r.timeline.progress(now)),
                    )
                })
                .collect();
            let animating = frame.animating
                || s.glow.is_animating(now)
                || s.hover_fill.is_animating(now)
                || !ripples.is_empty();
            (
                frame,
                s.glow.value(now).clamp(0.0, 1.0),
                s.hover_fill.value(now),
                s.pointer,
                ripples,
                s.bounds.clone(),
                s.focus.clone(),
                (s.motion.focus_visible || window.last_input_was_keyboard())
                    && s.focus.is_focused(window),
                animating,
            )
        });
        if animating {
            window.request_animation_frame();
        }

        let radius = 10.0_f32;
        let text = if variant == HighlightButtonVariant::Default {
            filtered_text(frame.brightness)
        } else {
            look.text
        };
        let background = mix(look.background, look.hover_background, hover_fill);
        let Look {
            border,
            drops,
            insets,
            ring,
            ring_offset,
            ..
        } = look;

        let label = self.label.clone();
        let button = div()
            .id(self.id.clone())
            .relative()
            .flex()
            .flex_none()
            .h(px(36.0))
            // px-4 plus the 1px border, which is painted rather than laid out.
            .px(px(17.0))
            .items_center()
            .justify_center()
            .whitespace_nowrap()
            .font_weight(FontWeight::MEDIUM)
            .text_color(text)
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    move |bounds, _, _| bounds_cell.set(Some(bounds)),
                    move |bounds, _, window, _| {
                        let scale = frame.scale;
                        let surface = scale_bounds(bounds, scale);
                        let r = px(radius * scale);
                        if focus_visible {
                            paint_focus_ring(surface, r, ring, ring_offset, window);
                        }
                        if variant == HighlightButtonVariant::Default {
                            paint_graded_surface(bounds, frame, px(radius), window);
                        } else {
                            let radii = Corners::all(r);
                            window.paint_drop_shadows(surface, radii, &drops);
                            window.paint_quad(quad(
                                surface,
                                radii,
                                background,
                                px(1.0 * scale),
                                border,
                                Default::default(),
                            ));
                            window.paint_inset_shadows(surface, radii, &insets);
                        }

                        // Local layout coordinates → painted (press-scaled) coordinates.
                        let origin = surface.origin;
                        let to_screen = |x: f32, y: f32| {
                            (origin.x.as_f32() + x * scale, origin.y.as_f32() + y * scale)
                        };
                        let (w, h) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
                        let (px_, py_) = pointer.unwrap_or((w * 0.5, h * 0.5));
                        let cursor = to_screen(px_, py_);

                        // Spotlight and ripples live in the padding box, clipped to its corners.
                        let inner = inset_bounds(surface, scale);
                        let clip = rounded_rect_polygon(inner, (radius - 1.0) * scale, 6);
                        if glow > 0.001 {
                            paint_radial(
                                cursor,
                                spot_radius * scale,
                                highlight.opacity(glow),
                                &clip,
                                window,
                            );
                        }
                        for &(x, y, size, e) in &ripples {
                            let fade = 1.0 - e;
                            if highlight.a * fade <= 0.002 {
                                continue;
                            }
                            let center = to_screen(x, y);
                            let disc = circle(center, size * 0.5 * e * scale, 48);
                            fill_polygon(
                                &clip_convex(&disc, &clip),
                                highlight.opacity(fade),
                                window,
                            );
                        }
                        if glow > 0.001 {
                            paint_lit_border(
                                surface,
                                radius * scale,
                                scale,
                                cursor,
                                ring_radius * scale,
                                border_glow.opacity(glow),
                                window,
                            );
                        }
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            .child(scaled_content(frame.scale, |s| {
                div()
                    .flex()
                    .items_center()
                    .gap(px(6.0 * s))
                    .text_size(px(14.0 * s))
                    .line_height(px(20.0 * s))
                    .child(label.clone())
                    .into_any_element()
            }));

        let button = wire(button, &state, &focus, self.disabled);
        if self.disabled {
            return button;
        }
        let move_state = state.clone();
        let down_state = state.clone();
        let click_state = state.clone();
        let on_click = self.on_click.clone();
        button
            .on_mouse_move(move |event: &MouseMoveEvent, _, cx| {
                move_state.update(cx, |s, cx| {
                    if s.track(event.position).is_some() {
                        cx.notify();
                    }
                });
            })
            .on_mouse_down(MouseButton::Left, move |event, _, cx| {
                down_state.update(cx, |s, cx| {
                    if let Some((x, y, bounds)) = s.track(event.position) {
                        s.add_ripple(x, y, bounds);
                        cx.notify();
                    }
                });
            })
            .on_click(move |event, window, cx| {
                if event.is_keyboard() {
                    // Keyboard activation has no pointer, so ripple from the centre.
                    click_state.update(cx, |s, cx| {
                        if let Some(bounds) = s.bounds.get() {
                            let (w, h) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
                            s.add_ripple(w * 0.5, h * 0.5, bounds);
                            cx.notify();
                        }
                    });
                }
                if let Some(handler) = on_click.as_ref() {
                    handler(event, window, cx);
                }
            })
    }
}

fn mix(a: Hsla, b: Hsla, t: f32) -> Hsla {
    let (a, b) = (gpui::Rgba::from(a), gpui::Rgba::from(b));
    let l = |x: f32, y: f32| x + (y - x) * t;
    gpui::Rgba {
        r: l(a.r, b.r),
        g: l(a.g, b.g),
        b: l(a.b, b.b),
        a: l(a.a, b.a).clamp(0.0, 1.0),
    }
    .into()
}

/// The padding box: the border box inset by the 1px border.
fn inset_bounds(bounds: Bounds<Pixels>, scale: f32) -> Bounds<Pixels> {
    let d = px(scale);
    Bounds {
        origin: point(bounds.origin.x + d, bounds.origin.y + d),
        size: gpui::size(bounds.size.width - d * 2.0, bounds.size.height - d * 2.0),
    }
}

fn circle(center: (f32, f32), radius: f32, segments: usize) -> Vec<(f32, f32)> {
    (0..segments)
        .map(|i| {
            let a = TAU * i as f32 / segments as f32;
            (center.0 + radius * a.cos(), center.1 + radius * a.sin())
        })
        .collect()
}

fn fill_polygon(points: &[(f32, f32)], color: Hsla, window: &mut Window) {
    if points.len() < 3 || color.a <= 0.0 {
        return;
    }
    let points: Vec<Point<Pixels>> = points.iter().map(|&(x, y)| point(px(x), px(y))).collect();
    let mut builder = PathBuilder::fill();
    builder.add_polygon(&points, true);
    if let Ok(path) = builder.build() {
        window.paint_path(path, color);
    }
}

/// `radial-gradient(circle, color, transparent radius)`: the alpha falls off
/// linearly to zero at `radius`. Painted as stacked discs whose composited
/// alpha follows that ramp, each clipped to `clip`.
fn paint_radial(
    center: (f32, f32),
    radius: f32,
    color: Hsla,
    clip: &[(f32, f32)],
    window: &mut Window,
) {
    const RINGS: usize = 16;
    let peak = color.a;
    let mut covered = 0.0_f32;
    for k in 0..RINGS {
        let outer = radius * (RINGS - k) as f32 / RINGS as f32;
        let mid = radius * (RINGS as f32 - k as f32 - 0.5) / RINGS as f32;
        let target = peak * (1.0 - mid / radius);
        // Composited alpha of this band = 1 − Π(1 − aᵢ) over the discs covering it.
        let alpha = 1.0 - (1.0 - target) / (1.0 - covered);
        covered = target;
        if alpha <= 0.0005 {
            continue;
        }
        let disc = circle(center, outer, 40);
        fill_polygon(&clip_convex(&disc, clip), color.alpha(alpha), window);
    }
}

/// The 1px border ring, lit by a radial falloff around `cursor`.
fn paint_lit_border(
    bounds: Bounds<Pixels>,
    radius: f32,
    width: f32,
    cursor: (f32, f32),
    reach: f32,
    color: Hsla,
    window: &mut Window,
) {
    let outer = outline(bounds, radius, 0.0);
    let inner = outline(bounds, radius, width);
    const LEVELS: usize = 24;
    let mut buckets: Vec<Option<PathBuilder>> = (0..LEVELS).map(|_| None).collect();
    for i in 0..outer.len() {
        let j = (i + 1) % outer.len();
        let mid = (
            (outer[i].0 + outer[j].0) * 0.5,
            (outer[i].1 + outer[j].1) * 0.5,
        );
        let d = (mid.0 - cursor.0).hypot(mid.1 - cursor.1);
        let strength = 1.0 - d / reach;
        if strength <= 0.0 {
            continue;
        }
        let level = ((strength * LEVELS as f32).ceil() as usize).clamp(1, LEVELS) - 1;
        let quad: Vec<Point<Pixels>> = [outer[i], outer[j], inner[j], inner[i]]
            .iter()
            .map(|&(x, y)| point(px(x), px(y)))
            .collect();
        buckets[level]
            .get_or_insert_with(PathBuilder::fill)
            .add_polygon(&quad, true);
    }
    for (level, builder) in buckets.into_iter().enumerate() {
        let Some(builder) = builder else { continue };
        let strength = (level as f32 + 0.5) / LEVELS as f32;
        if let Ok(path) = builder.build() {
            window.paint_path(path, color.opacity(strength));
        }
    }
}

/// Points around a rounded rect inset by `inset`, sampled identically for any
/// inset so outlines can be paired into a ring.
fn outline(bounds: Bounds<Pixels>, radius: f32, inset: f32) -> Vec<(f32, f32)> {
    const ARC: usize = 6;
    let (x0, y0) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
    let (w, h) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
    let r = radius.min(w * 0.5).min(h * 0.5);
    let ri = (r - inset).max(0.0);
    let steps = |len: f32| ((len / 4.0).ceil() as usize).max(1);
    let (sx, sy) = (steps(w - 2.0 * r), steps(h - 2.0 * r));
    // Corner centres, clockwise from the top-right, with the arc's start angle.
    let corners = [
        (x0 + w - r, y0 + r, -90.0_f32),
        (x0 + w - r, y0 + h - r, 0.0),
        (x0 + r, y0 + h - r, 90.0),
        (x0 + r, y0 + r, 180.0),
    ];
    let mut points = Vec::new();
    for (index, &(cx, cy, start)) in corners.iter().enumerate() {
        for s in 0..=ARC {
            let a = (start + 90.0 * s as f32 / ARC as f32).to_radians();
            points.push((cx + ri * a.cos(), cy + ri * a.sin()));
        }
        // Straight edge to the next corner.
        let (nx, ny, nstart) = corners[(index + 1) % 4];
        let a0 = (start + 90.0).to_radians();
        let a1 = nstart.to_radians();
        let from = (cx + ri * a0.cos(), cy + ri * a0.sin());
        let to = (nx + ri * a1.cos(), ny + ri * a1.sin());
        let n = if index % 2 == 0 { sy } else { sx };
        for k in 1..n {
            let t = k as f32 / n as f32;
            points.push((from.0 + (to.0 - from.0) * t, from.1 + (to.1 - from.1) * t));
        }
    }
    points
}

/// Clockwise polygon of a rounded rect.
fn rounded_rect_polygon(bounds: Bounds<Pixels>, radius: f32, segments: usize) -> Vec<(f32, f32)> {
    let (x0, y0) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
    let (x1, y1) = (
        x0 + bounds.size.width.as_f32(),
        y0 + bounds.size.height.as_f32(),
    );
    let r = radius
        .max(0.0)
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

/// Sutherland–Hodgman: clips convex `subject` against convex, clockwise `clip`.
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

/// `text-neutral-50` under the button's CSS `filter: brightness()`, which dims
/// the label too while pressed.
fn filtered_text(brightness: f32) -> gpui::Hsla {
    crate::surface::brighten(gpui::rgb(0xfafafa), brightness)
}

#[cfg(test)]
mod tests {
    use super::*;
    use gpui::size;

    #[test]
    fn outlines_pair_up_for_any_inset() {
        let bounds = Bounds::new(point(px(0.0), px(0.0)), size(px(120.0), px(36.0)));
        assert_eq!(
            outline(bounds, 10.0, 0.0).len(),
            outline(bounds, 10.0, 1.0).len()
        );
    }

    #[test]
    fn radial_rings_reach_the_peak_alpha() {
        // Composite alpha of the innermost band should approach the peak.
        let peak = 0.28_f32;
        let rings = 16;
        let mut covered = 0.0_f32;
        let mut composite = 0.0_f32;
        for k in 0..rings {
            let mid = (rings as f32 - k as f32 - 0.5) / rings as f32;
            let target = peak * (1.0 - mid);
            let alpha = 1.0 - (1.0 - target) / (1.0 - covered);
            covered = target;
            composite = 1.0 - (1.0 - composite) * (1.0 - alpha);
        }
        assert!((composite - peak * (1.0 - 0.5 / rings as f32)).abs() < 1e-4);
    }
}
