//! EvilEyeButton: an obsidian pill with a burning evil eye behind its label
//! that tracks the cursor across the window, focuses on hover, and blinks.
//!
//! The original renders the eye with a WebGL fragment shader (React Bits'
//! `EvilEye`). GPUI has no custom shaders, so the same shader maths runs on the
//! CPU over a coarse grid every frame and is painted as small quads, sampling
//! the same tileable value-noise texture the original uploads.

use gpui::{
    App, Bounds, BoxShadow, ClickEvent, Context, Corners, DispatchPhase, Div, ElementId,
    FocusHandle, FontWeight, Hsla, InteractiveElement, IntoElement, MouseMoveEvent, ParentElement,
    PathBuilder, Pixels, Point, RenderOnce, Rgba, SharedString, StatefulInteractiveElement, Styled,
    Window, canvas, div, linear_color_stop, linear_gradient, point, prelude::FluentBuilder, px,
    quad, size, transparent_black,
};
use std::rc::Rc;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicU32, Ordering};

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Duration, Easing, Instant, Timeline, Transition};
use crate::surface::{ms, paint_focus_ring, rgb_a, scaled_content};

/// The face colour; the eye is painted over it so the socket blends in.
const FACE: u32 = 0x0c0706;
/// `cubic-bezier(0.34, 1.4, 0.64, 1)`.
const SPRINGY: Easing = Easing::CubicBezier(0.34, 1.4, 0.64, 1.0);
/// Horizontal px between shader vertices, and vertical samples per vertex
/// (one sample per CSS pixel, like the original at 1x).
const STEP_X: f32 = 1.0;
const ROW_H: f32 = 2.0;
const SUPERSAMPLE: usize = 2;

/// An obsidian pill with a burning evil eye behind its label.
///
/// ```ignore
/// EvilEyeButton::new("watcher").eye_color(gpui::rgb(0x38bdf8))
/// ```
#[derive(IntoElement)]
pub struct EvilEyeButton {
    id: ElementId,
    label: SharedString,
    eye: EyeParams,
    blink: bool,
    font_family: Option<SharedString>,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

#[derive(Clone, Copy, Debug)]
struct EyeParams {
    color: [f32; 3],
    intensity: f32,
    pupil_size: f32,
    iris_width: f32,
    glow: f32,
    scale: f32,
    noise_scale: f32,
    pupil_follow: f32,
    flame_speed: f32,
}

impl EvilEyeButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: "I see you".into(),
            eye: EyeParams {
                color: rgb3(gpui::rgb(0xff6f37).into()),
                intensity: 1.3,
                pupil_size: 0.62,
                iris_width: 0.22,
                glow: 0.5,
                scale: 1.7,
                noise_scale: 0.8,
                pupil_follow: 0.8,
                flame_speed: 0.8,
            },
            blink: true,
            font_family: None,
            disabled: false,
            on_click: None,
        }
    }

    /// Label, shown uppercase. Defaults to "I see you".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Iris, glow and hairline colour. Defaults to `#ff6f37`.
    pub fn eye_color(mut self, color: impl Into<Hsla>) -> Self {
        self.eye.color = rgb3(color.into());
        self
    }

    /// Brightness of the flames. Defaults to `1.3`.
    pub fn intensity(mut self, intensity: f32) -> Self {
        self.eye.intensity = intensity;
        self
    }

    /// Size of the slit pupil; lower is tighter. Defaults to `0.62`.
    pub fn pupil_size(mut self, size: f32) -> Self {
        self.eye.pupil_size = size;
        self
    }

    /// Width of the iris ring. Defaults to `0.22`.
    pub fn iris_width(mut self, width: f32) -> Self {
        self.eye.iris_width = width;
        self
    }

    /// Strength of the glow around the iris. Defaults to `0.5`.
    pub fn glow_intensity(mut self, glow: f32) -> Self {
        self.eye.glow = glow;
        self
    }

    /// Size of the eye in the button; higher spreads the flames wider. Defaults to `1.7`.
    pub fn scale(mut self, scale: f32) -> Self {
        self.eye.scale = scale;
        self
    }

    /// Scale of the flame noise. Defaults to `0.8`.
    pub fn noise_scale(mut self, scale: f32) -> Self {
        self.eye.noise_scale = scale;
        self
    }

    /// How far the pupil tracks the cursor, 0 to 1. Defaults to `0.8`.
    pub fn pupil_follow(mut self, follow: f32) -> Self {
        self.eye.pupil_follow = follow;
        self
    }

    /// Speed of the flames. Defaults to `0.8`.
    pub fn flame_speed(mut self, speed: f32) -> Self {
        self.eye.flame_speed = speed;
        self
    }

    /// Blink every few seconds on its own (it always blinks on press). Defaults to `true`.
    pub fn blink(mut self, blink: bool) -> Self {
        self.blink = blink;
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

struct EyeState {
    /// Flame clock (seconds, already multiplied by the flame speed).
    time: f32,
    last: Option<Instant>,
    /// Hover focus, eased toward `focus_target` (`dt * 7`).
    focus_amount: f32,
    focus_target: f32,
    /// Pupil offset, eased toward `look_target` (`dt * 6`).
    look: (f32, f32),
    look_target: (f32, f32),
    hover: Transition,
    press: Transition,
    pressed: bool,
    blink: Option<Timeline>,
    next_blink: Instant,
    rng: u32,
    focus_visible: bool,
    focus: FocusHandle,
}

impl EyeState {
    fn random(&mut self) -> f32 {
        let mut x = self.rng;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.rng = x;
        (x >> 8) as f32 / (1u32 << 24) as f32
    }

    fn schedule_blink(&mut self, now: Instant) {
        let delay = 2800.0 + self.random() * 4200.0;
        self.next_blink = now + Duration::from_millis(delay as u64);
    }

    /// Advances the eye's clocks to `now`, like the original's rAF loop.
    fn tick(&mut self, now: Instant, eye: &EyeParams, blink: bool) {
        let dt = self
            .last
            .map_or(0.0, |last| {
                now.saturating_duration_since(last).as_secs_f32()
            })
            .min(0.05);
        self.last = Some(now);
        self.time += dt * eye.flame_speed;
        self.focus_amount += (self.focus_target - self.focus_amount) * (dt * 7.0).min(1.0);
        let k = (dt * 6.0).min(1.0);
        self.look.0 += (self.look_target.0 - self.look.0) * k;
        self.look.1 += (self.look_target.1 - self.look.1) * k;
        if blink && now >= self.next_blink {
            self.blink = Some(Timeline::start(ms(200)));
            self.schedule_blink(now);
        }
    }
}

impl Pressable for EyeState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        self.focus_target = if hovered { 1.0 } else { 0.0 };
        self.hover
            .animate_to(if hovered { 1.0 } else { 0.0 }, ms(300), SPRINGY);
        true
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.focus_visible = keyboard;
        self.pressed = true;
        self.press.animate_to(1.0, ms(100), Easing::EASE_OUT)
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        self.pressed = false;
        self.press.animate_to(0.0, ms(300), SPRINGY)
    }
}

