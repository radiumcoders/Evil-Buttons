//! ThreeDButton: a pill face sitting on a solid deck. Hover lifts the face and
//! slides a sheen in; pressing drops the face onto the deck and sweeps the
//! sheen across.

use gpui::{
    App, Bounds, BoxShadow, ClickEvent, ContentMask, Context, Corners, ElementId, FocusHandle,
    FontWeight, Hsla, InteractiveElement, IntoElement, ParentElement, Pixels, RenderOnce,
    SharedString, StatefulInteractiveElement, Styled, Window, canvas, div, linear_color_stop,
    linear_gradient, point, prelude::FluentBuilder, px, quad, transparent_black,
};
use std::rc::Rc;

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Instant, Spring, SpringConfig};
use crate::surface::{paint_focus_ring, rgb_a};

/// `{ type: "spring", stiffness: 620, damping: 32, mass: 0.5 }`.
const PRESS_SPRING: SpringConfig = SpringConfig {
    stiffness: 620.0,
    damping: 32.0,
    mass: 0.5,
};

/// `pb-1.5`: how far the deck shows below the face at rest.
const DECK_DEPTH: f32 = 6.0;

/// A pill-shaped 3D button: the face rides on a solid deck, lifts on hover and
/// drops flush on press while a sheen sweeps across it.
///
/// ```ignore
/// ThreeDButton::new("continue", "Continue")
///     .dark(cx.theme().is_dark())
///     .on_click(|_, _, _| println!("clicked"))
/// ```
#[derive(IntoElement)]
pub struct ThreeDButton {
    id: ElementId,
    label: SharedString,
    dark: bool,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl ThreeDButton {
    /// A light (zinc-50 on zinc-950) button. Use [`ThreeDButton::dark`] on dark pages.
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            dark: false,
            disabled: false,
            on_click: None,
        }
    }

    /// Use the dark-mode palette: a zinc-900 face with a white rim on a white deck.
    pub fn dark(mut self, dark: bool) -> Self {
        self.dark = dark;
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

/// One `motion` variant: every animated property of the button.
#[derive(Clone, Copy)]
struct Pose {
    deck_y: f32,
    face_y: f32,
    spot_opacity: f32,
    spot_scale_x: f32,
    /// Sheen offset, in sheen widths.
    sheen_x: f32,
    sheen_opacity: f32,
    label_y: f32,
}

const REST: Pose = Pose {
    deck_y: 0.0,
    face_y: 0.0,
    spot_opacity: 0.0,
    spot_scale_x: 0.25,
    sheen_x: -1.0,
    sheen_opacity: 0.0,
    label_y: 0.0,
};
const HOVER: Pose = Pose {
    deck_y: 1.0,
    face_y: -2.0,
    spot_opacity: 0.3,
    spot_scale_x: 0.45,
    sheen_x: -0.35,
    sheen_opacity: 0.75,
    label_y: -1.0,
};
const TAP: Pose = Pose {
    deck_y: -1.0,
    face_y: 6.0,
    spot_opacity: 1.0,
    spot_scale_x: 1.0,
    sheen_x: 0.82,
    sheen_opacity: 0.9,
    label_y: 1.0,
};

impl Pose {
    /// `REST + hover·(HOVER − REST) + tap·(TAP − REST)`. Every property shares one
    /// spring, so two weight springs reproduce `motion`'s per-property springs exactly.
    fn blend(hover: f32, tap: f32) -> Self {
        let mix = |r: f32, h: f32, t: f32| r + hover * (h - r) + tap * (t - r);
        Self {
            deck_y: mix(REST.deck_y, HOVER.deck_y, TAP.deck_y),
            face_y: mix(REST.face_y, HOVER.face_y, TAP.face_y),
            spot_opacity: mix(REST.spot_opacity, HOVER.spot_opacity, TAP.spot_opacity),
            spot_scale_x: mix(REST.spot_scale_x, HOVER.spot_scale_x, TAP.spot_scale_x),
            sheen_x: mix(REST.sheen_x, HOVER.sheen_x, TAP.sheen_x),
            sheen_opacity: mix(REST.sheen_opacity, HOVER.sheen_opacity, TAP.sheen_opacity),
            label_y: mix(REST.label_y, HOVER.label_y, TAP.label_y),
        }
    }
}

struct ThreeDState {
    /// Weight of the hover and tap variants (0–1 each, sprung).
    hover: Spring,
    tap: Spring,
    hovered: bool,
    pressed: bool,
    focus_visible: bool,
    focus: FocusHandle,
}

impl ThreeDState {
    fn retarget(&mut self) {
        // `whileTap` wins over `whileHover`.
        let (h, t) = match (self.pressed, self.hovered) {
            (true, _) => (0.0, 1.0),
            (false, true) => (1.0, 0.0),
            _ => (0.0, 0.0),
        };
        self.hover.set_target(h);
        self.tap.set_target(t);
    }
}

impl Pressable for ThreeDState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        if self.hovered == hovered {
            return false;
        }
        self.hovered = hovered;
        self.retarget();
        true
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.focus_visible = keyboard;
        if self.pressed {
            return false;
        }
        self.pressed = true;
        self.retarget();
        true
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        if !self.pressed {
            return false;
        }
        self.pressed = false;
        self.retarget();
        true
    }
}

