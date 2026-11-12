//! The graded dark surface shared by Minimal, Hold and Copy, plus the CSS-like
//! press/hover transitions that drive it.
//!
//! GPUI has no CSS `transform` or `filter`, so the surface is painted on a
//! `canvas` layer: the press scale shrinks the painted rect (and its shadows)
//! around its centre, and `brightness()` multiplies the gradient colours.

use gpui::{
    Bounds, BoxShadow, Corners, Hsla, Pixels, Rgba, Window, linear_color_stop, linear_gradient,
    point, px, quad, transparent_black,
};

use crate::motion::{Duration, Easing, Instant, Transition};

/// Scale an Evil Buttons surface settles to while held.
pub const PRESS_SCALE: f32 = 0.97;

/// Press, hover and focus-visible state, transitioned like the Tailwind classes
/// `transition-[scale,filter,box-shadow] duration-300 ease-[cubic-bezier(.34,1.35,.64,1)]`
/// with `active:duration-100 active:ease-out`.
#[derive(Clone, Copy, Debug)]
pub(crate) struct PressMotion {
    scale: Transition,
    brightness: Transition,
    /// 0 = resting shadows, 1 = pressed ("settled") shadows.
    settle: Transition,
    pub hovered: bool,
    pub pressed: bool,
    /// Last interaction came from the keyboard, so focus should be drawn.
    pub focus_visible: bool,
    pub hover_brightness: f32,
    pub reduced_motion: bool,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct PressFrame {
    pub scale: f32,
    pub brightness: f32,
    pub settle: f32,
    pub animating: bool,
}

impl PressMotion {
    pub fn new() -> Self {
        Self {
            scale: Transition::new(1.0),
            brightness: Transition::new(1.0),
            settle: Transition::new(0.0),
            hovered: false,
            pressed: false,
            focus_visible: false,
            hover_brightness: 1.1,
            reduced_motion: false,
        }
    }

    pub fn frame(&self, now: Instant) -> PressFrame {
        PressFrame {
            scale: self.scale.value(now),
            brightness: self.brightness.value(now),
            settle: self.settle.value(now).clamp(0.0, 1.0),
            animating: self.scale.is_animating(now)
                || self.brightness.is_animating(now)
                || self.settle.is_animating(now),
        }
    }

    fn rest_brightness(&self) -> f32 {
        if self.hovered {
            self.hover_brightness
        } else {
            1.0
        }
    }

    pub fn set_hovered(&mut self, hovered: bool) -> bool {
        if self.hovered == hovered {
            return false;
        }
        self.hovered = hovered;
        if !self.pressed {
            self.brightness
                .animate_to(self.rest_brightness(), ms(300), Easing::SPRINGY);
        }
        true
    }

    pub fn press(&mut self) -> bool {
        if self.pressed {
            return false;
        }
        self.pressed = true;
        let fast = ms(100);
        if !self.reduced_motion {
            self.scale.animate_to(PRESS_SCALE, fast, Easing::EASE_OUT);
        }
        self.brightness.animate_to(0.95, fast, Easing::EASE_OUT);
        self.settle.animate_to(1.0, fast, Easing::EASE_OUT);
        true
    }