static SEED: AtomicU32 = AtomicU32::new(0x2545_f491);

impl RenderOnce for EvilEyeButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state = window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<EyeState>| {
            let now = Instant::now();
            let seed = SEED.fetch_add(0x9e37_79b9, Ordering::Relaxed)
                ^ web_time::SystemTime::now()
                    .duration_since(web_time::UNIX_EPOCH)
                    .map_or(0, |d| d.subsec_nanos());
            let mut state = EyeState {
                time: 0.0,
                last: None,
                focus_amount: 0.0,
                focus_target: 0.0,
                look: (0.0, 0.0),
                look_target: (0.0, 0.0),
                hover: Transition::new(0.0),
                press: Transition::new(0.0),
                pressed: false,
                blink: None,
                next_blink: now,
                rng: seed | 1,
                focus_visible: false,
                focus: cx.focus_handle().tab_stop(true),
            };
            state.schedule_blink(now);
            state
        });
        let eye = self.eye;
        let blink = self.blink;
        let now = Instant::now();
        let (time, focus_amount, look, hover, press, lids, focus, focus_visible) =
            state.update(cx, |s, _| {
                s.tick(now, &eye, blink);
                let lids = s
                    .blink
                    .filter(|t| !t.is_done(now))
                    .map_or(0.0, |t| lid_closure(t.progress(now)));
                (
                    s.time,
                    s.focus_amount,
                    s.look,
                    s.hover.value(now),
                    s.press.value(now),
                    lids,
                    s.focus.clone(),
                    (s.focus_visible || window.last_input_was_keyboard())
                        && s.focus.is_focused(window),
                )
            });
        // The flames never stop.
        window.request_animation_frame();

        let scale = 1.0 - 0.03 * press;
        let eye_hsla = from_rgb3(eye.color);
        let hairline = mix_oklab(
            eye.color,
            [0.0; 3],
            1.0 - (0.3 + 0.3 * hover.clamp(0.0, 1.0)),
        );
        let glow_shadow = eye_hsla.opacity(0.5);
        let frame = Frame {
            eye,
            time,
            focus: focus_amount,
            look,
            hover,
            lids,
            hairline,
            glow_shadow,
        };

        let watcher = state.clone();
        let label = self.label.to_uppercase();
        let text_glow = eye_hsla.opacity(0.55);

        let button = div()
            .id(self.id)
            .relative()
            .flex()
            .flex_none()
            .h(px(56.0))
            .min_w(px(224.0))
            .px(px(40.0))
            .items_center()
            .justify_center()
            .text_size(px(14.0))
            .line_height(px(20.0))
            .font_weight(FontWeight::SEMIBOLD)
            .text_color(gpui::white())
            .when_some(self.font_family, |el, family| el.font_family(family))
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| {
                        let face = crate::surface::scale_bounds(bounds, scale);
                        if focus_visible {
                            paint_focus_ring(
                                face,
                                face.size.height / 2.0,
                                rgb_a(0xa1a1a1, 1.0),
                                rgb_a(0x0a0a0a, 1.0),
                                window,
                            );
                        }
                        paint_eye_button(face, bounds, &frame, window);
                        watch_pointer(watcher.clone(), bounds, window);
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            .child(scaled_content(scale, move |s| {
                let spacing = 14.0 * 0.2 * s;
                div()
                    .relative()
                    .text_size(px(14.0 * s))
                    .line_height(px(20.0 * s))
                    // text-shadow: 0 0 12px eye/55%: a soft haze behind the label.
                    .child(
                        canvas(
                            |_, _, _| {},
                            move |bounds, _, window, _| {
                                window.paint_drop_shadows(
                                    bounds,
                                    Corners::all(bounds.size.height / 2.0),
                                    &[BoxShadow {
                                        color: text_glow.opacity(0.45),
                                        offset: point(px(0.0), px(0.0)),
                                        blur_radius: px(6.0 * s), // text-shadow blur 12px = 6px sigma
                                        spread_radius: px(-2.0 * s),
                                        inset: false,
                                    }],
                                );
                            },
                        )
                        .absolute()
                        .top_0()
                        .left_0()
                        .size_full(),
                    )
                    // text-shadow: 0 1px 2px black/90%.
                    .child(
                        tracked(&label, spacing)
                            .absolute()
                            .top(px(s))
                            .left_0()
                            .text_color(rgb_a(0x000000, 0.9)),
                    )
                    .child(tracked(&label, spacing).relative())
                    .into_any_element()
            }));

        let button = wire(button, &state, &focus, self.disabled);
        if self.disabled {
            return button;
        }
        let on_click = self.on_click.clone();
        let click_state = state.clone();
        button.on_click(move |event, window, cx| {
            if let Some(handler) = on_click.as_ref() {
                handler(event, window, cx);
            }
            click_state.update(cx, |s, _| s.blink = Some(Timeline::start(ms(200))));
        })
    }
}

