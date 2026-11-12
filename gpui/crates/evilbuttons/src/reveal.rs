//! RevealButton: hides a secret behind a mask until you hold (or toggle) it,
//! swapping the value with a quick lift and lighting the rim emerald.

use gpui::{
    App, Bounds, BoxShadow, ClickEvent, Context, Corners, ElementId, FocusHandle, FontWeight, Hsla,
    InteractiveElement, IntoElement, KeyDownEvent, KeyUpEvent, MouseButton, ParentElement,
    PathBuilder, PathStyle, Pixels, Point, RenderOnce, Rgba, SharedString,
    StatefulInteractiveElement, StrokeOptions, Styled, Subscription, Window, canvas, div,
    linear_color_stop, linear_gradient, point, prelude::FluentBuilder, px, quad, transparent_black,
};
use lyon::tessellation::{LineCap, LineJoin};
use std::rc::Rc;

use crate::interaction::is_activation_key;
use crate::motion::{Easing, Instant, Timeline, Transition};
use crate::surface::{brighten, ms, paint_focus_ring, rgb_a, scale_bounds, scaled_content};

type RevealHandler = Rc<dyn Fn(bool, &mut Window, &mut App)>;

/// How the secret is revealed.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum RevealButtonMode {
    /// Revealed only while pressed (pointer or Space/Enter).
    #[default]
    Hold,
    /// Each click flips between hidden and revealed.
    Toggle,
}

/// The graded surface style.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum RevealButtonVariant {
    #[default]
    Dark,
    Light,
}

/// A button that reveals a secret value while held, or on toggle.
///
/// ```ignore
/// RevealButton::new("api-key")
///     .secret("sk_live_abc123_xQ4z9")
///     .masked_value("sk_live_•••••••")
///     .on_reveal_change(|revealed, _, _| println!("{revealed}"))
/// ```
#[derive(IntoElement)]
pub struct RevealButton {
    id: ElementId,
    secret: SharedString,
    masked_value: SharedString,
    label: SharedString,
    hidden_label: SharedString,
    mode: RevealButtonMode,
    variant: RevealButtonVariant,
    value_font: Option<SharedString>,
    disabled: bool,
    on_reveal_change: Option<RevealHandler>,
}

