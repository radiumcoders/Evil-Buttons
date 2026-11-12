//! AquaButton: a glossy gel pill in the style of Apple's Aqua, with a bright
//! top highlight, a soft bottom glow and an inner shadow that deepens on press.

use gpui::{
    AnyElement, App, Bounds, BoxShadow, ClickEvent, ContentMask, Context, Corners, ElementId,
    FocusHandle, FontWeight, Hsla, InteractiveElement, IntoElement, ParentElement, Pixels,
    RenderOnce, SharedString, StatefulInteractiveElement, Styled, Window, WindowAppearance, canvas,
    div, linear_color_stop, linear_gradient, point, prelude::FluentBuilder, px, quad, size,
    transparent_black,
};
use std::rc::Rc;

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Easing, Instant, Transition};
use crate::surface::{ms, rgb_a, scaled_content};

type IconBuilder = Rc<dyn Fn(f32) -> AnyElement>;

/// The Aqua finish.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum AquaButtonVariant {
    /// Blue Aqua gel.
    #[default]
    Primary,
    /// Silver glass in light mode, smoked glass in dark mode.
    Secondary,
}

/// A glossy Aqua pill with layered highlights and a soft inner glow.
///
/// ```ignore
/// AquaButton::new("save", "Save").on_click(|_, _, _| save())
/// AquaButton::new("cancel", "Cancel").variant(AquaButtonVariant::Secondary)
/// ```
///
/// Everything is sized from a 16px `em`, like the original. An [`icon`](Self::icon)
/// renders after the label (pass an empty label for an icon-only button).
#[derive(IntoElement)]
pub struct AquaButton {
    id: ElementId,
    label: SharedString,
    variant: AquaButtonVariant,
    dark: Option<bool>,
    square: Option<Pixels>,
    radius: Option<Pixels>,
    font_family: Option<SharedString>,
    icon: Option<IconBuilder>,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl AquaButton {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            variant: AquaButtonVariant::Primary,
            dark: None,
            square: None,
            radius: None,
            font_family: None,
            icon: None,
            disabled: false,
            on_click: None,
        }
    }

    /// Blue gel (`Primary`, the default) or adaptive glass (`Secondary`).
    pub fn variant(mut self, variant: AquaButtonVariant) -> Self {
        self.variant = variant;
        self
    }

    /// Use the dark-mode palette for the secondary variant. Defaults to the
    /// window's appearance.
    pub fn dark(mut self, dark: bool) -> Self {
        self.dark = Some(dark);
        self
    }

    /// Make it a fixed square with no padding, for icon buttons.
    pub fn square(mut self, side: impl Into<Pixels>) -> Self {
        self.square = Some(side.into());
        self
    }

    /// Corner radius. Defaults to a full pill.
    pub fn radius(mut self, radius: impl Into<Pixels>) -> Self {
        self.radius = Some(radius.into());
        self
    }

    /// Content drawn after the label, e.g. an icon. The closure receives the
    /// press scale (multiply your sizes by it) and is called once for layout
    /// and once for painting. Paint with `window.text_style().color` to follow
    /// the label colour.
    pub fn icon(mut self, icon: impl Fn(f32) -> AnyElement + 'static) -> Self {
        self.icon = Some(Rc::new(icon));
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

/// `x y blur spread color`, numerically interpolable like CSS box-shadow.
#[derive(Clone, Copy, Debug)]
struct Shade {
    y: f32,
    blur: f32,
    spread: f32,
    color: Hsla,
}

const fn shade(y: f32, blur: f32, spread: f32, color: Hsla) -> Shade {
    Shade {
        y,
        blur,
        spread,
        color,
    }
}

impl Shade {
    fn fade(self, amount: f32) -> Shade {
        Shade {
            color: self.color.opacity(amount),
            ..self
        }
    }

    fn shadow(self, scale: f32, inset: bool) -> BoxShadow {
        BoxShadow {
            color: self.color,
            offset: point(px(0.0), px(self.y * scale)),
            // GPUI's blur radius is the Gaussian sigma; CSS box-shadow blur is 2 sigma.
            blur_radius: px(self.blur * scale / 2.0),
            spread_radius: px(self.spread * scale),
            inset,
        }
    }
}

/// One palette: every value of the original's `--aqua-*` custom properties.
struct Palette {
    /// `linear-gradient(top, mid 55%, bottom)`.
    bg: [u32; 3],
    text: Hsla,
    /// `text-shadow: 0 1px <blur> <color>`.
    text_shadow: Hsla,
    // The original sets `box-shadow` inline, which beats its own `hover:` and
    // `active:` shadow classes, so the live button keeps these at rest.
    drop: Shade,
    ring: Shade,
    inner: Shade,
    focus: [Shade; 3],
    top_highlight: (f32, f32),
    bottom_highlight: (f32, f32),
}

fn palette(variant: AquaButtonVariant, dark: bool) -> Palette {
    let black = |a| rgb_a(0x000000, a);
    let white = |a| rgb_a(0xffffff, a);
    match (variant, dark) {
        (AquaButtonVariant::Primary, _) => Palette {
            bg: [0x5fa0e6, 0x3273cd, 0x5fa0e6],
            text: rgb_a(0x141e37, 1.0),
            text_shadow: white(0.35),
            drop: shade(4.0, 6.0, 0.0, black(0.25)),
            ring: shade(0.0, 0.0, 1.0, rgb_a(0x001e5f, 0.55)),
            inner: shade(2.0, 4.0, 0.0, rgb_a(0x001450, 0.3)),
            focus: [
                shade(0.0, 0.0, 2.0, white(0.95)),
                shade(0.0, 0.0, 5.0, rgb_a(0x2896ff, 0.95)),
                shade(0.0, 20.0, 3.0, rgb_a(0x3caaff, 0.7)),
            ],
            top_highlight: (0.85, 0.25),
            bottom_highlight: (0.15, 0.5),
        },
        (AquaButtonVariant::Secondary, false) => Palette {
            bg: [0xe1e2e4, 0xf5f6f8, 0xe6e6e8],
            text: rgb_a(0x232328, 1.0),
            text_shadow: white(0.7),
            drop: shade(4.0, 6.0, 0.0, black(0.18)),
            ring: shade(0.0, 0.0, 1.0, rgb_a(0x787a82, 0.5)),
            inner: shade(2.0, 4.0, 0.0, black(0.15)),
            focus: [
                shade(0.0, 0.0, 2.0, white(0.95)),
                shade(0.0, 0.0, 5.0, rgb_a(0x2896ff, 0.95)),
                shade(0.0, 20.0, 3.0, rgb_a(0x3caaff, 0.55)),
            ],
            top_highlight: (0.85, 0.25),
            bottom_highlight: (0.15, 0.5),
        },
        (AquaButtonVariant::Secondary, true) => Palette {
            bg: [0x28282d, 0x16161c, 0x28282d],
            text: white(1.0),
            text_shadow: black(0.35),
            drop: shade(4.0, 6.0, 0.0, black(0.4)),
            ring: shade(0.0, 0.0, 1.0, white(0.08)),
            inner: shade(2.0, 4.0, 0.0, black(0.3)),
            focus: [
                shade(0.0, 0.0, 2.0, white(0.95)),
                shade(0.0, 0.0, 5.0, rgb_a(0x6478ff, 0.8)),
                shade(0.0, 20.0, 3.0, rgb_a(0x5064ff, 0.5)),
            ],
            top_highlight: (0.12, 0.03),
            bottom_highlight: (0.04, 0.08),
        },
    }
}

/// `cubic-bezier(0.4, 0, 0.2, 1)` over 320ms; presses land in 140ms.
const EASE: Easing = Easing::STANDARD;

struct AquaState {
    hover: Transition,
    press: Transition,
    focus_ring: Transition,
    focus_visible: bool,
    focus: FocusHandle,
}

impl Pressable for AquaState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        self.hover
            .animate_to(if hovered { 1.0 } else { 0.0 }, ms(320), EASE)
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.focus_visible = keyboard;
        self.press.animate_to(1.0, ms(140), EASE);
        true
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        self.press.animate_to(0.0, ms(320), EASE)
    }
}

