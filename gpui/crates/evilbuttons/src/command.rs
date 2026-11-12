//! CommandButton: a button with a window-wide keyboard shortcut, shown as
//! keycaps that sink as you hold each key.

use gpui::{
    AnyWindowHandle, App, AppContext, BoxShadow, ClickEvent, Context, ElementId, FocusHandle,
    FontWeight, InteractiveElement, IntoElement, KeystrokeEvent, Modifiers, ParentElement,
    RenderOnce, SharedString, StatefulInteractiveElement, Styled, Subscription, Task, Window,
    canvas, div, point, prelude::FluentBuilder, px,
};
use std::rc::Rc;

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Easing, Instant, Transition};
use crate::surface::{
    PressMotion, ms, paint_focus_ring, paint_graded_surface, rgb_a, scaled_content,
};

type CommandHandler = Rc<dyn Fn(&mut Window, &mut App)>;

/// How long a fired shortcut keeps every cap pressed.
const FIRE_MS: u64 = 160;
/// How often held modifiers are sampled, so each modifier cap sinks as it's pressed.
const MODIFIER_POLL_MS: u64 = 30;
/// A matching keystroke this soon after the last one, with the modifiers still
/// held, is the key auto-repeating rather than a new press.
const REPEAT_WINDOW_MS: u64 = 600;

/// A button with a keyboard shortcut that works anywhere in its window.
///
/// ```ignore
/// CommandButton::new("save")
///     .shortcut("mod+s")
///     .on_command(|_, _| save())
///     .on_click(|_, _, _| save())
/// ```
#[derive(IntoElement)]
pub struct CommandButton {
    id: ElementId,
    label: SharedString,
    shortcut: SharedString,
    prevent_default: bool,
    show_shortcut: bool,
    apple: Option<bool>,
    disabled: bool,
    on_click: Option<ClickHandler>,
    on_command: Option<CommandHandler>,
}

impl CommandButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: "Save".into(),
            shortcut: "mod+s".into(),
            prevent_default: true,
            show_shortcut: true,
            apple: None,
            disabled: false,
            on_click: None,
            on_command: None,
        }
    }

    /// The button label. Defaults to "Save".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Parts separated by `+`, like `"mod+s"`. Accepts `mod`, `ctrl`, `alt`,
    /// `shift`, named keys (`enter`, `esc`, `space`, arrows) and any single key.
    /// `mod` is ⌘ on Apple platforms and Ctrl elsewhere.
    pub fn shortcut(mut self, shortcut: impl Into<SharedString>) -> Self {
        self.shortcut = shortcut.into();
        self
    }

    /// Stop the keystroke from reaching the app's own key bindings (and, in the
    /// browser, the page's default handling, like the save dialog). Defaults to `true`.
    pub fn prevent_default(mut self, prevent: bool) -> Self {
        self.prevent_default = prevent;
        self
    }

    /// Show the shortcut as keycaps inside the button. Defaults to `true`.
    pub fn show_shortcut(mut self, show: bool) -> Self {
        self.show_shortcut = show;
        self
    }

    /// Show Apple key symbols (⌘ ⌥ ⇧) and treat `mod` as ⌘ for the held caps.
    /// Defaults to whether the app was built for macOS.
    pub fn apple(mut self, apple: bool) -> Self {
        self.apple = Some(apple);
        self
    }

    /// Disables the button and its shortcut.
    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired when the button is clicked. The keycaps press on click too.
    pub fn on_click(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(handler));
        self
    }

    /// Fired when the keyboard shortcut is pressed (once per press, not on repeat).
    pub fn on_command(mut self, handler: impl Fn(&mut Window, &mut App) + 'static) -> Self {
        self.on_command = Some(Rc::new(handler));
        self
    }
}

fn normalize_key(value: &str) -> String {
    let key = value.to_lowercase();
    match key.as_str() {
        "cmd" | "command" | "meta" | "platform" | "super" => "mod".into(),
        "control" => "ctrl".into(),
        "option" => "alt".into(),
        "escape" => "esc".into(),
        "return" => "enter".into(),
        " " | "spacebar" => "space".into(),
        "up" => "arrowup".into(),
        "down" => "arrowdown".into(),
        "left" => "arrowleft".into(),
        "right" => "arrowright".into(),
        _ => key,
    }
}

