//! FrameButton: a futuristic, letter-spaced button with springy corner
//! markers that spread on hover and lock on when pressed, plus a scan sweep.

use gpui::{
    App, Bounds, BoxShadow, ClickEvent, ContentMask, Context, Corners, Div, ElementId, FocusHandle,
    FontWeight, Hsla, InteractiveElement, IntoElement, ParentElement, PathBuilder, Pixels, Point,
    RenderOnce, SharedString, StatefulInteractiveElement, Styled, Window, WindowAppearance, canvas,
    div, point, prelude::FluentBuilder, px, quad, size, transparent_black,
};
use std::rc::Rc;

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Duration, Easing, Instant, Spring, SpringConfig, Timeline, Transition};
use crate::surface::{PressMotion, ms, paint_graded_surface, rgb_a, scale_bounds, scaled_content};

/// `{ type: "spring", stiffness: 380, damping: 24 }`.
const SPRING: SpringConfig = SpringConfig::new(380.0, 24.0);

/// Visual style of a [`FrameButton`].
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum FrameButtonVariant {
    /// The graded dark Evil Buttons surface.
    #[default]
    Default,
    /// A soft secondary fill that floods with the foreground colour on hover.
    Secondary,
    /// Transparent with a hairline border.
    Outline,
}

/// A letter-spaced button framed by four corner markers.
///
/// Hover (or focus) spreads the markers and sweeps a light band across the
/// face; pressing snaps the markers in tight against the edges.
///
/// ```ignore
/// FrameButton::new("start", "Get Started").on_click(|_, _, _| start())
/// ```
#[derive(IntoElement)]
pub struct FrameButton {
    id: ElementId,
    label: SharedString,
    variant: FrameButtonVariant,
    glow: bool,
    marker_size: f32,
    offset: f32,
    hover_offset: f32,
    dark: Option<bool>,
    font_family: Option<SharedString>,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl FrameButton {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            variant: FrameButtonVariant::Default,
            glow: false,
            marker_size: 14.0,
            offset: 6.0,
            hover_offset: 5.0,
            dark: None,
            font_family: None,
            disabled: false,
            on_click: None,
        }
    }

    pub fn variant(mut self, variant: FrameButtonVariant) -> Self {
        self.variant = variant;
        self
    }

    /// Bloom a soft glow behind the button on hover. Defaults to `false`.
    pub fn glow(mut self, glow: bool) -> Self {
        self.glow = glow;
        self
    }

    /// Corner marker size in px. Defaults to `14`.
    pub fn marker_size(mut self, size: f32) -> Self {
        self.marker_size = size;
        self
    }

    /// Distance in px the markers sit outside the button's edge. Defaults to `6`.
    pub fn offset(mut self, offset: f32) -> Self {
        self.offset = offset;
        self
    }

    /// How far in px the markers spread out on hover. Defaults to `5`.
    pub fn hover_offset(mut self, offset: f32) -> Self {
        self.hover_offset = offset;
        self
    }

    /// Use the dark theme colours (markers, secondary and outline variants).
    /// Defaults to the window's appearance.
    pub fn dark(mut self, dark: bool) -> Self {
        self.dark = Some(dark);
        self
    }

    /// Font family for the label.
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

/// The shadcn neutral tokens the original reads.
struct Tokens {
    foreground: Hsla,
    background: Hsla,
    secondary: Hsla,
    secondary_foreground: Hsla,
    border: Hsla,
    ring: Hsla,
    dark: bool,
}

fn tokens(dark: bool) -> Tokens {
    if dark {
        Tokens {
            foreground: rgb_a(0xfafafa, 1.0),
            background: rgb_a(0x0a0a0a, 1.0),
            secondary: rgb_a(0x262626, 1.0),
            secondary_foreground: rgb_a(0xfafafa, 1.0),
            border: rgb_a(0xffffff, 0.1),
            ring: rgb_a(0x737373, 1.0),
            dark,
        }
    } else {
        Tokens {
            foreground: rgb_a(0x0a0a0a, 1.0),
            background: rgb_a(0xffffff, 1.0),
            secondary: rgb_a(0xf5f5f5, 1.0),
            secondary_foreground: rgb_a(0x171717, 1.0),
            border: rgb_a(0xe5e5e5, 1.0),
            ring: rgb_a(0xa1a1a1, 1.0),
            dark,
        }
    }
}