    pub fn release(&mut self) -> bool {
        if !self.pressed {
            return false;
        }
        self.pressed = false;
        let slow = ms(300);
        self.scale.animate_to(1.0, slow, Easing::SPRINGY);
        self.brightness
            .animate_to(self.rest_brightness(), slow, Easing::SPRINGY);
        self.settle.animate_to(0.0, slow, Easing::SPRINGY);
        true
    }
}

pub(crate) fn ms(millis: u64) -> Duration {
    Duration::from_millis(millis)
}

/// `rgb(r g b / a)` from a `0xRRGGBB` hex and an alpha.
pub(crate) fn rgb_a(hex: u32, alpha: f32) -> Hsla {
    let mut c = gpui::rgb(hex);
    c.a = alpha;
    c.into()
}

/// Multiplies a colour's RGB channels, like CSS `filter: brightness()`.
pub(crate) fn brighten(color: impl Into<Hsla>, amount: f32) -> Hsla {
    let mut c = Rgba::from(color.into());
    c.r = (c.r * amount).min(1.0);
    c.g = (c.g * amount).min(1.0);
    c.b = (c.b * amount).min(1.0);
    c.into()
}

fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

fn shadow(x: f32, y: f32, blur: f32, spread: f32, color: Hsla, inset: bool) -> BoxShadow {
    BoxShadow {
        color,
        offset: point(px(x), px(y)),
        // GPUI blurs with `blur_radius` as the Gaussian sigma; a CSS blur radius is 2 sigma.
        blur_radius: px(blur / 2.0),
        spread_radius: px(spread),
        inset,
    }
}

/// `bounds` scaled by `scale` around its centre.
pub(crate) fn scale_bounds(bounds: Bounds<Pixels>, scale: f32) -> Bounds<Pixels> {
    let w = bounds.size.width * scale;
    let h = bounds.size.height * scale;
    Bounds {
        origin: point(
            bounds.origin.x + (bounds.size.width - w) * 0.5,
            bounds.origin.y + (bounds.size.height - h) * 0.5,
        ),
        size: gpui::size(w, h),
    }
}

/// Focus ring: `ring-2 ring-offset-2`, drawn outside the surface.
pub(crate) fn paint_focus_ring(
    bounds: Bounds<Pixels>,
    radius: Pixels,
    ring: Hsla,
    offset_color: Hsla,
    window: &mut Window,
) {
    let radii = Corners::all(radius);
    window.paint_drop_shadows(
        bounds,
        radii,
        &[
            shadow(0.0, 0.0, 0.0, 4.0, ring, false),
            shadow(0.0, 0.0, 0.0, 2.0, offset_color, false),
        ],
    );
}

/// Paints the dark, graded Evil Buttons surface into `bounds`.
pub(crate) fn paint_graded_surface(
    bounds: Bounds<Pixels>,
    frame: PressFrame,
    radius: Pixels,
    window: &mut Window,
) {
    let bounds = scale_bounds(bounds, frame.scale);
    let radii = Corners::all(radius * frame.scale);
    let s = frame.settle;
    let black = |a: f32| rgb_a(0x000000, a);
    let white = |a: f32| rgb_a(0xffffff, a);

    // 0_0_0_1px_rgb(0_0_0/0.9), 0_1px_2px_rgb(0_0_0/0.25), 0_4px_12px_-4px_rgb(0_0_0/0.4)
    // settling to  ..., 0_0_1px_rgb(0_0_0/0.2), 0_1px_3px_-2px_rgb(0_0_0/0.3)
    window.paint_drop_shadows(
        bounds,
        radii,
        &[
            shadow(
                0.0,
                lerp(4.0, 1.0, s),
                lerp(12.0, 3.0, s),
                lerp(-4.0, -2.0, s),
                black(lerp(0.4, 0.3, s)),
                false,
            ),
            shadow(
                0.0,
                lerp(1.0, 0.0, s),
                lerp(2.0, 1.0, s),
                0.0,
                black(lerp(0.25, 0.2, s)),
                false,
            ),
            shadow(0.0, 0.0, 0.0, 1.0, black(0.9), false),
        ],
    );

    let b = frame.brightness;
    window.paint_quad(quad(
        bounds,
        radii,
        linear_gradient(
            180.0,
            linear_color_stop(brighten(gpui::rgb(0x353535), b), 0.0),
            linear_color_stop(brighten(gpui::rgb(0x272727), b), 1.0),
        ),
        px(0.0),
        transparent_black(),
        Default::default(),
    ));

    // inset_0_0_0_1px_rgb(255_255_255/0.06), inset_0_1px_0_rgb(255_255_255/0.14)
    window.paint_inset_shadows(
        bounds,
        radii,
        &[
            shadow(0.0, 0.0, 0.0, 1.0, white(lerp(0.06, 0.05, s)), true),
            shadow(0.0, 1.0, 0.0, 0.0, white(lerp(0.14, 0.08, s)), true),
        ],
    );
}

/// Text colour on the graded surface (`text-neutral-50`), with brightness applied.
pub(crate) fn surface_text(brightness: f32) -> Hsla {
    // CSS `filter: brightness()` dims the label too (0.95 while pressed).
    brighten(gpui::rgb(0xfafafa), brightness)
}

/// Press-scales a button's content the way CSS `scale()` would.
///
/// GPUI can't transform elements, so `content(1.0)` is laid out invisibly to
/// give the button its size, and `content(scale)` (label/icon sizes multiplied
/// by `scale`) is drawn centred on top. Keep `content` cheap: it runs twice.
pub(crate) fn scaled_content(scale: f32, content: impl Fn(f32) -> gpui::AnyElement) -> gpui::Div {
    use gpui::{ParentElement, Styled, div};
    div()
        .relative()
        .child(div().invisible().child(content(1.0)))
        .child(
            div()
                .absolute()
                .top_0()
                .left_0()
                .right_0()
                .bottom_0()
                .flex()
                .items_center()
                .justify_center()
                .child(content(scale)),
        )
}