/// The eye watches the cursor anywhere in the window, not just over itself.
fn watch_pointer(state: gpui::Entity<EyeState>, bounds: Bounds<Pixels>, window: &mut Window) {
    window.on_mouse_event(move |event: &MouseMoveEvent, phase, _, cx| {
        if phase != DispatchPhase::Bubble {
            return;
        }
        let center = bounds.center();
        let dx = (event.position.x - center.x).as_f32();
        let dy = (event.position.y - center.y).as_f32();
        state.update(cx, |s, _| {
            const REACH: f32 = 240.0;
            let dist = dx.hypot(dy);
            // `pupil_follow` is applied at paint time so it can change live.
            let k = dist.min(REACH) / REACH / if dist == 0.0 { 1.0 } else { dist };
            s.look_target = (dx * k, -dy * k);
        });
    });
}

/// Lid closure (0 open … 1 shut) for a 200ms blink: shut by 40% with
/// `cubic-bezier(.5,0,.75,0)`, hold to 55%, reopen with `cubic-bezier(.25,1,.5,1)`.
fn lid_closure(t: f32) -> f32 {
    if t < 0.4 {
        Easing::CubicBezier(0.5, 0.0, 0.75, 0.0).apply(t / 0.4)
    } else if t < 0.55 {
        1.0
    } else {
        1.0 - Easing::CubicBezier(0.25, 1.0, 0.5, 1.0).apply((t - 0.55) / 0.45)
    }
}

#[derive(Clone, Copy)]
struct Frame {
    eye: EyeParams,
    time: f32,
    focus: f32,
    look: (f32, f32),
    hover: f32,
    lids: f32,
    hairline: Hsla,
    glow_shadow: Hsla,
}