struct FrameState {
    /// Scale, brightness and settled shadows of the default surface.
    motion: PressMotion,
    /// CSS `:hover` / `:focus-visible` colour transitions (0–1).
    hover_colors: Transition,
    marker_colors: Transition,
    /// Marker displacement in px (+ spreads out, − locks on).
    markers: Sprung,
    glow_opacity: Sprung,
    glow_scale: Sprung,
    sweep: Option<Timeline>,
    hovered: bool,
    pressed: bool,
    /// Motion's `whileFocus`: any focus keeps the hover pose.
    focused: bool,
    focus_visible: bool,
    focus: FocusHandle,
    hover_offset: f32,
    offset: f32,
}

impl FrameState {
    /// Re-targets the motion variants: `tap` > `hover` (hover or focus) > `rest`.
    fn retarget(&mut self) {
        let engaged = self.hovered || self.focused;
        let (markers, glow_opacity, glow_scale) = if self.pressed {
            (-(self.offset - 1.0), 0.5, 1.0)
        } else if engaged {
            (self.hover_offset, 0.35, 1.08)
        } else {
            (0.0, 0.0, 0.9)
        };
        self.markers.set(markers);
        self.glow_opacity.set(glow_opacity);
        self.glow_scale.set(glow_scale);
        if engaged || self.pressed {
            if self.sweep.is_none() {
                self.sweep = Some(Timeline::start(SWEEP));
            }
        } else {
            self.sweep = None;
        }
        let colors = if self.hovered || (self.focused && self.focus_visible) {
            1.0
        } else {
            0.0
        };
        self.hover_colors
            .animate_to(colors, ms(300), Easing::SPRINGY);
        self.marker_colors
            .animate_to(colors, ms(300), Easing::STANDARD);
    }
}

/// A spring that remembers its target, so re-targeting to the same value is a no-op.
#[derive(Clone, Copy)]
struct Sprung {
    spring: Spring,
    target: f32,
}

impl Sprung {
    fn new(value: f32) -> Self {
        Self {
            spring: Spring::new(value, SPRING),
            target: value,
        }
    }

    fn set(&mut self, target: f32) {
        if self.target != target {
            self.target = target;
            self.spring.set_target(target);
        }
    }
}

const SWEEP: Duration = Duration::from_millis(900);

impl Pressable for FrameState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        self.hovered = hovered;
        self.motion.set_hovered(hovered);
        self.retarget();
        true
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.focus_visible = keyboard;
        self.motion.focus_visible = keyboard;
        self.pressed = true;
        self.motion.press();
        self.retarget();
        true
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        if !self.pressed {
            return false;
        }
        self.pressed = false;
        self.motion.release();
        self.retarget();
        true
    }
}