#[derive(Clone, Copy)]
struct Palette {
    deck: Hsla,
    deck_shadow: Hsla,
    face: Hsla,
    text: Hsla,
    rim: Hsla,
    top_highlight: Hsla,
    bottom_shade: Hsla,
    spot: Hsla,
    /// Peak colour of the sheen gradient (`via-white` / `via-white/20`).
    sheen: Hsla,
    ring: Hsla,
    ring_offset: Hsla,
}

impl Palette {
    fn new(dark: bool) -> Self {
        if dark {
            Self {
                deck: rgb_a(0xffffff, 1.0),
                deck_shadow: rgb_a(0xffffff, 0.15),
                face: rgb_a(0x18181b, 1.0),
                text: rgb_a(0xffffff, 1.0),
                rim: rgb_a(0xffffff, 1.0),
                top_highlight: rgb_a(0xffffff, 0.15),
                bottom_shade: rgb_a(0x000000, 0.3),
                spot: rgb_a(0xffffff, 0.2),
                sheen: rgb_a(0xffffff, 0.2),
                ring: rgb_a(0xffffff, 1.0),
                ring_offset: rgb_a(0x0a0a0a, 1.0),
            }
        } else {
            Self {
                deck: rgb_a(0x09090b, 1.0),
                deck_shadow: rgb_a(0x18181b, 0.2),
                face: rgb_a(0xfafafa, 1.0),
                text: rgb_a(0x09090b, 1.0),
                rim: rgb_a(0xd4d4d8, 1.0),
                top_highlight: rgb_a(0xffffff, 0.9),
                bottom_shade: rgb_a(0x18181b, 0.06),
                spot: rgb_a(0x09090b, 0.1),
                sheen: rgb_a(0xffffff, 1.0),
                ring: rgb_a(0x71717a, 1.0),
                ring_offset: rgb_a(0xffffff, 1.0),
            }
        }
    }
}

impl RenderOnce for ThreeDButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<ThreeDState>| {
                ThreeDState {
                    hover: Spring::new(0.0, PRESS_SPRING),
                    tap: Spring::new(0.0, PRESS_SPRING),
                    hovered: false,
                    pressed: false,
                    focus_visible: false,
                    focus: cx.focus_handle().tab_stop(true),
                }
            });
        let now = Instant::now();
        let (pose, animating) = state.update(cx, |s, _| {
            let pose = Pose::blend(s.hover.value(now), s.tap.value(now));
            (pose, !s.hover.is_settled() || !s.tap.is_settled())
        });
        let (focus, focus_visible) = {
            let s = state.read(cx);
            (
                s.focus.clone(),
                (s.focus_visible || window.last_input_was_keyboard()) && s.focus.is_focused(window),
            )
        };
        if animating {
            window.request_animation_frame();
        }

        let palette = Palette::new(self.dark);
        let button = div()
            .id(self.id)
            .relative()
            .flex()
            .flex_none()
            .min_w(px(152.0))
            .pb(px(DECK_DEPTH))
            .text_size(px(14.0))
            .line_height(px(20.0))
            .font_weight(FontWeight::SEMIBOLD)
            .text_color(palette.text)
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| {
                        paint_button(bounds, pose, palette, focus_visible, window)
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
                    .top(px(pose.face_y + pose.label_y))
                    .w_full()
                    .flex()
                    .items_center()
                    .justify_center()
                    .px(px(28.0))
                    .py(px(12.0))
                    .whitespace_nowrap()
                    .child(self.label),
            );

        let button = wire(button, &state, &focus, self.disabled);
        match self.on_click.filter(|_| !self.disabled) {
            Some(handler) => button.on_click(move |e, w, cx| handler(e, w, cx)),
            None => button,
        }
    }
}