fn parse_shortcut(shortcut: &str) -> Vec<String> {
    shortcut
        .split('+')
        .map(|part| normalize_key(part.trim()))
        .filter(|part| !part.is_empty())
        .collect()
}

fn is_modifier(part: &str) -> bool {
    matches!(part, "mod" | "ctrl" | "alt" | "shift")
}

fn shortcut_matches(keystroke: &gpui::Keystroke, parts: &[String]) -> bool {
    let m = keystroke.modifiers;
    let has = |p: &str| parts.iter().any(|x| x == p);
    let wants_mod = has("mod");
    if wants_mod && !(m.platform || m.control) {
        return false;
    }
    if !wants_mod && has("ctrl") != m.control {
        return false;
    }
    if has("alt") != m.alt || has("shift") != m.shift {
        return false;
    }
    let Some(final_key) = parts.iter().find(|p| !is_modifier(p)) else {
        return false;
    };
    normalize_key(&keystroke.key) == *final_key
}

/// Whether a single shortcut part is physically held.
fn part_held(part: &str, m: Modifiers, apple: bool) -> bool {
    match part {
        "mod" => {
            if apple {
                m.platform
            } else {
                m.control
            }
        }
        "ctrl" => m.control,
        "alt" => m.alt,
        "shift" => m.shift,
        _ => false,
    }
}

fn format_part(part: &str, apple: bool) -> SharedString {
    let pick = |mac: &'static str, other: &'static str| if apple { mac } else { other };
    match part {
        "mod" => pick("⌘", "Ctrl").into(),
        "ctrl" => pick("⌃", "Ctrl").into(),
        "alt" => pick("⌥", "Alt").into(),
        "shift" => pick("⇧", "Shift").into(),
        "enter" => "↵".into(),
        "esc" => "Esc".into(),
        "space" => "Space".into(),
        "arrowup" => "↑".into(),
        "arrowdown" => "↓".into(),
        "arrowleft" => "←".into(),
        "arrowright" => "→".into(),
        _ if part.chars().count() == 1 => part.to_uppercase().into(),
        _ => SharedString::from(part.to_string()),
    }
}

struct CommandState {
    motion: PressMotion,
    pointer_pressed: bool,
    firing: bool,
    fire_task: Option<Task<()>>,
    /// Modifiers last sampled from the window.
    modifiers: Modifiers,
    /// Per-cap press (0 rest, 1 sunk), keyed by part.
    caps: Vec<(String, Transition)>,
    /// Set when the shortcut fires; auto-repeats are swallowed while set.
    latched: Option<(Modifiers, Instant)>,
    // Latest props, refreshed every render for the window-wide listeners.
    parts: Vec<String>,
    prevent_default: bool,
    disabled: bool,
    on_command: Option<CommandHandler>,
    focus: FocusHandle,
    _intercept: Subscription,
    _poll: Task<()>,
}

impl CommandState {
    fn fire(&mut self, cx: &mut Context<Self>) {
        self.firing = true;
        self.motion.press();
        self.fire_task = Some(cx.spawn(async move |this, cx| {
            cx.background_executor().timer(ms(FIRE_MS)).await;
            this.update(cx, |s, cx| {
                s.firing = false;
                if !s.pointer_pressed {
                    s.motion.release();
                }
                cx.notify();
            })
            .ok();
        }));
        cx.notify();
    }

    /// Handles a keystroke anywhere in the window. Returns the command handler if it fired.
    fn keystroke(
        &mut self,
        event: &KeystrokeEvent,
        cx: &mut Context<Self>,
    ) -> Option<Option<CommandHandler>> {
        if self.disabled || !shortcut_matches(&event.keystroke, &self.parts) {
            self.latched = None;
            return None;
        }
        let now = Instant::now();
        let modifiers = event.keystroke.modifiers;
        if let Some((held, last)) = self.latched
            && held == modifiers
            && now.saturating_duration_since(last) < ms(REPEAT_WINDOW_MS)
        {
            // Key repeat: keep swallowing it, but don't fire again.
            self.latched = Some((held, now));
            return Some(None);
        }
        self.latched = Some((modifiers, now));
        self.fire(cx);
        Some(self.on_command.clone())
    }