fn paint_eye_button(face: Bounds<Pixels>, layout: Bounds<Pixels>, f: &Frame, window: &mut Window) {
    let h = face.size.height.as_f32();
    let radii = Corners::all(px(h / 2.0));
    let hover = f.hover;
    let l = |a: f32, b: f32| a + (b - a) * hover;
    let black = |a: f32| rgb_a(0x000000, a);
    // Rest: 0 1px 2px black/.4, 0 10px 24px -10px black/.7.
    // Hover: 0 1px 2px black/.4, 0 10px 32px -8px eye/50%.
    let deep = if hover <= 0.0 {
        black(0.7)
    } else {
        lerp_hsla(black(0.7), f.glow_shadow, hover.clamp(0.0, 1.0))
    };
    window.paint_drop_shadows(
        face,
        radii,
        &[
            shadow(10.0, l(24.0, 32.0), l(-10.0, -8.0), deep, false),
            shadow(1.0, 2.0, 0.0, black(0.4), false),
            shadow(0.0, 0.0, 1.0, f.hairline, false),
        ],
    );
    window.paint_quad(quad(
        face,
        radii,
        rgb_a(FACE, 1.0),
        px(0.0),
        transparent_black(),
        Default::default(),
    ));

    paint_eye(face, layout, f, window);
    paint_lids(face, f, window);

    // inset 0 1px 0 white/.1 (→ .12 on hover), and the glass lip.
    window.paint_inset_shadows(
        face,
        radii,
        &[shadow(1.0, 0.0, 0.0, rgb_a(0xffffff, l(0.1, 0.12)), true)],
    );
    window.paint_quad(quad(
        face,
        radii,
        linear_gradient(
            180.0,
            linear_color_stop(rgb_a(0xffffff, 0.1), 0.0),
            linear_color_stop(rgb_a(0xffffff, 0.0), 0.35),
        ),
        px(0.0),
        transparent_black(),
        Default::default(),
    ));
}

/// Runs the eye shader on a vertex grid (every `STEP_X` px across, every
/// `ROW_H` px down, `SUPERSAMPLE` samples each) and paints each span between two
/// vertices as a horizontal gradient, clipped to the pill row by row.
fn paint_eye(face: Bounds<Pixels>, layout: Bounds<Pixels>, f: &Frame, window: &mut Window) {
    let noise = noise_texture();
    // Shader space comes from the unscaled layout box; spans land on the scaled face.
    let (w, h) = (layout.size.width.as_f32(), layout.size.height.as_f32());
    let k = face.size.height.as_f32() / h;
    let (ox, oy) = (face.origin.x.as_f32(), face.origin.y.as_f32());
    let bg = rgb3(rgb_a(FACE, 1.0));
    let eye = &f.eye;
    let look = (f.look.0 * eye.pupil_follow, f.look.1 * eye.pupil_follow);
    let gain = eye.intensity * (1.0 + f.focus * 0.12);
    let radius = h / 2.0;
    let cols = (w / STEP_X).ceil() as usize;
    let rows = (h / ROW_H).ceil() as usize;
    let mut line: Vec<[f32; 3]> = Vec::with_capacity(cols + 1);
    for row in 0..rows {
        let y = row as f32 * ROW_H;
        let row_h = ROW_H.min(h - y);
        let y_mid = y + row_h / 2.0;
        // The pill's horizontal extent through this row.
        let dy = (y_mid - radius).abs();
        let inset = radius - (radius * radius - dy * dy).max(0.0).sqrt();
        let (left, right) = (inset, w - inset);
        line.clear();
        for col in 0..=cols {
            let x = (col as f32 * STEP_X).min(w);
            let mut acc = [0.0_f32; 3];
            for sample in 0..SUPERSAMPLE {
                let sy = y + row_h * (sample as f32 + 0.5) / SUPERSAMPLE as f32;
                let uv = (
                    (2.0 * x - w) / h / eye.scale,
                    -(2.0 * sy - h) / h / eye.scale,
                );
                let lit = shade(uv, look, f.focus, f.time, eye, noise);
                let c = [0, 1, 2].map(|i| (eye.color[i] * gain * lit + bg[i]).min(1.0));
                let c = readability(c, bg, x - w / 2.0, sy - h / 2.0, w, h);
                for i in 0..3 {
                    acc[i] += c[i];
                }
            }
            line.push(acc.map(|v| v / SUPERSAMPLE as f32));
        }
        let near_bg = |c: &[f32; 3]| (0..3).all(|i| (c[i] - bg[i]).abs() < 1.5 / 255.0);
        let mut col = 0;
        while col < cols {
            if near_bg(&line[col]) && near_bg(&line[col + 1]) {
                col += 1;
                continue;
            }
            // Grow the span while a single gradient still reproduces every vertex
            // it covers (smooth stretches, like the ember haze, merge into one quad).
            let mut end = col + 1;
            while end < cols && is_linear(&line[col..=end + 1]) {
                end += 1;
            }
            let (a, b) = (line[col], line[end]);
            let (x0, x1) = (col as f32 * STEP_X, (end as f32 * STEP_X).min(w));
            col = end;
            let (cx0, cx1) = (x0.max(left), x1.min(right));
            if cx1 <= cx0 {
                continue;
            }
            // Gradient stops for the clipped span, interpolated along the full one.
            let at = |x: f32| {
                let t = ((x - x0) / (x1 - x0)).clamp(0.0, 1.0);
                from_rgb3([0, 1, 2].map(|i| a[i] + (b[i] - a[i]) * t))
            };
            let span = Bounds::new(
                point(px(ox + cx0 * k), px(oy + y * k)),
                size(px((cx1 - cx0) * k), px(row_h * k)),
            );
            window.paint_quad(quad(
                span,
                Corners::default(),
                linear_gradient(
                    90.0,
                    linear_color_stop(at(cx0), 0.0),
                    linear_color_stop(at(cx1), 1.0),
                ),
                px(0.0),
                transparent_black(),
                Default::default(),
            ));
        }
    }
}