fn paint_button(
    bounds: Bounds<Pixels>,
    pose: Pose,
    palette: Palette,
    focus_visible: bool,
    window: &mut Window,
) {
    let full = bounds.size.height.as_f32() * 0.5;
    if focus_visible {
        paint_focus_ring(bounds, px(full), palette.ring, palette.ring_offset, window);
    }
    let face_h = bounds.size.height - px(DECK_DEPTH);
    let radius = face_h * 0.5;
    let radii = Corners::all(radius);

    // Deck: `inset-x-0 bottom-0 top-1.5`, with `0 10px 18px` drop shadow.
    let deck = Bounds {
        origin: point(
            bounds.origin.x,
            bounds.origin.y + px(DECK_DEPTH + pose.deck_y),
        ),
        size: gpui::size(bounds.size.width, face_h),
    };
    window.paint_drop_shadows(
        deck,
        radii,
        &[shadow(0.0, 10.0, 18.0, 0.0, palette.deck_shadow, false)],
    );
    window.paint_quad(quad(
        deck,
        radii,
        palette.deck,
        px(0.0),
        transparent_black(),
        Default::default(),
    ));

    // Face.
    let face = Bounds {
        origin: point(bounds.origin.x, bounds.origin.y + px(pose.face_y)),
        size: gpui::size(bounds.size.width, face_h),
    };
    window.paint_quad(quad(
        face,
        radii,
        palette.face,
        px(0.0),
        transparent_black(),
        Default::default(),
    ));

    window.with_content_mask(Some(ContentMask { bounds: face }), |window| {
        // Press spot: `inset-y-1 w-10 rounded-full blur-sm`, scaled on x.
        if pose.spot_opacity > 0.001 {
            let w = 40.0 * pose.spot_scale_x.max(0.0);
            let h = face_h.as_f32() - 8.0;
            let spot = Bounds {
                origin: point(face.center().x - px(w * 0.5), face.origin.y + px(4.0)),
                size: gpui::size(px(w), px(h)),
            };
            let color = palette.spot.opacity(pose.spot_opacity.clamp(0.0, 1.0));
            window.paint_drop_shadows(
                spot,
                Corners::all(px(w.min(h) * 0.5)),
                &[shadow(0.0, 0.0, 8.0, 0.0, color, false)],
            );
        }
        // Sheen: a half-width transparent → white → transparent band.
        if pose.sheen_opacity > 0.001 {
            paint_sheen(face, pose, palette.sheen, window);
        }
    });

    // Rim and bevel: inset ring, 2px top highlight, 2px bottom shade. CSS paints
    // the first shadow on top, so the ring goes last here.
    window.paint_inset_shadows(
        face,
        radii,
        &[
            shadow(0.0, -2.0, 0.0, 0.0, palette.bottom_shade, true),
            shadow(0.0, 2.0, 0.0, 0.0, palette.top_highlight, true),
            shadow(0.0, 0.0, 0.0, 1.0, palette.rim, true),
        ],
    );
}

/// Paints the sheen (a half-width transparent → peak → transparent band) as 1px
/// rows of gradient quads, each trimmed to the pill's span on that row so the
/// band is clipped to the rounded face like `overflow-hidden rounded-full`.
fn paint_sheen(face: Bounds<Pixels>, pose: Pose, peak: Hsla, window: &mut Window) {
    let (fx, fy) = (face.origin.x.as_f32(), face.origin.y.as_f32());
    let (fw, fh) = (face.size.width.as_f32(), face.size.height.as_f32());
    let r = fw.min(fh) * 0.5;
    let width = fw * 0.5;
    let left = fx + pose.sheen_x * width;
    let mid = left + width * 0.5;
    let right = left + width;
    let opacity = pose.sheen_opacity.clamp(0.0, 1.0);
    let alpha_at = |x: f32| (1.0 - ((x - mid).abs() / (width * 0.5))).clamp(0.0, 1.0) * opacity;
    let rows = fh.ceil() as usize;
    for row in 0..rows {
        let y0 = row as f32;
        let y1 = (y0 + 1.0).min(fh);
        // Pill span at the row's centre.
        let dy = ((y0 + y1) * 0.5 - fh * 0.5).abs();
        let half_chord = (r * r - dy * dy).max(0.0).sqrt();
        let (span_l, span_r) = (fx + r - half_chord, fx + fw - r + half_chord);
        for (x0, x1) in [(left, mid), (mid, right)] {
            let (a, b) = (x0.max(span_l), x1.min(span_r));
            if b - a <= 0.01 {
                continue;
            }
            window.paint_quad(quad(
                Bounds {
                    origin: point(px(a), px(fy + y0)),
                    size: gpui::size(px(b - a), px(y1 - y0)),
                },
                Corners::default(),
                linear_gradient(
                    90.0,
                    linear_color_stop(peak.opacity(alpha_at(a)), 0.0),
                    linear_color_stop(peak.opacity(alpha_at(b)), 1.0),
                ),
                px(0.0),
                transparent_black(),
                Default::default(),
            ));
        }
    }
}

/// CSS-style shadow: `blur` is the CSS blur radius (GPUI takes the sigma, half of it).
fn shadow(x: f32, y: f32, blur: f32, spread: f32, color: Hsla, inset: bool) -> BoxShadow {
    BoxShadow {
        color,
        offset: point(px(x), px(y)),
        blur_radius: px(blur * 0.5),
        spread_radius: px(spread),
        inset,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pose_blend_hits_each_variant() {
        let close = |a: f32, b: f32| (a - b).abs() < 1e-5;
        let tap = Pose::blend(0.0, 1.0);
        assert!(close(tap.face_y, TAP.face_y) && close(tap.sheen_x, TAP.sheen_x));
        let hover = Pose::blend(1.0, 0.0);
        assert!(close(hover.deck_y, HOVER.deck_y));
        assert!(close(Pose::blend(0.0, 0.0).spot_scale_x, REST.spot_scale_x));
    }
}
