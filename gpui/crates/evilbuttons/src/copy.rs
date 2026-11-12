//! CopyButton: copies a value, springs the icon to a check, rolls the label to
//! "Copied", and floats the copied text in a chip above.

use gpui::{
    App, ClickEvent, ClipboardItem, Context, ElementId, FocusHandle, FontWeight, Hsla,
    InteractiveElement, IntoElement, ParentElement, RenderOnce, SharedString,
    StatefulInteractiveElement, Styled, Task, Window, canvas, div, prelude::FluentBuilder, px,
    relative,
};
use std::rc::Rc;

use crate::icons::{Icon, paint_icon};
use crate::interaction::{Pressable, wire};
use crate::motion::{Duration, Easing, Instant, Spring, SpringConfig, Transition};
use crate::surface::{
    PressMotion, ms, paint_focus_ring, paint_graded_surface, rgb_a, scaled_content, surface_text,
};

const SWAP: SpringConfig = SpringConfig::new(420.0, 30.0);

type CopyHandler = Rc<dyn Fn(&SharedString, &mut Window, &mut App)>;

/// Copies `value` to the clipboard with a springy icon swap and a value chip.
///
/// ```ignore
/// CopyButton::new("copy-install", "cargo add evilbuttons")
/// ```
#[derive(IntoElement)]
pub struct CopyButton {
    id: ElementId,
    value: SharedString,
    timeout: Duration,
    copy_label: SharedString,
    copied_label: SharedString,
    show_value: bool,
    value_font: Option<SharedString>,
    chip_colors: (Hsla, Hsla),
    disabled: bool,
    on_copy: Option<CopyHandler>,
}