impl RenderOnce for FrameButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<FrameState>| {
                FrameState {
                    motion: PressMotion::new(),
                    hover_colors: Transition::new(0.0),
                    marker_colors: Transition::new(0.0),
                    markers: Sprung::new(0.0),
                    glow_opacity: Sprung::new(0.0),
                    glow_scale: Sprung::new(0.9),
                    sweep: None,
                    hovered: false,
                    pressed: false,
                    focused: false,
                    focus_visible: false,
                    focus: cx.focus_handle().tab_stop(true),
                    hover_offset: 5.0,
                    offset: 6.0,
                }
            });
        let focused = state.read(cx).focus.is_focused(window);
        let now = Instant::now();
        let (hover_offset, offset) = (self.hover_offset, self.offset);
        let snapshot = state.update(cx, |s, _| {
            s.hover_offset = hover_offset;
            s.offset = offset;
            if s.focused != focused {
                s.focused = focused;
                if !focused {
                    s.focus_visible = false;
                }
                s.retarget();
            }
            let frame = s.motion.frame(now);
            let sweep = s.sweep.map(|t| t.progress(now));
            let animating = frame.animating
                || s.hover_colors.is_animating(now)
                || s.marker_colors.is_animating(now)
                || !s.markers.spring.is_settled()
                || !s.glow_opacity.spring.is_settled()
                || !s.glow_scale.spring.is_settled()
                || sweep.is_some_and(|p| p < 1.0);
            Snapshot {
                frame,
                hover_colors: s.hover_colors.value(now).clamp(0.0, 1.0),
                marker_colors: s.marker_colors.value(now).clamp(0.0, 1.0),
                markers: s.markers.spring.value(now),
                glow_opacity: s.glow_opacity.spring.value(now).clamp(0.0, 1.0),
                glow_scale: s.glow_scale.spring.value(now),
                sweep,
                focus: s.focus.clone(),
                focus_ring: s.focus_visible && focused,
                animating,
            }
        });
        if snapshot.animating {
            window.request_animation_frame();
        }

        let dark = self.dark.unwrap_or(matches!(
            window.appearance(),
            WindowAppearance::Dark | WindowAppearance::VibrantDark
        ));
        let t = tokens(dark);
        let variant = self.variant;
        let h = snapshot.hover_colors;
        let frame = snapshot.frame;
        let text = match variant {
            // `filter: brightness()` dims the label too while pressed.
            FrameButtonVariant::Default => {
                crate::surface::brighten(gpui::rgb(0xfafafa), frame.brightness)
            }
            FrameButtonVariant::Secondary => mix(t.secondary_foreground, t.background, h),
            FrameButtonVariant::Outline => t.foreground,
        };
        let scale = frame.scale;
        let marker_color = mix(
            t.foreground.opacity(0.35),
            t.foreground,
            snapshot.marker_colors,
        );
        let glow = self
            .glow
            .then_some((snapshot.glow_opacity, snapshot.glow_scale, t.foreground));
        let (marker_size, markers, focus_ring) =
            (self.marker_size, snapshot.markers, snapshot.focus_ring);
        let sweep = snapshot.sweep.filter(|p| *p < 1.0).map(|p| {
            // translateX(-120% → 320%) of a third-width band.
            -1.2 + 4.4 * Easing::STANDARD.apply(p)
        });
        let sweep_color = text;

        let button = div()
            .id(self.id)
            .relative()
            .flex()
            .flex_none()
            .items_center()
            .justify_center()
            .border_1()
            .border_color(transparent_black())
            .px(px(32.0))
            .py(px(14.0))
            .text_size(px(12.0))
            .line_height(px(16.0))
            .font_weight(FontWeight::MEDIUM)
            .text_color(text)
            .when_some(self.font_family, |el, family| el.font_family(family))
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| {
                        let b = scale_bounds(bounds, scale);
                        if let Some((opacity, glow_scale, color)) = glow {
                            paint_glow(b, opacity, glow_scale, color, window);
                        }
                        if focus_ring {
                            paint_ring(b, t.ring, t.background, window);
                        }
                        paint_face(b, variant, &t, frame, h, window);
                        if let Some(x) = sweep {
                            window.with_content_mask(Some(ContentMask { bounds: b }), |w| {
                                paint_sweep(b, x, sweep_color, w);
                            });
                        }
                        paint_markers(b, marker_size, offset, markers, scale, marker_color, window);
                    },
                )
                .absolute()
                .top(px(-1.0))
                .left(px(-1.0))
                .right(px(-1.0))
                .bottom(px(-1.0)),
            )
            .child({
                let label: SharedString = self.label.to_uppercase().into();
                scaled_content(scale, move |s| {
                    tracked(&label, 12.0 * 0.22 * s)
                        .text_size(px(12.0 * s))
                        .line_height(px(16.0 * s))
                        .into_any_element()
                })
            });

        let button = wire(button, &state, &snapshot.focus, self.disabled);
        match self.on_click.filter(|_| !self.disabled) {
            Some(handler) => button.on_click(move |e, w, cx| handler(e, w, cx)),
            None => button,
        }
    }
}

struct Snapshot {
    frame: crate::surface::PressFrame,
    hover_colors: f32,
    marker_colors: f32,
    markers: f32,
    glow_opacity: f32,
    glow_scale: f32,
    sweep: Option<f32>,
    focus: FocusHandle,
    focus_ring: bool,
    animating: bool,
}