/// Whether a straight gradient from the first to the last colour stays within
/// ~2/255 of every colour in between.
fn is_linear(colors: &[[f32; 3]]) -> bool {
    let (first, last) = (colors[0], colors[colors.len() - 1]);
    let n = (colors.len() - 1) as f32;
    colors.iter().enumerate().skip(1).all(|(i, c)| {
        let t = i as f32 / n;
        (0..3).all(|ch| (first[ch] + (last[ch] - first[ch]) * t - c[ch]).abs() < 2.0 / 255.0)
    })
}

/// The original's fragment shader, returning the `lit` term.
// The shader divides by the literal 6.28, not 2π; keep it.
#[allow(clippy::approx_constant)]
fn shade(
    uv: (f32, f32),
    look: (f32, f32),
    focus: f32,
    time: f32,
    eye: &EyeParams,
    noise: &[f32],
) -> f32 {
    let len = uv.0.len_with(uv.1);
    let polar = (len * 2.0, 2.0 * fast_atan2(uv.0, uv.1) / 6.28 * 0.3);
    let ns = eye.noise_scale;
    let noise_a = sample(noise, polar.0 * 0.2 * ns - time * 0.1, polar.1 * 7.0 * ns);
    let noise_b = sample(noise, polar.0 * 0.3 * ns - time * 0.2, polar.1 * 4.0 * ns);
    let noise_c = sample(noise, polar.0 * 0.1 * ns - time * 0.1, polar.1 * 5.0 * ns);

    let mask = 1.0 - len;

    let mut inner = (-(mask - 0.7) / eye.iris_width).clamp(0.0, 1.0);
    inner = (inner * mask - 0.2) / 0.28;
    inner += noise_a - 0.5;
    inner *= 1.3;
    inner = inner.clamp(0.0, 1.0);

    let mut outer = (-(mask - 0.5) / 0.2).clamp(0.0, 1.0);
    outer = (outer * mask - 0.1) / 0.38;
    outer += noise_c - 0.5;
    outer *= 1.3;
    outer = outer.clamp(0.0, 1.0);

    inner += outer;

    let inner_eye = (mask - 0.2) * noise_b * 2.0;

    let pupil_uv = (uv.0 - look.0 * 0.32, uv.1 - look.1 * 0.32);
    let slit = 9.0 + 5.0 * focus;
    let mut pupil = 1.0 - (pupil_uv.0 * slit).len_with(pupil_uv.1 * 2.3);
    pupil *= eye.pupil_size;
    pupil = pupil.clamp(0.0, 1.0) / 0.35;

    let mut eye_glow = 1.0 - (uv.0 * 0.5).len_with(uv.1 * 1.5);
    eye_glow = (eye_glow + 0.5).clamp(0.0, 1.0);
    eye_glow += noise_c - 0.5;
    let mut bg_glow = eye_glow;
    // `pow(x, 2.0)` compiles to `x * x`; `pow(x, 0.5)` of a negative base is
    // undefined in GLSL and the live site renders it as `sqrt(abs(x))` (a warm
    // ember haze across the whole pill), so match that.
    eye_glow *= eye_glow;
    eye_glow += mask;
    eye_glow *= eye.glow;
    eye_glow = eye_glow.clamp(0.0, 1.0);
    eye_glow *= (1.0 - mask).powi(2) * 2.5;

    bg_glow += mask;
    bg_glow = bg_glow.abs().sqrt() * 0.15;

    ((inner + inner_eye).max(eye_glow + bg_glow) - pupil).clamp(0.0, 3.0)
}

/// The label's readability band and the rim vignette, composited over the eye:
/// `radial-gradient(30% 38% at 50% 50%, face/.4, transparent)` and
/// `radial-gradient(ellipse at center, transparent 60%, face/.7)`.
fn readability(c: [f32; 3], bg: [f32; 3], dx: f32, dy: f32, w: f32, h: f32) -> [f32; 3] {
    let band = (dx / (0.3 * w)).hypot(dy / (0.38 * h));
    let a1 = 0.4 * (1.0 - band).max(0.0);
    let rim = (dx / (w / 2.0)).hypot(dy / (h / 2.0)) / std::f32::consts::SQRT_2;
    let a2 = 0.7 * ((rim - 0.6) / 0.4).clamp(0.0, 1.0);
    let mut out = c;
    for i in 0..3 {
        out[i] = out[i] + (bg[i] - out[i]) * a1;
        out[i] = out[i] + (bg[i] - out[i]) * a2;
    }
    out
}

