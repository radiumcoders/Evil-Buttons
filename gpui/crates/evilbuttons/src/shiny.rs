//! ShinyButton: an indigo pill whose rim and face catch a glint that sweeps
//! across on every click.

use gpui::{
    App, Bounds, BoxShadow, ClickEvent, Context, Corners, ElementId, FocusHandle, FontWeight,
    InteractiveElement, IntoElement, ParentElement, PathBuilder, Pixels, Point, RenderOnce,
    SharedString, StatefulInteractiveElement, Styled, Window, canvas, div, linear_color_stop,
    linear_gradient, point, prelude::FluentBuilder, px, quad, transparent_black,
};
use std::rc::Rc;

use crate::interaction::{ClickHandler, Pressable, wire};
use crate::motion::{Duration, Easing, Instant, Timeline, Transition, keyframes};
use crate::surface::{brighten, ms, paint_focus_ring, rgb_a, scale_bounds};

const INDIGO_500: u32 = 0x6366f1;
const INDIGO_600: u32 = 0x4f46e5;
const INDIGO_700: u32 = 0x4338ca;
const INDIGO_800: u32 = 0x3730a3;

/// An indigo pill with a glint that sweeps across the rim and face on click.
#[derive(IntoElement)]
pub struct ShinyButton {
    id: ElementId,
    label: SharedString,
    shine_duration: Duration,
    disabled: bool,
    on_click: Option<ClickHandler>,
}