impl RevealButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            secret: "sk_live_••••_9xQ4".into(),
            masked_value: "•••• •••• ••••".into(),
            label: "Reveal".into(),
            hidden_label: "Hidden".into(),
            mode: RevealButtonMode::Hold,
            variant: RevealButtonVariant::Dark,
            value_font: None,
            disabled: false,
            on_reveal_change: None,
        }
    }

    /// The real value shown when revealed.
    pub fn secret(mut self, secret: impl Into<SharedString>) -> Self {
        self.secret = secret.into();
        self
    }

    /// The placeholder shown while hidden. Defaults to "•••• •••• ••••".
    pub fn masked_value(mut self, masked: impl Into<SharedString>) -> Self {
        self.masked_value = masked.into();
        self
    }

    /// Small label above the value while revealed. Defaults to "Reveal".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Small label above the value while hidden. Defaults to "Hidden".
    pub fn hidden_label(mut self, label: impl Into<SharedString>) -> Self {
        self.hidden_label = label.into();
        self
    }

    /// Hold to reveal (default), or toggle on each click.
    pub fn mode(mut self, mode: RevealButtonMode) -> Self {
        self.mode = mode;
        self
    }

    /// Dark (default) or light graded surface.
    pub fn variant(mut self, variant: RevealButtonVariant) -> Self {
        self.variant = variant;
        self
    }

    /// Font family for the value, e.g. your monospace font.
    pub fn value_font(mut self, family: impl Into<SharedString>) -> Self {
        self.value_font = Some(family.into());
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired whenever the revealed state changes.
    pub fn on_reveal_change(
        mut self,
        handler: impl Fn(bool, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_reveal_change = Some(Rc::new(handler));
        self
    }
}

/// Colours for one surface variant.
struct Palette {
    top: u32,
    bottom: u32,
    label: u32,
    value: u32,
    chip_bg: Hsla,
    chip_text: u32,
    chip_text_revealed: u32,
    focus_offset: u32,
}

impl RevealButtonVariant {
    fn palette(self) -> Palette {
        match self {
            Self::Dark => Palette {
                top: 0x353535,
                bottom: 0x272727,
                label: 0xa3a3a3,
                value: 0xfafafa,
                chip_bg: rgb_a(0x000000, 0.25),
                chip_text: 0xa3a3a3,
                chip_text_revealed: 0x34d399,
                focus_offset: 0x0a0a0a,
            },
            Self::Light => Palette {
                top: 0xffffff,
                bottom: 0xf5f5f5,
                label: 0x737373,
                value: 0x171717,
                chip_bg: rgb_a(0xe5e5e5, 0.6),
                chip_text: 0x737373,
                chip_text_revealed: 0x059669,
                focus_offset: 0xffffff,
            },
        }
    }
}

struct RevealState {
    revealed: bool,
    /// What started a hold reveal, so only the matching release hides it.
    pointer_down: bool,
    key_down: bool,
    hovered: bool,
    focus_visible: bool,
    scale: Transition,
    brightness: Transition,
    /// Rim and glow tint, 0 hidden → 1 revealed (300ms springy).
    tint: Transition,
    /// Chip text colour, 0 hidden → 1 revealed (`transition-colors`, 150ms).
    chip: Transition,
    /// Value swap: the exiting value, then the entering one, 160ms each.
    swap: Option<(bool, Timeline)>,
    mode: RevealButtonMode,
    on_reveal_change: Option<RevealHandler>,
    focus: FocusHandle,
    _blur: Option<Subscription>,
}

impl RevealState {
    /// Sets the revealed state. Returns the change handler when it changed.
    fn set_revealed(&mut self, revealed: bool) -> Option<Option<RevealHandler>> {
        if self.revealed == revealed {
            return None;
        }
        let now = Instant::now();
        // Whatever is on screen right now exits first ("wait" mode).
        let showing = match self.swap {
            Some((from, t)) if !t.is_done(now) && t.progress(now) < 0.5 => from,
            _ => self.revealed,
        };
        self.revealed = revealed;
        self.swap = (showing != revealed).then(|| (showing, Timeline::start(ms(320))));
        let target = if revealed { 1.0 } else { 0.0 };
        self.tint.animate_to(target, ms(300), Easing::SPRINGY);
        self.chip.animate_to(target, ms(150), Easing::STANDARD);
        Some(self.on_reveal_change.clone())
    }

    fn rest_brightness(&self) -> f32 {
        if self.hovered { 1.1 } else { 1.0 }
    }

    fn press_visual(&mut self, pressed: bool) {
        if pressed {
            self.scale.animate_to(0.98, ms(100), Easing::EASE_OUT);
            self.brightness.animate_to(0.95, ms(100), Easing::EASE_OUT);
        } else {
            self.scale.animate_to(1.0, ms(300), Easing::SPRINGY);
            self.brightness
                .animate_to(self.rest_brightness(), ms(300), Easing::SPRINGY);
        }
    }
}

fn notify_change(
    change: Option<Option<RevealHandler>>,
    revealed: bool,
    window: &mut Window,
    cx: &mut App,
) {
    if let Some(Some(handler)) = change {
        handler(revealed, window, cx);
    }
}

/// Applies `f` to the state and reports any reveal change.
fn update_reveal(
    state: &gpui::Entity<RevealState>,
    window: &mut Window,
    cx: &mut App,
    f: impl FnOnce(&mut RevealState) -> Option<Option<RevealHandler>>,
) {
    let (change, revealed) = state.update(cx, |s, cx| {
        cx.notify();
        (f(s), s.revealed)
    });
    notify_change(change, revealed, window, cx);
}

impl RenderOnce for RevealButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state = window.use_keyed_state(
            self.id.clone(),
            cx,
            |window, cx: &mut Context<RevealState>| {
                let focus = cx.focus_handle().tab_stop(true);
                // In hold mode, blurring hides the secret again.
                let weak = cx.weak_entity();
                let blur = window.on_focus_out(&focus, cx, move |_, window, cx| {
                    let Some(state) = weak.upgrade() else {
                        return;
                    };
                    update_reveal(&state, window, cx, |s| {
                        s.key_down = false;
                        if s.mode == RevealButtonMode::Hold {
                            s.set_revealed(false)
                        } else {
                            None
                        }
                    });
                });
                RevealState {
                    revealed: false,
                    pointer_down: false,
                    key_down: false,
                    hovered: false,
                    focus_visible: false,
                    scale: Transition::new(1.0),
                    brightness: Transition::new(1.0),
                    tint: Transition::new(0.0),
                    chip: Transition::new(0.0),
                    swap: None,
                    mode: RevealButtonMode::Hold,
                    on_reveal_change: None,
                    focus,
                    _blur: Some(blur),
                }
            },
        );
        state.update(cx, |s, _| {
            s.mode = self.mode;
            s.on_reveal_change = self.on_reveal_change.clone();
        });

        let now = Instant::now();
        let s = state.read(cx);
        let revealed = s.revealed;
        let scale = s.scale.value(now);
        let brightness = s.brightness.value(now);
        let tint = s.tint.value(now).clamp(0.0, 1.0);
        let chip = s.chip.value(now).clamp(0.0, 1.0);
        let swap = s.swap.filter(|(_, t)| !t.is_done(now));
        let focus = s.focus.clone();
        let focus_visible =
            (s.focus_visible || window.last_input_was_keyboard()) && s.focus.is_focused(window);
        if s.scale.is_animating(now)
            || s.brightness.is_animating(now)
            || s.tint.is_animating(now)
            || s.chip.is_animating(now)
            || swap.is_some()
        {
            window.request_animation_frame();
        }

        // Which value shows, and its lift: exit y 0 → -6, then enter y 6 → 0.
        let (value_revealed, value_y, value_opacity) = match swap {
            Some((from, t)) => {
                let p = t.progress(now);
                if p < 0.5 {
                    let e = Easing::EASE_IN_OUT.apply(p * 2.0);
                    (from, -6.0 * e, 1.0 - e)
                } else {
                    let e = Easing::EASE_IN_OUT.apply(p * 2.0 - 1.0);
                    (!from, 6.0 * (1.0 - e), e)
                }
            }
            None => (revealed, 0.0, 1.0),
        };
        let value = if value_revealed {
            self.secret.clone()
        } else {
            self.masked_value.clone()
        };
        let label = if revealed {
            self.label.clone()
        } else {
            self.hidden_label.clone()
        };

        let variant = self.variant;
        let palette = variant.palette();
        let chip_text = brighten(
            mix(
                gpui::rgb(palette.chip_text).into(),
                gpui::rgb(palette.chip_text_revealed).into(),
                chip,
            ),
            brightness,
        );
        let radius = px(12.0);
        let focus_offset = palette.focus_offset;

        let value_font = self.value_font.clone();
        let label_text = SharedString::from(label.to_uppercase());
        // Everything inside the button scales with the press, like CSS `scale()`.
        let content = move |s: f32| {
            div()
                .flex()
                .min_w(px(224.0 * s))
                .gap(px(16.0 * s))
                .items_center()
                .justify_between()
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .items_start()
                        .min_w(px(0.0))
                        .child(
                            div()
                                .text_size(px(12.0 * s))
                                .line_height(px(16.0 * s))
                                .font_weight(FontWeight::MEDIUM)
                                .text_color(brighten(gpui::rgb(palette.label), brightness))
                                .whitespace_nowrap()
                                .child(tracked(&label_text, 12.0 * 0.05 * s)),
                        )
                        .child(
                            div()
                                .relative()
                                .top(px(value_y * s))
                                .opacity(value_opacity)
                                .max_w(px(176.0 * s))
                                .truncate()
                                .text_size(px(14.0 * s))
                                .line_height(px(20.0 * s))
                                .font_weight(FontWeight::SEMIBOLD)
                                .text_color(brighten(gpui::rgb(palette.value), brightness))
                                .when_some(value_font.clone(), |el, font| el.font_family(font))
                                .child(value.clone()),
                        ),
                )
                .child(
                    canvas(
                        |_, _, _| {},
                        move |bounds, _, window, _| {
                            paint_chip(bounds, variant, revealed, chip_text, brightness, window);
                        },
                    )
                    .size(px(36.0 * s))
                    .flex_none(),
                )
                .into_any_element()
        };

        let button = div()
            .id(self.id.clone())
            .relative()
            .flex()
            .flex_none()
            .px(px(16.0))
            .py(px(10.0))
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| {
                        let surface = scale_bounds(bounds, scale);
                        if focus_visible {
                            paint_focus_ring(
                                surface,
                                radius * scale,
                                rgb_a(0xa1a1a1, 1.0),
                                rgb_a(focus_offset, 1.0),
                                window,
                            );
                        }
                        paint_surface(surface, radius * scale, variant, tint, brightness, window);
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            .child(scaled_content(scale, content));

        if self.disabled {
            return button;
        }

        let hover = state.clone();
        let down = state.clone();
        let up = state.clone();
        let up_out = state.clone();
        let key_down = state.clone();
        let key_up = state.clone();
        let click = state.clone();
        let focus_for_down = focus.clone();
        let hold = self.mode == RevealButtonMode::Hold;
        button
            .track_focus(&focus)
            .cursor_pointer()
            .on_hover(move |hovered, window, cx| {
                let hovered = *hovered;
                update_reveal(&hover, window, cx, |s| {
                    s.hovered = hovered;
                    if !s.pointer_down && !s.key_down {
                        s.brightness
                            .animate_to(s.rest_brightness(), ms(300), Easing::SPRINGY);
                    }
                    // Hold mode: leaving the button hides it (pointerleave).
                    if !hovered && s.pointer_down {
                        s.pointer_down = false;
                        s.press_visual(false);
                        if hold {
                            return s.set_revealed(false);
                        }
                    }
                    None
                });
            })
            .on_mouse_down(MouseButton::Left, move |_, window, cx| {
                window.focus(&focus_for_down, cx);
                update_reveal(&down, window, cx, |s| {
                    s.focus_visible = false;
                    s.pointer_down = true;
                    s.press_visual(true);
                    if hold { s.set_revealed(true) } else { None }
                });
            })
            .on_mouse_up(MouseButton::Left, move |_, window, cx| {
                update_reveal(&up, window, cx, |s| {
                    s.pointer_down = false;
                    s.press_visual(false);
                    if hold { s.set_revealed(false) } else { None }
                });
            })
            .on_mouse_up_out(MouseButton::Left, move |_, window, cx| {
                update_reveal(&up_out, window, cx, |s| {
                    if !s.pointer_down {
                        return None;
                    }
                    s.pointer_down = false;
                    s.press_visual(false);
                    if hold { s.set_revealed(false) } else { None }
                });
            })
            .on_key_down(move |event: &KeyDownEvent, window, cx| {
                if !is_activation_key(event.keystroke.key.as_str()) {
                    return;
                }
                if hold {
                    cx.stop_propagation();
                }
                if event.is_held {
                    return;
                }
                update_reveal(&key_down, window, cx, |s| {
                    s.focus_visible = true;
                    s.key_down = true;
                    s.press_visual(true);
                    if hold { s.set_revealed(true) } else { None }
                });
            })
            .on_key_up(move |event: &KeyUpEvent, window, cx| {
                if !is_activation_key(event.keystroke.key.as_str()) {
                    return;
                }
                update_reveal(&key_up, window, cx, |s| {
                    s.key_down = false;
                    s.press_visual(false);
                    if hold { s.set_revealed(false) } else { None }
                });
            })
            .when(!hold, |el| {
                el.on_click(move |_: &ClickEvent, window, cx| {
                    update_reveal(&click, window, cx, |s| {
                        let next = !s.revealed;
                        s.set_revealed(next)
                    });
                })
            })
    }
}