/// `length(vec2(a, b))`; `f32::hypot` is much slower and its care is wasted here.
trait LenWith {
    fn len_with(self, other: f32) -> f32;
}

impl LenWith for f32 {
    #[inline]
    fn len_with(self, other: f32) -> f32 {
        (self * self + other * other).sqrt()
    }
}

/// `atan(y, x)` (GLSL argument order), within ~3e-4 rad.
#[inline]
fn fast_atan2(y: f32, x: f32) -> f32 {
    use std::f32::consts::{FRAC_PI_2, PI};
    let (ax, ay) = (x.abs(), y.abs());
    if ax == 0.0 && ay == 0.0 {
        return 0.0;
    }
    let (a, swap) = if ay > ax {
        (ax / ay, true)
    } else {
        (ay / ax, false)
    };
    let s = a * a;
    let mut r = ((-0.046_496_475 * s + 0.159_314_22) * s - 0.327_622_76) * s * a + a;
    if swap {
        r = FRAC_PI_2 - r;
    }
    if x < 0.0 {
        r = PI - r;
    }
    if y < 0.0 { -r } else { r }
}

/// Bilinear, repeating lookup into the 256² noise texture (`texture2D` with
/// `LINEAR` filtering and `REPEAT` wrapping).
fn sample(noise: &[f32], u: f32, v: f32) -> f32 {
    const N: usize = NOISE_SIZE;
    let x = u * N as f32 - 0.5;
    let y = v * N as f32 - 0.5;
    let (fx, fy) = (x.floor(), y.floor());
    let (tx, ty) = (x - fx, y - fy);
    // N is a power of two, so wrapping is a mask (two's complement handles negatives).
    const MASK: i32 = N as i32 - 1;
    let (ix, iy) = (fx as i32, fy as i32);
    let (x0, y0) = ((ix & MASK) as usize, (iy & MASK) as usize);
    let (x1, y1) = (((ix + 1) & MASK) as usize, ((iy + 1) & MASK) as usize);
    let at = |x: usize, y: usize| noise[y * N + x];
    let top = at(x0, y0) + (at(x1, y0) - at(x0, y0)) * tx;
    let bottom = at(x0, y1) + (at(x1, y1) - at(x0, y1)) * tx;
    top + (bottom - top) * ty
}

const NOISE_SIZE: usize = 256;

/// Tileable fractal value noise, identical to the original's texture
/// (including its integer hash), built once and shared by every eye.
fn noise_texture() -> &'static [f32] {
    static NOISE: OnceLock<Vec<f32>> = OnceLock::new();
    NOISE.get_or_init(|| {
        const N: usize = NOISE_SIZE;
        let hash = |x: i64, y: i64, s: i64| -> f32 {
            let n = (x * 374_761_393 + y * 668_265_263 + s * 1_274_126_177) as u32;
            let n = (n ^ (n >> 13)).wrapping_mul(1_274_126_177);
            (n ^ (n >> 16)) as f32 / 4_294_967_296.0
        };
        let noise = |px: usize, py: usize, freq: i64, seed: i64| -> f32 {
            let fx = px as f64 / N as f64 * freq as f64;
            let fy = py as f64 / N as f64 * freq as f64;
            let (ix, iy) = (fx.floor() as i64, fy.floor() as i64);
            let (tx, ty) = ((fx - ix as f64) as f32, (fy - iy as f64) as f32);
            let wrap = |v: i64| v.rem_euclid(freq);
            let v00 = hash(wrap(ix), wrap(iy), seed);
            let v10 = hash(wrap(ix + 1), wrap(iy), seed);
            let v01 = hash(wrap(ix), wrap(iy + 1), seed);
            let v11 = hash(wrap(ix + 1), wrap(iy + 1), seed);
            v00 * (1.0 - tx) * (1.0 - ty)
                + v10 * tx * (1.0 - ty)
                + v01 * (1.0 - tx) * ty
                + v11 * tx * ty
        };
        let mut data = Vec::with_capacity(N * N);
        for y in 0..N {
            for x in 0..N {
                let (mut v, mut amp, mut total) = (0.0_f32, 0.4_f32, 0.0_f32);
                for o in 0..8 {
                    v += amp * noise(x, y, 32 << o, o * 31);
                    total += amp;
                    amp *= 0.65;
                }
                let v = ((v / total - 0.5) * 2.2 + 0.5).clamp(0.0, 1.0);
                // The original uploads bytes.
                data.push((v * 255.0).round() / 255.0);
            }
        }
        data
    })
}

