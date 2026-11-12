//! Shared hover / press / keyboard wiring for every button.

use gpui::{
    App, ClickEvent, Entity, FocusHandle, KeyDownEvent, KeyUpEvent, MouseButton,
    StatefulInteractiveElement, Styled, Window,
};
use std::rc::Rc;

/// Click handler shared by all buttons.
pub type ClickHandler = Rc<dyn Fn(&ClickEvent, &mut Window, &mut App) + 'static>;

/// Component state that reacts to pointer and keyboard presses.
pub(crate) trait Pressable: 'static {
    fn set_hovered(&mut self, hovered: bool) -> bool;
    /// `keyboard` is true when Space/Enter started the press.
    fn press(&mut self, keyboard: bool, window: &mut Window, cx: &mut App) -> bool;
    fn release(&mut self, window: &mut Window, cx: &mut App) -> bool;
}

pub(crate) fn is_activation_key(key: &str) -> bool {
    matches!(key, "enter" | "space" | " ")
}

/// Adds focus tracking, hover, mouse and Space/Enter press handling to `el`.
pub(crate) fn wire<E, S>(el: E, state: &Entity<S>, focus: &FocusHandle, disabled: bool) -> E
where
    E: StatefulInteractiveElement + Styled,
    S: Pressable,
{
    if disabled {
        return el;
    }
    let hover = state.clone();
    let down = state.clone();
    let up = state.clone();
    let up_out = state.clone();
    let key_down = state.clone();
    let key_up = state.clone();
    let focus_for_down = focus.clone();

    el.track_focus(focus)
        .cursor_pointer()
        .on_hover(move |hovered, _, cx| {
            hover.update(cx, |s, cx| {
                if s.set_hovered(*hovered) {
                    cx.notify();
                }
            });
        })
        .on_mouse_down(MouseButton::Left, move |_, window, cx| {
            window.focus(&focus_for_down, cx);
            down.update(cx, |s, cx| {
                if s.press(false, window, cx) {
                    cx.notify();
                }
            });
        })
        .on_mouse_up(MouseButton::Left, move |_, window, cx| {
            up.update(cx, |s, cx| {
                if s.release(window, cx) {
                    cx.notify();
                }
            });
        })
        .on_mouse_up_out(MouseButton::Left, move |_, window, cx| {
            up_out.update(cx, |s, cx| {
                if s.release(window, cx) {
                    cx.notify();
                }
            });
        })
        .on_key_down(move |event: &KeyDownEvent, window, cx| {
            if event.is_held || !is_activation_key(event.keystroke.key.as_str()) {
                return;
            }
            key_down.update(cx, |s, cx| {
                if s.press(true, window, cx) {
                    cx.notify();
                }
            });
        })
        .on_key_up(move |event: &KeyUpEvent, window, cx| {
            if !is_activation_key(event.keystroke.key.as_str()) {
                return;
            }
            key_up.update(cx, |s, cx| {
                if s.release(window, cx) {
                    cx.notify();
                }
            });
        })
}