/// Letter-spaced text: CSS `tracking-*` adds the spacing after every glyph.
fn tracked(text: &str, spacing: f32) -> Div {
    div()
        .flex()
        .whitespace_nowrap()
        .children(text.chars().map(|c| {
            let c = if c == ' ' { '\u{a0}' } else { c };
            div().mr(px(spacing)).child(c.to_string())
        }))
}

fn mix(a: Hsla, b: Hsla, t: f32) -> Hsla {
    let (a, b) = (gpui::Rgba::from(a), gpui::Rgba::from(b));
    let l = |x: f32, y: f32| x + (y - x) * t;
    gpui::Rgba {
        r: l(a.r, b.r),
        g: l(a.g, b.g),
        b: l(a.b, b.b),
        a: l(a.a, b.a),
    }
    .into()
}

fn shadow(y: f32, blur: f32, spread: f32, color: Hsla, inset: bool) -> BoxShadow {
    BoxShadow {
        color,
        offset: point(px(0.0), px(y)),
        // GPUI's blur radius is the Gaussian sigma; CSS box-shadow blur is 2 sigma.
        blur_radius: px(blur / 2.0),
        spread_radius: px(spread),
        inset,
    }
}

fn paint_face(
    b: Bounds<Pixels>,
    variant: FrameButtonVariant,
    t: &Tokens,
    frame: crate::surface::PressFrame,
    hover: f32,
    window: &mut Window,
) {
    let square = Corners::all(px(0.0));
    let black = |a| rgb_a(0x000000, a);
    match variant {
        FrameButtonVariant::Default => {
            // Same graded surface as MinimalButton, with square corners.
            let mut unscaled = frame;
            unscaled.scale = 1.0;
            paint_graded_surface(b, unscaled, px(0.0), window);
        }
        FrameButtonVariant::Secondary | FrameButtonVariant::Outline => {
            let (drop, inset) = if t.dark {
                (
                    vec![shadow(1.0, 2.0, 0.0, black(0.4), false)],
                    shadow(1.0, 0.0, 0.0, rgb_a(0xffffff, 0.05), true),
                )
            } else {
                (
                    vec![
                        shadow(2.0, 6.0, -3.0, black(0.07), false),
                        shadow(1.0, 2.0, 0.0, black(0.05), false),
                    ],
                    shadow(-1.0, 0.0, 0.0, black(0.03), true),
                )
            };
            paint_outer_shadows(b, &drop, window);
            let (fill, border) = if variant == FrameButtonVariant::Secondary {
                (
                    mix(t.secondary, t.foreground, hover),
                    mix(t.border, t.foreground, hover),
                )
            } else {
                (
                    mix(transparent_black(), t.foreground.opacity(0.05), hover),
                    t.border,
                )
            };
            window.paint_quad(quad(b, square, fill, px(1.0), border, Default::default()));
            window.paint_inset_shadows(b, square, &[inset]);
        }
    }
}

/// Drop shadows clipped to outside the box, as CSS draws them: GPUI fills the
/// blurred shape under the box too, which would tint a transparent face.
fn paint_outer_shadows(b: Bounds<Pixels>, shadows: &[BoxShadow], window: &mut Window) {
    let m = px(64.0);
    let (l, t, r, btm) = (b.origin.x, b.origin.y, b.right(), b.bottom());
    let strips = [
        Bounds::from_corners(point(l - m, t - m), point(r + m, t)),
        Bounds::from_corners(point(l - m, btm), point(r + m, btm + m)),
        Bounds::from_corners(point(l - m, t), point(l, btm)),
        Bounds::from_corners(point(r, t), point(r + m, btm)),
    ];
    for strip in strips {
        window.with_content_mask(Some(ContentMask { bounds: strip }), |w| {
            w.paint_drop_shadows(b, Corners::all(px(0.0)), shadows);
        });
    }
}