impl RenderOnce for AquaButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<AquaState>| {
                AquaState {
                    hover: Transition::new(0.0),
                    press: Transition::new(0.0),
                    focus_ring: Transition::new(0.0),
                    focus_visible: false,
                    focus: cx.focus_handle().tab_stop(true),
                }
            });
        let focused = state.read(cx).focus.is_focused(window);
        let now = Instant::now();
        let (hover, press, ring, focus, animating) = state.update(cx, |s, _| {
            let ring_on = s.focus_visible && focused;
            s.focus_ring
                .animate_to(if ring_on { 1.0 } else { 0.0 }, ms(320), EASE);
            (
                s.hover.value(now),
                s.press.value(now),
                s.focus_ring.value(now),
                s.focus.clone(),
                s.hover.is_animating(now)
                    || s.press.is_animating(now)
                    || s.focus_ring.is_animating(now),
            )
        });
        if animating {
            window.request_animation_frame();
        }

        let dark = self.dark.unwrap_or(matches!(
            window.appearance(),
            WindowAppearance::Dark | WindowAppearance::VibrantDark
        ));
        let palette = palette(self.variant, dark);
        let text = palette.text;
        let text_shadow = palette.text_shadow;

        // `hover:-translate-y-px`, `focus-visible:-translate-y-px`, `active:translate-y-0 scale-[0.97]`.
        let lift = hover.max(ring) * (1.0 - press);
        let dy = -lift;
        let scale = 1.0 - 0.03 * press;
        // Highlights: scale-y 1 → 1.04 (hover/focus) → 0.82 (active); opacity .9 → 1 → .75.
        let engaged = lift;
        let top_scale_y = 1.0 + 0.04 * engaged - 0.18 * press;
        let top_opacity = 0.9 + 0.1 * engaged - 0.15 * press;
        let bottom_opacity = 0.7 + 0.2 * engaged - 0.3 * press;

        // Keyboard focus keeps the original's focus halo (`--aqua-shadow-focus`).
        let focus_shades = palette.focus.map(|s| s.fade(ring * (1.0 - press)));
        let (drop, ring_shade, inner) = (palette.drop, palette.ring, palette.inner);
        let (bg, top_hl, bottom_hl) = (palette.bg, palette.top_highlight, palette.bottom_highlight);
        let radius_override = self.radius;

        let label = (!self.label.is_empty()).then(|| self.label.clone());
        // GPUI sets 16px Geist on a 24px line 1px lower than browsers do (measured).
        let label_y = 0.5 * press + dy - if self.label.is_empty() { 0.0 } else { 1.0 };

        let mut button = div()
            .id(self.id)
            .relative()
            .flex()
            .flex_none()
            .items_center()
            .justify_center()
            .text_size(px(16.0))
            .line_height(px(24.0))
            .font_weight(FontWeight::MEDIUM)
            .text_color(text)
            .when_some(self.font_family, |el, family| el.font_family(family))
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed());
        button = match self.square {
            Some(side) => button.size(side),
            None => button.h(px(28.0)).min_w(px(96.0)).px(px(32.0)),
        };
        button = button.child(
            canvas(
                |_, _, _| {},
                move |bounds, _, window, _| {
                    let mut b = scale_around_center(bounds, scale);
                    b.origin.y += px(dy);
                    let h = b.size.height.as_f32();
                    let radius = radius_override
                        .map(|r| r * scale)
                        .unwrap_or(px(h * 0.5))
                        .min(px(h * 0.5));
                    let radii = Corners::all(radius);

                    // Outer shadows: focus halo and hover glow under the drop shadow.
                    let mut outer: Vec<BoxShadow> = focus_shades
                        .iter()
                        .rev()
                        .map(|s| s.shadow(scale, false))
                        .collect();
                    outer.push(drop.shadow(scale, false));
                    window.paint_drop_shadows(b, radii, &outer);

                    // Three-stop gel: top → mid at 55% → bottom, as two clipped halves.
                    let split = b.origin.y + b.size.height * 0.55;
                    let upper = Bounds::from_corners(
                        point(b.origin.x - px(1.0), b.origin.y - px(1.0)),
                        point(b.right() + px(1.0), split),
                    );
                    let lower = Bounds::from_corners(
                        point(b.origin.x - px(1.0), split),
                        point(b.right() + px(1.0), b.bottom() + px(1.0)),
                    );
                    let [c0, c1, c2] = bg.map(|c| rgb_a(c, 1.0));
                    for (mask, from, to) in [
                        (
                            upper,
                            linear_color_stop(c0, 0.0),
                            linear_color_stop(c1, 0.55),
                        ),
                        (
                            lower,
                            linear_color_stop(c1, 0.55),
                            linear_color_stop(c2, 1.0),
                        ),
                    ] {
                        window.with_content_mask(Some(ContentMask { bounds: mask }), |w| {
                            w.paint_quad(quad(
                                b,
                                radii,
                                linear_gradient(180.0, from, to),
                                px(0.0),
                                transparent_black(),
                                Default::default(),
                            ));
                        });
                    }

                    window.paint_inset_shadows(
                        b,
                        radii,
                        &[ring_shade.shadow(scale, true), inner.shadow(scale, true)],
                    );

                    let em = 16.0 * scale;
                    let w = b.size.width.as_f32();
                    // Bottom glow: bottom 8%, 28% tall, 1.25em narrower, blur(2px).
                    let bottom_h = h * 0.28;
                    let bottom = Bounds::new(
                        point(
                            b.origin.x + px(0.625 * em),
                            b.origin.y + px(h * 0.92 - bottom_h),
                        ),
                        size(px(w - 1.25 * em), px(bottom_h)),
                    );
                    paint_soft_glow(
                        bottom,
                        css_radii(bottom, 0.75 * em, 0.75 * em),
                        bottom_hl.0 * bottom_opacity,
                        bottom_hl.1 * bottom_opacity,
                        2.0 * scale,
                        window,
                    );
                },
            )
            .absolute()
            .top_0()
            .left_0()
            .size_full(),
        );

        let icon = self.icon.clone();
        button = button.child(div().relative().top(px(label_y)).child(scaled_content(
            scale,
            move |s| {
                let content = |color: Hsla| {
                    div()
                        .flex()
                        .items_center()
                        .gap(px(6.0 * s))
                        .text_size(px(16.0 * s))
                        .line_height(px(24.0 * s))
                        .text_color(color)
                        .whitespace_nowrap()
                        .when_some(label.clone(), |el, label| el.child(label))
                };
                div()
                    .relative()
                    // `text-shadow: 0 1px …`, as an offset copy behind the label.
                    .when(label.is_some(), |el| {
                        el.child(content(text_shadow).absolute().top(px(s)).left_0())
                    })
                    .child(
                        content(text)
                            .relative()
                            .when_some(icon.as_ref(), |el, icon| el.child(icon(s))),
                    )
                    .into_any_element()
            },
        )));

        // Top highlight (`z-[2]`): drawn over the label, which it slightly washes.
        button = button.child(
            canvas(
                |_, _, _| {},
                move |bounds, _, window, _| {
                    let mut b = scale_around_center(bounds, scale);
                    b.origin.y += px(dy);
                    let (w, h) = (b.size.width.as_f32(), b.size.height.as_f32());
                    let em = 16.0 * scale;
                    // top 6%, 42% tall, 0.625em narrower, origin-top scale-y.
                    let top = Bounds::new(
                        point(b.origin.x + px(0.3125 * em), b.origin.y + px(h * 0.06)),
                        size(px(w - 0.625 * em), px(h * 0.42 * top_scale_y)),
                    );
                    let radii = css_radii(top, 2.0 * em, 0.75 * em);
                    let (a0, a1) = (top_hl.0 * top_opacity, top_hl.1 * top_opacity);
                    window.paint_quad(quad(
                        top,
                        radii,
                        linear_gradient(
                            180.0,
                            linear_color_stop(rgb_a(0xffffff, a0), 0.0),
                            linear_color_stop(rgb_a(0xffffff, a1), 1.0),
                        ),
                        px(0.0),
                        transparent_black(),
                        Default::default(),
                    ));
                },
            )
            .absolute()
            .top_0()
            .left_0()
            .size_full(),
        );

        let button = wire(button, &state, &focus, self.disabled);
        match self.on_click.filter(|_| !self.disabled) {
            Some(handler) => button.on_click(move |e, w, cx| handler(e, w, cx)),
            None => button,
        }
    }
}