    fn sync_modifiers(&mut self, modifiers: Modifiers, cx: &mut Context<Self>) {
        if modifiers == self.modifiers {
            return;
        }
        self.modifiers = modifiers;
        if self.latched.is_some_and(|(held, _)| held != modifiers) {
            self.latched = None;
        }
        cx.notify();
    }
}

impl Pressable for CommandState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        self.motion.set_hovered(hovered)
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.motion.focus_visible = keyboard;
        self.pointer_pressed = true;
        self.motion.press();
        true
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        if !self.pointer_pressed {
            return false;
        }
        self.pointer_pressed = false;
        if !self.firing {
            self.motion.release();
        }
        true
    }
}

fn listen(window: &mut Window, cx: &mut Context<CommandState>) -> (Subscription, Task<()>) {
    let handle: AnyWindowHandle = window.window_handle();
    let weak = cx.weak_entity();
    let intercept = cx.intercept_keystrokes(move |event, window, cx| {
        if window.window_handle() != handle {
            return;
        }
        let Ok(Some(fired)) = weak.update(cx, |s, cx| {
            s.keystroke(event, cx).map(|f| (f, s.prevent_default))
        }) else {
            return;
        };
        let (handler, prevent_default) = fired;
        if prevent_default {
            cx.stop_propagation();
        }
        if let Some(handler) = handler {
            handler(window, cx);
        }
    });
    let poll = cx.spawn(async move |this, cx| {
        loop {
            cx.background_executor().timer(ms(MODIFIER_POLL_MS)).await;
            let Ok(modifiers) = cx.update_window(handle, |_, window, _| window.modifiers()) else {
                return;
            };
            if this
                .update(cx, |s, cx| s.sync_modifiers(modifiers, cx))
                .is_err()
            {
                return;
            }
        }
    });
    (intercept, poll)
}