impl CopyButton {
    pub fn new(id: impl Into<ElementId>, value: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            value: value.into(),
            timeout: ms(1500),
            copy_label: "Copy".into(),
            copied_label: "Copied".into(),
            show_value: true,
            value_font: None,
            chip_colors: (rgb_a(0xfafafa, 1.0), rgb_a(0x0a0a0a, 1.0)),
            disabled: false,
            on_copy: None,
        }
    }

    /// How long to show the copied state. Defaults to 1.5s.
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    pub fn copy_label(mut self, label: impl Into<SharedString>) -> Self {
        self.copy_label = label.into();
        self
    }

    pub fn copied_label(mut self, label: impl Into<SharedString>) -> Self {
        self.copied_label = label.into();
        self
    }

    /// Show the copied text in a small chip above the button. Defaults to `true`.
    pub fn show_value(mut self, show: bool) -> Self {
        self.show_value = show;
        self
    }

    /// Font family for the value chip, e.g. your monospace font.
    pub fn value_font(mut self, family: impl Into<SharedString>) -> Self {
        self.value_font = Some(family.into());
        self
    }

    /// Chip background and text colours. Defaults to near-white on near-black.
    pub fn chip_colors(mut self, background: impl Into<Hsla>, text: impl Into<Hsla>) -> Self {
        self.chip_colors = (background.into(), text.into());
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired with the copied text after writing it to the clipboard.
    pub fn on_copy(
        mut self,
        handler: impl Fn(&SharedString, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_copy = Some(Rc::new(handler));
        self
    }
}

struct CopyState {
    motion: PressMotion,
    copied: bool,
    /// Icon visibility springs (opacity, and scale 0.5 → 1).
    idle_icon: Spring,
    copied_icon: Spring,
    /// Label visibility (opacity, and y 6px → 0).
    idle_label: Transition,
    copied_label: Transition,
    /// Chip visibility; `chip_leaving` flips the exit direction.
    chip: Transition,
    chip_leaving: bool,
    task: Option<Task<()>>,
    focus: FocusHandle,
}

impl CopyState {
    fn set_copied(&mut self, copied: bool) {
        self.copied = copied;
        let (on, off) = if copied { (0.0, 1.0) } else { (1.0, 0.0) };
        self.idle_icon.set_target(on);
        self.copied_icon.set_target(off);
        self.idle_label.animate_to(on, ms(150), Easing::EASE_OUT);
        self.copied_label.animate_to(off, ms(150), Easing::EASE_OUT);
        self.chip_leaving = !copied;
        self.chip.animate_to(off, ms(150), Easing::EASE_OUT);
    }
}

impl Pressable for CopyState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
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

impl RenderOnce for CopyButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<CopyState>| {
                CopyState {
                    motion: PressMotion::new(),
                    copied: false,
                    idle_icon: Spring::new(1.0, SWAP),
                    copied_icon: Spring::new(0.0, SWAP),
                    idle_label: Transition::new(1.0),
                    copied_label: Transition::new(0.0),
                    chip: Transition::new(0.0),
                    chip_leaving: false,
                    task: None,
                    focus: cx.focus_handle().tab_stop(true),
                }
            });

        let now = Instant::now();
        let (
            frame,
            idle_icon,
            copied_icon,
            idle_label,
            copied_label,
            chip,
            chip_leaving,
            animating,
        ) = state.update(cx, |s, _| {
            let idle_icon = s.idle_icon.value(now);
            let copied_icon = s.copied_icon.value(now);
            let frame = s.motion.frame(now);
            let animating = frame.animating
                || !s.idle_icon.is_settled()
                || !s.copied_icon.is_settled()
                || s.idle_label.is_animating(now)
                || s.copied_label.is_animating(now)
                || s.chip.is_animating(now);
            (
                frame,
                idle_icon,
                copied_icon,
                s.idle_label.value(now),
                s.copied_label.value(now),
                s.chip.value(now),
                s.chip_leaving,
                animating,
            )
        });
        let (focus, focus_visible) = {
            let s = state.read(cx);
            (
                s.focus.clone(),
                (s.motion.focus_visible || window.last_input_was_keyboard())
                    && s.focus.is_focused(window),
            )
        };
        if animating {
            window.request_animation_frame();
        }

        let radius = px(10.0);
        let text = surface_text(frame.brightness);
        let (chip_bg, chip_fg) = self.chip_colors;
        let value = self.value.clone();

        // Stacked labels: every label lays out at the same spot (zero-height rows)
        // and is centred, so the widest one sets the width, shorter ones sit in
        // the middle (as in the React grid), and nothing reflows on swap.
        let (copy_text, copied_text) = (self.copy_label.clone(), self.copied_label.clone());
        let content = move |s: f32| {
            let label = |text: SharedString, visible: f32| {
                div()
                    .h(px(0.0))
                    .relative()
                    .top(px(6.0 * s * (1.0 - visible)))
                    .opacity(visible.clamp(0.0, 1.0))
                    .whitespace_nowrap()
                    .child(text)
            };
            div()
                .flex()
                .items_center()
                .gap(px(6.0 * s))
                .text_size(px(14.0 * s))
                .line_height(px(20.0 * s))
                // Icons crossfade in place.
                .child(
                    canvas(
                        |_, _, _| {},
                        move |bounds, _, window, _| {
                            let icon = |v: f32| v.clamp(0.0, 1.0);
                            paint_icon(
                                Icon::Copy,
                                bounds,
                                2.0,
                                0.5 + 0.5 * idle_icon,
                                text.opacity(icon(idle_icon)),
                                window,
                            );
                            paint_icon(
                                Icon::Check,
                                bounds,
                                2.0,
                                0.5 + 0.5 * copied_icon,
                                text.opacity(icon(copied_icon)),
                                window,
                            );
                        },
                    )
                    .size(px(16.0 * s))
                    .flex_none(),
                )
                .child(
                    div()
                        .h(px(20.0 * s))
                        .flex()
                        .flex_col()
                        .items_center()
                        .child(label(copy_text.clone(), idle_label))
                        .child(label(copied_text.clone(), copied_label)),
                )
                .into_any_element()
        };

        let button = div()
            .id(self.id)
            .relative()
            .flex()
            .flex_none()
            .h(px(36.0))
            .px(px(16.0))
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
            // Value chip, centred above the button.
            .when(self.show_value && chip > 0.001, |el| {
                let y = if chip_leaving {
                    -2.0 * (1.0 - chip)
                } else {
                    4.0 * (1.0 - chip)
                };
                el.child(
                    div()
                        .absolute()
                        .left(px(-240.0))
                        .right(px(-240.0))
                        .bottom(relative(1.0))
                        .pb(px(8.0))
                        .flex()
                        .justify_center()
                        .child(
                            div()
                                .relative()
                                .top(px(y))
                                .opacity(chip)
                                .max_w(px(224.0))
                                .truncate()
                                .rounded(px(6.0))
                                .bg(chip_bg)
                                .px(px(8.0))
                                .py(px(4.0))
                                .text_size(px(11.0))
                                .line_height(px(16.0))
                                .font_weight(FontWeight::NORMAL)
                                .text_color(chip_fg)
                                .when_some(self.value_font.clone(), |el, font| el.font_family(font))
                                .child(value.clone()),
                        ),
                )
            })
            .child(scaled_content(frame.scale, content));

        let button = wire(button, &state, &focus, self.disabled);
        if self.disabled {
            return button;
        }
        let timeout = self.timeout;
        let on_copy = self.on_copy.clone();
        let click_state = state.clone();
        button.on_click(move |_: &ClickEvent, window, cx| {
            cx.write_to_clipboard(ClipboardItem::new_string(value.to_string()));
            click_state.update(cx, |s, cx| {
                s.set_copied(true);
                s.task = Some(cx.spawn(async move |this, cx| {
                    cx.background_executor().timer(timeout).await;
                    this.update(cx, |s, cx| {
                        s.set_copied(false);
                        cx.notify();
                    })
                    .ok();
                }));
                cx.notify();
            });
            if let Some(on_copy) = on_copy.as_ref() {
                on_copy(&value, window, cx);
            }
        })
    }
}
