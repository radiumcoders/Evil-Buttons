//! BrutalButton: a neo-brutalist slab with a hard offset shadow that lifts on
//! hover and slams flat on press.

use gpui::{
    App, ClickEvent, Context, Corners, ElementId, FocusHandle, FontWeight, Hsla,
    InteractiveElement, IntoElement, ParentElement, RenderOnce, SharedString,
    StatefulInteractiveElement, Styled, Window, canvas, div, point, prelude::FluentBuilder, px,
    quad,
};
use std::rc::Rc;

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Easing, Instant, Transition};
use crate::surface::{ms, paint_focus_ring, rgb_a, scale_bounds, scaled_content};

/// A neo-brutalist button with a hard offset shadow.
///
/// Hover lifts it up-left while the shadow grows; pressing slams it into the
/// shadow. Without a shadow it squashes to 95% instead.
#[derive(IntoElement)]
pub struct BrutalButton {
    id: ElementId,
    label: SharedString,
    color: Hsla,
    text_color: Hsla,
    border: Option<Hsla>,
    shadow: Option<Hsla>,
    radius: f32,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl BrutalButton {
    /// A white slab with black text, border and shadow.
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        let ink = rgb_a(0x0a0a0a, 1.0);
        Self {
            id: id.into(),
            label: label.into(),
            color: rgb_a(0xffffff, 1.0),
            text_color: ink,
            border: Some(ink),
            shadow: Some(ink),
            radius: 0.0,
            disabled: false,
            on_click: None,
        }
    }

    /// Background colour.
    pub fn color(mut self, color: impl Into<Hsla>) -> Self {
        self.color = color.into();
        self
    }

    pub fn text_color(mut self, color: impl Into<Hsla>) -> Self {
        self.text_color = color.into();
        self
    }

    /// 2px border colour; `None` removes the border.
    pub fn border(mut self, color: Option<Hsla>) -> Self {
        self.border = color;
        self
    }

    /// Hard shadow colour; `None` removes the shadow (press then squashes to 95%).
    pub fn shadow(mut self, color: Option<Hsla>) -> Self {
        self.shadow = color;
        self
    }

    /// Corner radius in pixels. Defaults to `0`.
    pub fn radius(mut self, radius: f32) -> Self {
        self.radius = radius;
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

struct BrutalState {
    /// Offset of the slab: 0 rest, -2 hovered (lifted), 4 pressed (slammed).
    lift: Transition,
    /// Squash used when there is no shadow: 1 rest, 0.95 pressed.
    scale: Transition,
    hovered: bool,
    pressed: bool,
    focus_visible: bool,
    focus: FocusHandle,
}

impl BrutalState {
    fn retarget(&mut self) -> bool {
        let lift = if self.pressed {
            4.0
        } else if self.hovered {
            -2.0
        } else {
            0.0
        };
        let scale = if self.pressed { 0.95 } else { 1.0 };
        let a = self.lift.animate_to(lift, ms(200), Easing::EASE_IN_OUT);
        let b = self.scale.animate_to(scale, ms(200), Easing::EASE_IN_OUT);
        a || b
    }
}

impl Pressable for BrutalState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        self.hovered = hovered;
        self.retarget()
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.focus_visible = keyboard;
        self.pressed = true;
        self.retarget()
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        self.pressed = false;
        self.retarget()
    }
}

impl RenderOnce for BrutalButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<BrutalState>| {
                BrutalState {
                    lift: Transition::new(0.0),
                    scale: Transition::new(1.0),
                    hovered: false,
                    pressed: false,
                    focus_visible: false,
                    focus: cx.focus_handle().tab_stop(true),
                }
            });
        let now = Instant::now();
        let (lift, scale, focus, focus_visible, animating) = {
            let s = state.read(cx);
            (
                s.lift.value(now),
                s.scale.value(now),
                s.focus.clone(),
                (s.focus_visible || window.last_input_was_keyboard()) && s.focus.is_focused(window),
                s.lift.is_animating(now) || s.scale.is_animating(now),
            )
        };
        if animating {
            window.request_animation_frame();
        }

        let has_shadow = self.shadow.is_some();
        // With a shadow the slab travels; without one it squashes instead.
        let (offset, scale) = if has_shadow {
            (lift, 1.0)
        } else {
            (0.0, scale)
        };
        let shadow_size = (4.0 - lift).max(0.0);
        let label = self.label.clone();
        let (color, border, shadow, radius) =
            (self.color, self.border, self.shadow, px(self.radius));

        let button = div()
            .id(self.id)
            .relative()
            .flex()
            .flex_none()
            .items_center()
            .justify_center()
            .px(px(24.0))
            .py(px(12.0))
            .font_weight(FontWeight::BOLD)
            .text_color(self.text_color)
            // Reserve the border's 2px in layout; the canvas paints it.
            .when(border.is_some(), |el| {
                el.border_2().border_color(gpui::transparent_black())
            })
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| {
                        let mut slab = scale_bounds(bounds, scale);
                        slab.origin += point(px(offset), px(offset));
                        let radii = Corners::all(radius);
                        if focus_visible {
                            paint_focus_ring(
                                slab,
                                radius,
                                rgb_a(0xa1a1a1, 1.0),
                                rgb_a(0x0a0a0a, 1.0),
                                window,
                            );
                        }
                        if let Some(shadow) = shadow.filter(|_| shadow_size > 0.0) {
                            let mut drop = slab;
                            drop.origin += point(px(shadow_size), px(shadow_size));
                            window.paint_quad(quad(
                                drop,
                                radii,
                                shadow,
                                px(0.0),
                                shadow,
                                Default::default(),
                            ));
                        }
                        let border_width = if border.is_some() { px(2.0) } else { px(0.0) };
                        window.paint_quad(quad(
                            slab,
                            radii,
                            color,
                            border_width,
                            border.unwrap_or(color),
                            Default::default(),
                        ));
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
                    .left(px(offset))
                    .top(px(offset))
                    .child(scaled_content(scale, move |s| {
                        div()
                            .text_size(px(16.0 * s))
                            .line_height(px(24.0 * s))
                            .child(label.clone())
                            .into_any_element()
                    })),
            );

        let button = wire(button, &state, &focus, self.disabled);
        match self.on_click.filter(|_| !self.disabled) {
            Some(handler) => button.on_click(move |e, w, cx| handler(e, w, cx)),
            None => button,
        }
    }
}