impl RenderOnce for CommandButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state = window.use_keyed_state(
            self.id.clone(),
            cx,
            |window, cx: &mut Context<CommandState>| {
                let (intercept, poll) = listen(window, cx);
                CommandState {
                    motion: PressMotion::new(),
                    pointer_pressed: false,
                    firing: false,
                    fire_task: None,
                    modifiers: Modifiers::default(),
                    caps: Vec::new(),
                    latched: None,
                    parts: Vec::new(),
                    prevent_default: true,
                    disabled: false,
                    on_command: None,
                    focus: cx.focus_handle().tab_stop(true),
                    _intercept: intercept,
                    _poll: poll,
                }
            },
        );

        let apple = self.apple.unwrap_or(cfg!(target_os = "macos"));
        let parts = parse_shortcut(&self.shortcut);
        let now = Instant::now();
        let (frame, caps, focus, focus_visible, animating) = state.update(cx, |s, _| {
            s.parts = parts.clone();
            s.prevent_default = self.prevent_default;
            s.disabled = self.disabled;
            s.on_command = self.on_command.clone();
            if self.disabled {
                s.modifiers = Modifiers::default();
            }
            // Keep one transition per part, retargeted to its pressed state.
            let group_pressed = s.pointer_pressed || s.firing;
            let mut caps = Vec::with_capacity(parts.len());
            for part in &parts {
                let index = match s.caps.iter().position(|(p, _)| p == part) {
                    Some(i) => i,
                    None => {
                        s.caps.push((part.clone(), Transition::new(0.0)));
                        s.caps.len() - 1
                    }
                };
                let pressed = group_pressed || part_held(part, s.modifiers, apple);
                let t = &mut s.caps[index].1;
                if pressed {
                    t.animate_to(1.0, ms(100), Easing::EASE_OUT);
                } else {
                    t.animate_to(0.0, ms(300), Easing::SPRINGY);
                }
                caps.push((format_part(part, apple), t.value(now), t.is_animating(now)));
            }
            let frame = s.motion.frame(now);
            let animating = frame.animating || caps.iter().any(|c| c.2);
            (
                frame,
                caps,
                s.focus.clone(),
                (s.motion.focus_visible || window.last_input_was_keyboard())
                    && s.focus.is_focused(window),
                animating,
            )
        });
        if animating {
            window.request_animation_frame();
        }

        let radius = px(10.0);
        let text = filtered_text(frame.brightness);
        let (label, show_shortcut) = (self.label.clone(), self.show_shortcut);
        let button = div()
            .id(self.id.clone())
            .relative()
            .flex()
            .flex_none()
            .h(px(36.0))
            .pl(px(16.0))
            .pr(px(if self.show_shortcut { 8.0 } else { 16.0 }))
            .items_center()
            .justify_center()
            .font_weight(FontWeight::MEDIUM)
            .text_color(text)
            .whitespace_nowrap()
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
            .child(scaled_content(frame.scale, |s| {
                div()
                    .flex()
                    .items_center()
                    .gap(px(10.0 * s))
                    .text_size(px(14.0 * s))
                    .line_height(px(20.0 * s))
                    .child(label.clone())
                    .when(show_shortcut, |el| {
                        el.child(
                            div().flex().items_center().gap(px(2.0 * s)).children(
                                caps.iter()
                                    .map(|(label, v, _)| keycap(label.clone(), *v, s)),
                            ),
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

/// One keycap; `pressed` (0–1) sinks it 1px and lights it up.
fn keycap(label: SharedString, pressed: f32, s: f32) -> impl IntoElement {
    let mix = |a: f32, b: f32| a + (b - a) * pressed;
    div()
        .relative()
        .top(px(pressed * s))
        .flex()
        .h(px(20.0 * s))
        .min_w(px(20.0 * s))
        .px(px(4.0 * s))
        .items_center()
        .justify_center()
        .rounded(px(4.0 * s))
        .bg(rgb_a(0xffffff, mix(0.08, 0.20)))
        .shadow(vec![BoxShadow {
            color: rgb_a(0xffffff, 0.06),
            offset: point(px(0.0), px(0.0)),
            blur_radius: px(0.0),
            spread_radius: px(s),
            inset: true,
        }])
        .text_size(px(11.0 * s))
        .line_height(px(11.0 * s))
        .font_weight(FontWeight::MEDIUM)
        .text_color(rgb_a(0xfafafa, mix(0.55, 1.0)))
        .child(label)
}

/// `text-neutral-50` under the button's CSS `filter: brightness()`, which dims
/// the label too while pressed.
fn filtered_text(brightness: f32) -> gpui::Hsla {
    crate::surface::brighten(gpui::rgb(0xfafafa), brightness)
}

#[cfg(test)]
mod tests {
    use super::*;
    use gpui::Keystroke;

    fn stroke(key: &str, modifiers: Modifiers) -> Keystroke {
        Keystroke {
            modifiers,
            key: key.into(),
            key_char: None,
        }
    }

    #[test]
    fn parses_and_matches_shortcuts() {
        let parts = parse_shortcut("mod+shift+p");
        assert_eq!(parts, ["mod", "shift", "p"]);
        let ctrl_shift = Modifiers {
            control: true,
            shift: true,
            ..Default::default()
        };
        assert!(shortcut_matches(&stroke("p", ctrl_shift), &parts));
        let cmd_shift = Modifiers {
            platform: true,
            shift: true,
            ..Default::default()
        };
        assert!(shortcut_matches(&stroke("p", cmd_shift), &parts));
        assert!(!shortcut_matches(
            &stroke("p", Modifiers::control()),
            &parts
        ));

        let enter = parse_shortcut("mod+Enter");
        assert!(shortcut_matches(
            &stroke("enter", Modifiers::control()),
            &enter
        ));
        let esc = parse_shortcut("esc");
        assert!(shortcut_matches(
            &stroke("escape", Modifiers::default()),
            &esc
        ));
        assert_eq!(format_part("arrowup", false), "↑");
        assert_eq!(format_part("mod", true), "⌘");
        assert_eq!(format_part("mod", false), "Ctrl");
        assert_eq!(format_part("s", false), "S");
    }
}