fn mix(a: Hsla, b: Hsla, t: f32) -> Hsla {
    let (a, b) = (Rgba::from(a), Rgba::from(b));
    let l = |x: f32, y: f32| x + (y - x) * t;
    Rgba {
        r: l(a.r, b.r),
        g: l(a.g, b.g),
        b: l(a.b, b.b),
        a: l(a.a, b.a),
    }
    .into()
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

/// The graded surface; `tint` (0–1) swaps the neutral rim and glow for emerald.
fn paint_surface(
    bounds: Bounds<Pixels>,
    radius: Pixels,
    variant: RevealButtonVariant,
    tint: f32,
    brightness: f32,
    window: &mut Window,
) {
    let radii = Corners::all(radius);
    let palette = variant.palette();
    let (drops, insets) = match variant {
        RevealButtonVariant::Dark => (
            [
                shadow(
                    0.0,
                    4.0,
                    12.0,
                    -4.0,
                    mix(rgb_a(0x000000, 0.4), rgb_a(0x10b981, 0.35), tint),
                    false,
                ),
                shadow(0.0, 1.0, 2.0, 0.0, rgb_a(0x000000, 0.25), false),
                shadow(0.0, 0.0, 0.0, 1.0, rgb_a(0x000000, 0.9), false),
            ],
            vec![
                shadow(
                    0.0,
                    0.0,
                    0.0,
                    1.0,
                    mix(rgb_a(0xffffff, 0.06), rgb_a(0x34d399, 0.35), tint),
                    true,
                ),
                shadow(0.0, 1.0, 0.0, 0.0, rgb_a(0xffffff, 0.14), true),
            ],
        ),
        RevealButtonVariant::Light => (
            [
                shadow(
                    0.0,
                    4.0,
                    12.0,
                    -4.0,
                    mix(rgb_a(0x000000, 0.14), rgb_a(0x10b981, 0.3), tint),
                    false,
                ),
                shadow(0.0, 1.0, 2.0, 0.0, rgb_a(0x000000, 0.06), false),
                shadow(
                    0.0,
                    0.0,
                    0.0,
                    1.0,
                    mix(rgb_a(0x000000, 0.1), rgb_a(0x10b981, 0.45), tint),
                    false,
                ),
            ],
            vec![shadow(0.0, 1.0, 0.0, 0.0, rgb_a(0xffffff, 0.9), true)],
        ),
    };
    window.paint_drop_shadows(bounds, radii, &drops);
    window.paint_quad(quad(
        bounds,
        radii,
        linear_gradient(
            180.0,
            linear_color_stop(brighten(gpui::rgb(palette.top), brightness), 0.0),
            linear_color_stop(brighten(gpui::rgb(palette.bottom), brightness), 1.0),
        ),
        px(0.0),
        transparent_black(),
        Default::default(),
    ));
    window.paint_inset_shadows(bounds, radii, &insets);
}

/// The recessed eye chip: a sunken well with an inner shadow and a faint rim.
fn paint_chip(
    bounds: Bounds<Pixels>,
    variant: RevealButtonVariant,
    revealed: bool,
    icon: Hsla,
    brightness: f32,
    window: &mut Window,
) {
    let radii = Corners::all(bounds.size.width * 0.5);
    let palette = variant.palette();
    let (inset, rim) = match (variant, revealed) {
        (RevealButtonVariant::Dark, false) => (rgb_a(0x000000, 0.45), rgb_a(0xffffff, 0.07)),
        (RevealButtonVariant::Dark, true) => (rgb_a(0x000000, 0.45), rgb_a(0x34d399, 0.3)),
        (RevealButtonVariant::Light, false) => (rgb_a(0x000000, 0.12), rgb_a(0x000000, 0.06)),
        (RevealButtonVariant::Light, true) => (rgb_a(0x000000, 0.12), rgb_a(0x10b981, 0.35)),
    };
    // `0 0 0 1px` rim: a ring outside the chip (a drop shadow would show
    // through the translucent well, where CSS clips it away).
    let ring = bounds.dilate(px(1.0));
    window.paint_quad(quad(
        ring,
        Corners::all(ring.size.width * 0.5),
        transparent_black(),
        px(1.0),
        rim,
        Default::default(),
    ));
    window.paint_quad(quad(
        bounds,
        radii,
        // The button's `filter: brightness()` lifts the well too.
        brighten(palette.chip_bg, brightness),
        px(0.0),
        transparent_black(),
        Default::default(),
    ));
    window.paint_inset_shadows(bounds, radii, &[shadow(0.0, 1.0, 2.0, 0.0, inset, true)]);
    let icon_bounds = Bounds::centered_at(bounds.center(), gpui::size(px(16.0), px(16.0)));
    paint_eye(icon_bounds, revealed, icon, window);
}

/// Lucide `eye` / `eye-off` on a 24 grid, stroke 2.25.
fn paint_eye(bounds: Bounds<Pixels>, off: bool, color: Hsla, window: &mut Window) {
    let unit = bounds.size.width.as_f32() / 24.0;
    let stroke = 2.25 * unit;
    let options = StrokeOptions::default()
        .with_line_width(stroke)
        .with_line_cap(LineCap::Round)
        .with_line_join(LineJoin::Round);
    let mut b = PathBuilder::stroke(px(stroke)).with_style(PathStyle::Stroke(options));
    let p = |x: f32, y: f32| point(px(x), px(y));
    let arc = |b: &mut PathBuilder, r: f32, sweep: bool, to: Point<Pixels>| {
        b.arc_to(p(r, r), px(0.0), false, sweep, to);
    };
    if off {
        b.move_to(p(3.0, 3.0));
        b.line_to(p(21.0, 21.0));
        b.move_to(p(10.58, 10.58));
        arc(&mut b, 2.0, false, p(13.41, 13.41));
        b.move_to(p(9.88, 4.24));
        arc(&mut b, 10.94, true, p(12.0, 4.0));
        b.cubic_bezier_to(p(22.0, 12.0), p(19.0, 4.0), p(22.0, 12.0));
        arc(&mut b, 18.5, true, p(19.84, 15.19));
        b.move_to(p(6.61, 6.61));
        arc(&mut b, 18.7, false, p(2.0, 12.0));
        b.cubic_bezier_to(p(12.0, 20.0), p(2.0, 12.0), p(5.0, 20.0));
        arc(&mut b, 10.8, false, p(17.39, 18.39));
    } else {
        b.move_to(p(2.0, 12.0));
        b.cubic_bezier_to(p(12.0, 4.0), p(2.0, 12.0), p(5.0, 4.0));
        b.cubic_bezier_to(p(22.0, 12.0), p(19.0, 4.0), p(22.0, 12.0));
        b.cubic_bezier_to(p(12.0, 20.0), p(22.0, 12.0), p(19.0, 20.0));
        b.cubic_bezier_to(p(2.0, 12.0), p(5.0, 20.0), p(2.0, 12.0));
        b.close();
        b.move_to(p(15.0, 12.0));
        arc(&mut b, 3.0, true, p(9.0, 12.0));
        arc(&mut b, 3.0, true, p(15.0, 12.0));
        b.close();
    }
    b.translate(point(px(-12.0), px(-12.0)));
    b.scale(unit);
    b.translate(bounds.center());
    if let Ok(path) = b.build() {
        window.paint_path(path, color);
    }
}

/// Text with CSS `letter-spacing` (GPUI has none): one box per character.
fn tracked(text: &str, spacing: f32) -> gpui::Div {
    div().flex().children(text.chars().map(|c| {
        let c = if c == ' ' { '\u{00a0}' } else { c };
        div()
            .mr(px(spacing))
            .child(SharedString::from(c.to_string()))
    }))
}