/// `ring-2 ring-ring ring-offset-4 ring-offset-background`.
fn paint_ring(b: Bounds<Pixels>, ring: Hsla, offset: Hsla, window: &mut Window) {
    window.paint_drop_shadows(
        b,
        Corners::all(px(0.0)),
        &[
            shadow(0.0, 0.0, 6.0, ring, false),
            shadow(0.0, 0.0, 4.0, offset, false),
        ],
    );
}

/// `bg-foreground blur-2xl` behind the button, at `opacity` and `scale`.
fn paint_glow(b: Bounds<Pixels>, opacity: f32, scale: f32, color: Hsla, window: &mut Window) {
    if opacity <= 0.001 {
        return;
    }
    let glow = scale_bounds(b, scale.max(0.0));
    window.paint_drop_shadows(
        glow,
        Corners::all(px(0.0)),
        // `filter: blur(40px)` is a 40px sigma, i.e. an 80px box-shadow blur.
        &[shadow(0.0, 80.0, 0.0, color.opacity(opacity), false)],
    );
}

/// The `w-1/3 -skew-x-12` band, `transparent → current/15 → transparent`.
/// `x` is its translateX in band widths; the caller clips to the face.
fn paint_sweep(b: Bounds<Pixels>, x: f32, color: Hsla, window: &mut Window) {
    let width = b.size.width.as_f32() / 3.0;
    let height = b.size.height.as_f32();
    let left = b.origin.x.as_f32() + x * width;
    let top = b.origin.y.as_f32();
    // skewX(-12deg) about the centre: the top leans right, the bottom left.
    let lean = 12.0_f32.to_radians().tan() * height * 0.5;
    const STRIPS: usize = 14;
    for i in 0..STRIPS {
        let (t0, t1) = (i as f32 / STRIPS as f32, (i + 1) as f32 / STRIPS as f32);
        let mid = (t0 + t1) * 0.5;
        let alpha = 0.15 * (1.0 - (mid - 0.5).abs() * 2.0);
        let (x0, x1) = (left + width * t0, left + width * t1);
        let points: [Point<Pixels>; 4] = [
            point(px(x0 + lean), px(top)),
            point(px(x1 + lean), px(top)),
            point(px(x1 - lean), px(top + height)),
            point(px(x0 - lean), px(top + height)),
        ];
        let mut path = PathBuilder::fill();
        path.add_polygon(&points, true);
        if let Ok(path) = path.build() {
            window.paint_path(path, color.opacity(alpha));
        }
    }
}

/// Four L-shaped brackets, `1.5px` thick, `offset` outside each corner and
/// pushed out by `spread` (negative pulls them in).
fn paint_markers(
    b: Bounds<Pixels>,
    marker: f32,
    offset: f32,
    spread: f32,
    scale: f32,
    color: Hsla,
    window: &mut Window,
) {
    let side = marker * scale;
    let stroke = 1.5 * scale;
    let out = (offset + spread) * scale;
    let (l, t) = (b.origin.x.as_f32() - out, b.origin.y.as_f32() - out);
    let (r, btm) = (b.right().as_f32() + out, b.bottom().as_f32() + out);
    let rect =
        |x: f32, y: f32, w: f32, h: f32| Bounds::new(point(px(x), px(y)), size(px(w), px(h)));
    let corners = [
        (l, t, 1.0, 1.0),
        (r, t, -1.0, 1.0),
        (l, btm, 1.0, -1.0),
        (r, btm, -1.0, -1.0),
    ];
    for (cx, cy, sx, sy) in corners {
        // Horizontal arm then vertical arm, growing inward from the outer corner.
        let hx = if sx > 0.0 { cx } else { cx - side };
        let hy = if sy > 0.0 { cy } else { cy - stroke };
        // The vertical arm skips the corner square the horizontal one already covers.
        let vx = if sx > 0.0 { cx } else { cx - stroke };
        let vy = if sy > 0.0 { cy + stroke } else { cy - side };
        let arm_len = (side - stroke).max(0.0);
        for arm in [rect(hx, hy, side, stroke), rect(vx, vy, stroke, arm_len)] {
            window.paint_quad(quad(
                arm,
                Corners::all(px(0.0)),
                color,
                px(0.0),
                transparent_black(),
                Default::default(),
            ));
        }
    }
}
