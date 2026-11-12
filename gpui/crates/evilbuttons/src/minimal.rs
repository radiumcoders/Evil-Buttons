//! MinimalButton: a quiet, graded dark button with a chevron that nudges forward on hover.

use gpui::{
    App, ClickEvent, Context, ElementId, FocusHandle, FontWeight, InteractiveElement, IntoElement,
    ParentElement, RenderOnce, SharedString, StatefulInteractiveElement, Styled, Window, canvas,
    div, prelude::FluentBuilder, px,
};
use std::rc::Rc;

use crate::icons::{Icon, paint_icon};
use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Easing, Instant, Transition};
use crate::surface::{
    PressMotion, ms, paint_focus_ring, paint_graded_surface, rgb_a, scaled_content, surface_text,
};

/// A quiet, graded dark button with a trailing chevron that nudges forward on hover.
///
/// ```ignore
/// MinimalButton::new("continue", "Continue").on_click(|_, _, _| println!("clicked"))
/// ```
#[derive(IntoElement)]
pub struct MinimalButton {
    id: ElementId,
    label: SharedString,
    arrow: bool,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl MinimalButton {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            arrow: true,
            disabled: false,
            on_click: None,
        }
    }

    /// Show a trailing chevron that nudges forward on hover. Defaults to `true`.
    pub fn arrow(mut self, arrow: bool) -> Self {
        self.arrow = arrow;
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

struct MinimalState {
    motion: PressMotion,
    /// 0 = resting chevron, 1 = hovered (nudged and brighter).
    arrow: Transition,
    focus: FocusHandle,
}

impl Pressable for MinimalState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        self.arrow
            .animate_to(if hovered { 1.0 } else { 0.0 }, ms(150), Easing::STANDARD);
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

impl RenderOnce for MinimalButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<MinimalState>| {
                MinimalState {
                    motion: PressMotion::new(),
                    arrow: Transition::new(0.0),
                    focus: cx.focus_handle().tab_stop(true),
                }
            });
        let now = Instant::now();
        let (frame, arrow, focus, focus_visible) = {
            let s = state.read(cx);
            (
                s.motion.frame(now),
                s.arrow.value(now),
                s.focus.clone(),
                (s.motion.focus_visible || window.last_input_was_keyboard())
                    && s.focus.is_focused(window),
            )
        };
        if frame.animating || state.read(cx).arrow.is_animating(now) {
            window.request_animation_frame();
        }

        let radius = px(10.0);
        let text = surface_text(frame.brightness);
        let arrow_color = rgb_a(0xfafafa, 0.45 + 0.30 * arrow);
        let (label, show_arrow) = (self.label.clone(), self.arrow);

        let button = div()
            .id(self.id)
            .relative()
            .flex()
            .flex_none()
            .h(px(36.0))
            .pl(px(16.0))
            .pr(px(if self.arrow { 12.0 } else { 16.0 }))
            .items_center()
            .justify_center()
            .font_weight(FontWeight::MEDIUM)
            .text_color(text)
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| {
                        if focus_visible {
                            paint_focus_ring(
                                bounds,
                                radius,
                                rgb_a(0xa1a1a1, 1.0),
                                rgb_a(0x0a0a0a, 1.0),
                                window,
                            );
                        }
                        paint_graded_surface(bounds, frame, radius, window);
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            .child(scaled_content(frame.scale, move |s| {
                div()
                    .flex()
                    .items_center()
                    .gap(px(8.0 * s))
                    .text_size(px(14.0 * s))
                    .line_height(px(20.0 * s))
                    .child(label.clone())
                    .when(show_arrow, |el| {
                        el.child(
                            canvas(
                                |_, _, _| {},
                                move |bounds, _, window, _| {
                                    let mut b = bounds;
                                    b.origin.x += px(2.0 * arrow * s);
                                    paint_icon(
                                        Icon::ChevronRight,
                                        b,
                                        1.75,
                                        1.0,
                                        arrow_color,
                                        window,
                                    );
                                },
                            )
                            .flex_none()
                            .size(px(14.0 * s)),
                        )
                    })
                    .into_any_element()
            }));

        let button = wire(button, &state, &focus, self.disabled);
        match self.on_click.filter(|_| !self.disabled) {
            Some(handler) => button.on_click(move |e, w, cx| handler(e, w, cx)),
            None => button,
        }
    }
}