/// The eyelids: `inset-x-[-10%]`, 54% tall, `rounded-[50%]` on the inner
/// edge, scaled from the outer edge, with a 1px eye-coloured lash line.
fn paint_lids(face: Bounds<Pixels>, f: &Frame, window: &mut Window) {
    if f.lids <= 0.001 {
        return;
    }
    let (x0, y0) = (face.origin.x.as_f32(), face.origin.y.as_f32());
    let (w, h) = (face.size.width.as_f32(), face.size.height.as_f32());
    let clip = pill_polygon(face, 10);
    let lid_h = 0.54 * h * f.lids;
    let lash = from_rgb3(f.eye.color).opacity(0.4);
    for top in [true, false] {
        for (shift, color) in [(1.0, lash), (0.0, rgb_a(FACE, 1.0))] {
            let dy = if top { shift } else { -shift };
            let lid = lid_polygon(x0 - 0.1 * w, w * 1.2, y0, y0 + h, lid_h, top, dy);
            let poly = clip_convex(&lid, &clip);
            if poly.len() < 3 {
                continue;
            }
            let points: Vec<Point<Pixels>> =
                poly.iter().map(|&(x, y)| point(px(x), px(y))).collect();
            let mut path = PathBuilder::fill();
            path.add_polygon(&points, true);
            if let Ok(path) = path.build() {
                window.paint_path(path, color);
            }
        }
    }
}

/// A lid: straight outer edge, half-ellipse inner edge. Clockwise on screen.
fn lid_polygon(
    left: f32,
    width: f32,
    top: f32,
    bottom: f32,
    height: f32,
    is_top: bool,
    dy: f32,
) -> Vec<(f32, f32)> {
    const STEPS: usize = 24;
    let (rx, ry) = (width / 2.0, height / 2.0);
    let cx = left + rx;
    let mut points = Vec::with_capacity(STEPS + 3);
    if is_top {
        let cy = top + ry + dy;
        points.push((left, top + dy - 1.0));
        points.push((left + width, top + dy - 1.0));
        // Right side down to the ellipse, sweeping through the bottom to the left.
        for i in 0..=STEPS {
            let a = std::f32::consts::PI * i as f32 / STEPS as f32;
            points.push((cx + rx * a.cos(), cy + ry * a.sin()));
        }
    } else {
        let cy = bottom - ry + dy;
        points.push((left + width, bottom + dy + 1.0));
        points.push((left, bottom + dy + 1.0));
        for i in 0..=STEPS {
            let a = std::f32::consts::PI * (1.0 + i as f32 / STEPS as f32);
            points.push((cx + rx * a.cos(), cy + ry * a.sin()));
        }
    }
    points
}

fn pill_polygon(bounds: Bounds<Pixels>, segments: usize) -> Vec<(f32, f32)> {
    let (x0, y0) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
    let (x1, y1) = (bounds.right().as_f32(), bounds.bottom().as_f32());
    let r = ((y1 - y0) / 2.0).min((x1 - x0) / 2.0);
    let corners = [
        (x1 - r, y0 + r, -90.0_f32),
        (x1 - r, y1 - r, 0.0),
        (x0 + r, y1 - r, 90.0),
        (x0 + r, y0 + r, 180.0),
    ];
    let mut points = Vec::with_capacity(4 * (segments + 1));
    for (cx, cy, start) in corners {
        for s in 0..=segments {
            let angle = (start + 90.0 * s as f32 / segments as f32).to_radians();
            points.push((cx + r * angle.cos(), cy + r * angle.sin()));
        }
    }
    points
}