fn scale_around_center(bounds: Bounds<Pixels>, scale: f32) -> Bounds<Pixels> {
    let w = bounds.size.width * scale;
    let h = bounds.size.height * scale;
    Bounds::new(
        point(
            bounds.origin.x + (bounds.size.width - w) * 0.5,
            bounds.origin.y + (bounds.size.height - h) * 0.5,
        ),
        size(w, h),
    )
}

/// CSS `border-radius: top top bottom bottom`, shrunk proportionally (like
/// browsers do) when adjacent radii overflow the box.
fn css_radii(bounds: Bounds<Pixels>, top: f32, bottom: f32) -> Corners<Pixels> {
    let (w, h) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
    let f = (w / (2.0 * top))
        .min(w / (2.0 * bottom))
        .min(h / (top + bottom))
        .min(1.0);
    Corners {
        top_left: px(top * f),
        top_right: px(top * f),
        bottom_right: px(bottom * f),
        bottom_left: px(bottom * f),
    }
}

/// A vertical white gradient softened like `filter: blur(sigma)`: a blurred
/// copy of the shape at the top alpha, plus a blurred lower part carrying the
/// extra alpha toward the bottom. No clipping, so no seams.
fn paint_soft_glow(
    bounds: Bounds<Pixels>,
    radii: Corners<Pixels>,
    top_alpha: f32,
    bottom_alpha: f32,
    sigma: f32,
    window: &mut Window,
) {
    let soft = |color, blur: f32| BoxShadow {
        color,
        offset: point(px(0.0), px(0.0)),
        blur_radius: px(blur),
        spread_radius: px(0.0),
        inset: false,
    };
    window.paint_drop_shadows(bounds, radii, &[soft(rgb_a(0xffffff, top_alpha), sigma)]);
    let extra = (bottom_alpha - top_alpha).max(0.0);
    if extra > 0.0 {
        let h = bounds.size.height;
        let lower = Bounds::new(
            point(bounds.origin.x, bounds.origin.y + h * 0.4),
            size(bounds.size.width, h * 0.6),
        );
        // Combined with the first layer this reaches ~bottom_alpha at the bottom.
        let a = 0.8 * extra / (1.0 - top_alpha).max(0.01);
        window.paint_drop_shadows(lower, radii, &[soft(rgb_a(0xffffff, a), sigma * 1.5)]);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn css_radii_shrink_proportionally() {
        let b = Bounds::new(point(px(0.0), px(0.0)), size(px(100.0), px(11.0)));
        let r = css_radii(b, 32.0, 12.0);
        // 32 + 12 = 44 > 11, so both shrink by 11/44.
        assert!((r.top_left.as_f32() - 8.0).abs() < 1e-3);
        assert!((r.bottom_left.as_f32() - 3.0).abs() < 1e-3);
    }
}