impl ShinyButton {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            shine_duration: ms(650),
            disabled: false,
            on_click: None,
        }
    }

    /// How long the glint takes to sweep across. Defaults to 650ms.
    pub fn shine_duration(mut self, duration: Duration) -> Self {
        self.shine_duration = duration;
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

struct ShinyState {
    /// 0 rest, 1 pressed (100ms).
    press: Transition,
    shine: Option<Timeline>,
    shine_duration: Duration,
    focus_visible: bool,
    focus: FocusHandle,
}

impl Pressable for ShinyState {
    fn set_hovered(&mut self, _: bool) -> bool {
        false
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.focus_visible = keyboard;
        self.press.animate_to(1.0, ms(100), Easing::STANDARD)
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        self.press.animate_to(0.0, ms(100), Easing::STANDARD)
    }
}

impl RenderOnce for ShinyButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<ShinyState>| {
                ShinyState {
                    press: Transition::new(0.0),
                    shine: None,
                    shine_duration: ms(650),
                    focus_visible: false,
                    focus: cx.focus_handle().tab_stop(true),
                }
            });
        let shine_duration = self.shine_duration;
        state.update(cx, |s, _| s.shine_duration = shine_duration);

        let now = Instant::now();
        let (press, shine, focus, focus_visible, animating) = {
            let s = state.read(cx);
            let shine = s.shine.filter(|t| !t.is_done(now));
            (
                s.press.value(now),
                shine.map(|t| t.progress(now)),
                s.focus.clone(),
                (s.focus_visible || window.last_input_was_keyboard()) && s.focus.is_focused(window),
                s.press.is_animating(now) || shine.is_some(),
            )
        };
        if animating {
            window.request_animation_frame();
        }

        // Face flash: brightness 1 → 1.25 (at 25%) → 1 over 80% of the sweep, ease-out.
        let flash = shine
            .map(|t| {
                let t = (t / 0.8).min(1.0);
                keyframes(
                    Easing::EASE_OUT.apply(t),
                    &[(0.0, 1.0), (0.25, 1.25), (1.0, 1.0)],
                )
            })
            .unwrap_or(1.0);
        // Glint: translateX(-160% → 420%) of a third-width band, opacity 0 → 1 → 1 → 0.
        let glint = shine.map(|t| {
            let p = Easing::STANDARD.apply(t);
            let x = -1.6 + 5.8 * p;
            let alpha = keyframes(p, &[(0.0, 0.0), (0.15, 1.0), (0.7, 1.0), (1.0, 0.0)]);
            (x, alpha)
        });

        let lift = px(2.0 * press);
        let scale = 1.0 - 0.01 * press;
        let lerp = |a: f32, b: f32| a + (b - a) * press;
        let indigo_glow = |a: f32| {
            let mut c = gpui::rgb(INDIGO_700);
            c.a = a;
            gpui::Hsla::from(c)
        };
        let shadows = [
            shadow(0.0, 1.0, lerp(2.0, 1.0), 0.0, rgb_a(0x000000, 0.2), false),
            shadow(
                0.0,
                lerp(4.0, 2.0),
                lerp(12.0, 6.0),
                -2.0,
                indigo_glow(lerp(0.45, 0.4)),
                false,
            ),
        ];

        let button = div()
            .id(self.id)
            .relative()
            .flex()
            .flex_none()
            .p(px(4.0))
            .text_size(px(14.0))
            .line_height(px(20.0))
            .font_weight(FontWeight::MEDIUM)
            .text_color(gpui::white())
            .when(self.disabled, |el| el.opacity(0.5).cursor_not_allowed())
            // Rim.
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| {
                        let mut rim = scale_bounds(bounds, scale);
                        rim.origin.y += lift;
                        let radii = Corners::all(px(16.0));
                        if focus_visible {
                            paint_focus_ring(
                                rim,
                                px(16.0),
                                rgb_a(0x818cf8, 1.0),
                                rgb_a(0x0a0a0a, 1.0),
                                window,
                            );
                        }
                        window.paint_drop_shadows(rim, radii, &shadows);
                        window.paint_quad(quad(
                            rim,
                            radii,
                            linear_gradient(
                                0.0,
                                linear_color_stop(gpui::rgb(INDIGO_500), 0.0),
                                linear_color_stop(gpui::rgb(INDIGO_800), 1.0),
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
            )
            // Face.
            .child(
                div()
                    .relative()
                    .top(lift)
                    .flex()
                    .items_center()
                    .gap(px(6.0))
                    .px(px(12.0))
                    .py(px(4.0))
                    .rounded(px(12.0))
                    .bg(linear_gradient(
                        0.0,
                        linear_color_stop(brighten(gpui::rgb(INDIGO_600), flash), 0.0),
                        linear_color_stop(brighten(gpui::rgb(INDIGO_700), flash), 1.0),
                    ))
                    .when(press > 0.5, |el| {
                        el.shadow(vec![shadow(
                            0.0,
                            0.0,
                            3.0,
                            0.0,
                            gpui::rgb(INDIGO_700).into(),
                            true,
                        )])
                    })
                    .child(self.label),
            )
            // Glint.
            .when_some(glint, |el, (x, alpha)| {
                el.child(
                    canvas(
                        |_, _, _| {},
                        move |bounds, _, window, _| {
                            let mut rim = scale_bounds(bounds, scale);
                            rim.origin.y += lift;
                            paint_glint(rim, px(16.0), x, alpha, window);
                        },
                    )
                    .absolute()
                    .top_0()
                    .left_0()
                    .size_full(),
                )
            });

        let click_state = state.clone();
        let on_click = self.on_click.filter(|_| !self.disabled);
        let button = wire(button, &state, &focus, self.disabled);
        if self.disabled {
            return button;
        }
        button.on_click(move |event, window, cx| {
            if let Some(handler) = on_click.as_ref() {
                handler(event, window, cx);
            }
            click_state.update(cx, |s, cx| {
                s.shine = Some(Timeline::start(s.shine_duration));
                cx.notify();
            });
        })
    }
}

fn shadow(x: f32, y: f32, blur: f32, spread: f32, color: gpui::Hsla, inset: bool) -> BoxShadow {
    BoxShadow {
        color,
        offset: point(px(x), px(y)),
        // GPUI blurs with `blur_radius` as the Gaussian sigma; a CSS blur radius is 2 sigma.
        blur_radius: px(blur / 2.0),
        spread_radius: px(spread),
        inset,
    }
}

/// Paints the skewed glint band (`w-1/3`, `skewX(-20deg)`, transparent → white/55 → transparent)
/// clipped to the button's rounded rect. `x` is the band's offset in band-widths.
fn paint_glint(bounds: Bounds<Pixels>, radius: Pixels, x: f32, alpha: f32, window: &mut Window) {
    if alpha <= 0.001 {
        return;
    }
    let clip = rounded_rect_polygon(bounds, radius.as_f32(), 6);
    let width = bounds.size.width.as_f32() / 3.0;
    let height = bounds.size.height.as_f32();
    let left = bounds.origin.x.as_f32() + x * width;
    let top = bounds.origin.y.as_f32();
    // skewX(-20deg) about the band's centre: the top leans right, the bottom left.
    let lean = (20.0_f32).to_radians().tan() * height * 0.5;

    const STRIPS: usize = 18;
    for i in 0..STRIPS {
        let t0 = i as f32 / STRIPS as f32;
        let t1 = (i + 1) as f32 / STRIPS as f32;
        // Triangle profile peaking at the middle of the band.
        let mid = (t0 + t1) * 0.5;
        let a = 0.55 * (1.0 - (mid - 0.5).abs() * 2.0) * alpha;
        let (x0, x1) = (left + width * t0, left + width * t1);
        let strip = [
            (x0 + lean, top),
            (x1 + lean, top),
            (x1 - lean, top + height),
            (x0 - lean, top + height),
        ];
        let poly = clip_convex(&strip, &clip);
        if poly.len() < 3 {
            continue;
        }
        let points: Vec<Point<Pixels>> = poly.iter().map(|&(x, y)| point(px(x), px(y))).collect();
        let mut builder = PathBuilder::fill();
        builder.add_polygon(&points, true);
        if let Ok(path) = builder.build() {
            window.paint_path(path, rgb_a(0xffffff, a));
        }
    }
}

fn rounded_rect_polygon(bounds: Bounds<Pixels>, radius: f32, segments: usize) -> Vec<(f32, f32)> {
    let (x0, y0) = (bounds.origin.x.as_f32(), bounds.origin.y.as_f32());
    let (x1, y1) = (
        x0 + bounds.size.width.as_f32(),
        y0 + bounds.size.height.as_f32(),
    );
    let r = radius
        .min(bounds.size.width.as_f32() * 0.5)
        .min(bounds.size.height.as_f32() * 0.5);
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
            // p + t·d meets the edge line where (a − p) × e = t · (d × e).
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

#[cfg(test)]
mod tests {
    use super::*;
    use gpui::{Bounds, point, px, size};

    #[test]
    fn clipping_keeps_inside_and_drops_outside() {
        let bounds = Bounds::new(point(px(0.0), px(0.0)), size(px(100.0), px(40.0)));
        let clip = rounded_rect_polygon(bounds, 10.0, 6);
        let inside = [(40.0, 0.0), (60.0, 0.0), (60.0, 40.0), (40.0, 40.0)];
        let clipped = clip_convex(&inside, &clip);
        assert!(clipped.len() >= 4);
        for (x, y) in clipped {
            assert!((40.0 - 1e-3..=60.0 + 1e-3).contains(&x) && (-1e-3..=40.0 + 1e-3).contains(&y));
        }
        let outside = [(200.0, 0.0), (220.0, 0.0), (220.0, 40.0), (200.0, 40.0)];
        assert!(clip_convex(&outside, &clip).len() < 3);
    }
}