/// Sutherland–Hodgman: clips convex `subject` against convex, clockwise `clip`.
fn clip_convex(subject: &[(f32, f32)], clip: &[(f32, f32)]) -> Vec<(f32, f32)> {
    let mut output = subject.to_vec();
    for i in 0..clip.len() {
        if output.is_empty() {
            break;
        }
        let a = clip[i];
        let b = clip[(i + 1) % clip.len()];
        let inside = |p: (f32, f32)| (b.0 - a.0) * (p.1 - a.1) - (b.1 - a.1) * (p.0 - a.0) >= 0.0;
        let intersect = |p: (f32, f32), q: (f32, f32)| {
            let (dx, dy) = (q.0 - p.0, q.1 - p.1);
            let (ex, ey) = (b.0 - a.0, b.1 - a.1);
            let denom = dx * ey - dy * ex;
            if denom.abs() < f32::EPSILON {
                return p;
            }
            let t = ((a.0 - p.0) * ey - (a.1 - p.1) * ex) / denom;
            (p.0 + dx * t, p.1 + dy * t)
        };
        let input = std::mem::take(&mut output);
        for j in 0..input.len() {
            let current = input[j];
            let previous = input[(j + input.len() - 1) % input.len()];
            match (inside(current), inside(previous)) {
                (true, true) => output.push(current),
                (true, false) => {
                    output.push(intersect(previous, current));
                    output.push(current);
                }
                (false, true) => output.push(intersect(previous, current)),
                (false, false) => {}
            }
        }
    }
    output
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

fn rgb3(color: Hsla) -> [f32; 3] {
    let c = Rgba::from(color);
    [c.r, c.g, c.b]
}

fn from_rgb3(c: [f32; 3]) -> Hsla {
    Rgba {
        r: c[0].clamp(0.0, 1.0),
        g: c[1].clamp(0.0, 1.0),
        b: c[2].clamp(0.0, 1.0),
        a: 1.0,
    }
    .into()
}

fn lerp_hsla(a: Hsla, b: Hsla, t: f32) -> Hsla {
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

/// `color-mix(in oklab, a, b <t>)`: `t` is the share of `b`.
fn mix_oklab(a: [f32; 3], b: [f32; 3], t: f32) -> Hsla {
    let (la, lb) = (to_oklab(a), to_oklab(b));
    let m = [0, 1, 2].map(|i| la[i] + (lb[i] - la[i]) * t);
    from_rgb3(from_oklab(m))
}

fn to_linear(c: f32) -> f32 {
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

fn to_srgb(c: f32) -> f32 {
    let c = c.max(0.0);
    if c <= 0.003_130_8 {
        c * 12.92
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    }
}

fn to_oklab(c: [f32; 3]) -> [f32; 3] {
    let [r, g, b] = c.map(to_linear);
    let l = (0.412_221_46 * r + 0.536_332_55 * g + 0.051_445_995 * b).cbrt();
    let m = (0.211_903_5 * r + 0.680_699_5 * g + 0.107_396_96 * b).cbrt();
    let s = (0.088_302_46 * r + 0.281_718_85 * g + 0.629_978_7 * b).cbrt();
    [
        0.210_454_26 * l + 0.793_617_8 * m - 0.004_072_047 * s,
        1.977_998_5 * l - 2.428_592_2 * m + 0.450_593_7 * s,
        0.025_904_037 * l + 0.782_771_77 * m - 0.808_675_77 * s,
    ]
}

fn from_oklab(c: [f32; 3]) -> [f32; 3] {
    let l = c[0] + 0.396_337_78 * c[1] + 0.215_803_76 * c[2];
    let m = c[0] - 0.105_561_346 * c[1] - 0.063_854_17 * c[2];
    let s = c[0] - 0.089_484_18 * c[1] - 1.291_485_5 * c[2];
    let (l, m, s) = (l * l * l, m * m * m, s * s * s);
    [
        4.076_741_7 * l - 3.307_711_6 * m + 0.230_969_94 * s,
        -1.268_438 * l + 2.609_757_4 * m - 0.341_319_38 * s,
        -0.004_196_086_3 * l - 0.703_418_6 * m + 1.707_614_7 * s,
    ]
    .map(to_srgb)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn noise_matches_the_original_hash() {
        let noise = noise_texture();
        assert_eq!(noise.len(), NOISE_SIZE * NOISE_SIZE);
        assert!(noise.iter().all(|v| (0.0..=1.0).contains(v)));
        // Contrast-stretched around 0.5.
        let mean = noise.iter().sum::<f32>() / noise.len() as f32;
        assert!((mean - 0.5).abs() < 0.08, "mean {mean}");
    }

    #[test]
    fn pupil_is_dark_and_iris_is_lit() {
        let eye = EvilEyeButton::new("eye").eye;
        let noise = noise_texture();
        let centre = shade((0.0, 0.0), (0.0, 0.0), 0.0, 0.0, &eye, noise);
        assert!(centre < 0.2, "pupil lit {centre}");
        let ring = (0..16)
            .map(|i| {
                let a = i as f32 / 16.0 * std::f32::consts::TAU;
                shade(
                    (0.4 * a.cos(), 0.4 * a.sin()),
                    (0.0, 0.0),
                    0.0,
                    0.0,
                    &eye,
                    noise,
                )
            })
            .sum::<f32>()
            / 16.0;
        assert!(ring > 0.3, "iris dim {ring}");
    }

    #[test]
    fn fast_atan2_matches_std() {
        for i in 0..64 {
            let a = i as f32 / 64.0 * std::f32::consts::TAU;
            let (y, x) = (a.sin() * 3.0, a.cos() * 3.0);
            let (got, want) = (fast_atan2(y, x), y.atan2(x));
            assert!((got - want).abs() < 5e-4, "{i}: {got} vs {want}");
        }
    }

    #[test]
    fn oklab_round_trips() {
        let c = [1.0, 0.435, 0.216];
        let back = from_oklab(to_oklab(c));
        for i in 0..3 {
            assert!((back[i] - c[i]).abs() < 1e-3);
        }
    }

    #[test]
    fn blink_closes_and_reopens() {
        assert_eq!(lid_closure(0.0), 0.0);
        assert_eq!(lid_closure(0.5), 1.0);
        assert!(lid_closure(1.0).abs() < 1e-4);
    }
}
