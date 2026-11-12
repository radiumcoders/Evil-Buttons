//! RealisticSwitch: a latching push switch. A raised cap sinks into its
//! socket when pressed, stays down and glows while on, and springs back up on
//! the next press.

use gpui::{
    App, Bounds, BoxShadow, ClickEvent, ContentMask, Context, Corners, ElementId, FocusHandle,
    Hsla, InteractiveElement, IntoElement, ParentElement, PathBuilder, PathStyle, Pixels, Point,
    RenderOnce, Rgba, StatefulInteractiveElement, StrokeOptions, Styled, Window, WindowAppearance,
    canvas, div, linear_color_stop, linear_gradient, point, prelude::FluentBuilder, px, quad, size,
    transparent_black,
};
use lyon::tessellation::{LineCap, LineJoin};
use std::rc::Rc;

use crate::interaction::{Pressable, wire};
use crate::motion::{Easing, Instant, Transition};
use crate::surface::{ms, rgb_a};

/// How big the switch is. Everything scales from one em size.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum RealisticSwitchSize {
    Sm,
    #[default]
    Default,
    Lg,
}

impl RealisticSwitchSize {
    fn em(self) -> f32 {
        match self {
            Self::Sm => 11.0,
            Self::Default => 15.0,
            Self::Lg => 19.0,
        }
    }
}

/// Socket finish: follow the window's appearance, or force ceramic white or graphite.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum RealisticSwitchTone {
    #[default]
    Auto,
    Light,
    Dark,
}

type ChangeHandler = Rc<dyn Fn(bool, &mut Window, &mut App)>;

/// A latching push switch with a cap that sinks, latches and glows.
///
/// ```ignore
/// RealisticSwitch::new("power")
///     .size(RealisticSwitchSize::Lg)
///     .on_change(|on, _, _| println!("power: {on}"))
/// ```
#[derive(IntoElement)]
pub struct RealisticSwitch {
    id: ElementId,
    checked: Option<bool>,
    default_checked: bool,
    color: Hsla,
    mark_color: Hsla,
    tone: RealisticSwitchTone,
    illuminated: bool,
    size: RealisticSwitchSize,
    disabled: bool,
    on_change: Option<ChangeHandler>,
}

impl RealisticSwitch {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            checked: None,
            default_checked: false,
            color: gpui::rgb(0xe1261c).into(),
            mark_color: rgb_a(0xffffff, 0.92),
            tone: RealisticSwitchTone::Auto,
            illuminated: true,
            size: RealisticSwitchSize::Default,
            disabled: false,
            on_change: None,
        }
    }

    /// Controlled on state. Leave unset to let the switch keep its own.
    pub fn checked(mut self, checked: bool) -> Self {
        self.checked = Some(checked);
        self
    }

    /// Initial state when uncontrolled. Defaults to `false`.
    pub fn default_checked(mut self, checked: bool) -> Self {
        self.default_checked = checked;
        self
    }

    /// Cap colour; its walls, shading and glow are mixed from it. Defaults to `#e1261c`.
    pub fn color(mut self, color: impl Into<Hsla>) -> Self {
        self.color = color.into();
        self
    }

    /// Colour of the power mark on the cap. Defaults to white at 92%.
    pub fn mark_color(mut self, color: impl Into<Hsla>) -> Self {
        self.mark_color = color.into();
        self
    }

    /// Socket finish. Defaults to [`RealisticSwitchTone::Auto`] (the window's appearance).
    pub fn tone(mut self, tone: RealisticSwitchTone) -> Self {
        self.tone = tone;
        self
    }

    /// Light the cap from inside while it is latched on. Defaults to `true`.
    pub fn illuminated(mut self, illuminated: bool) -> Self {
        self.illuminated = illuminated;
        self
    }

    pub fn size(mut self, size: RealisticSwitchSize) -> Self {
        self.size = size;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired with the new state when the switch latches or releases.
    pub fn on_change(mut self, handler: impl Fn(bool, &mut Window, &mut App) + 'static) -> Self {
        self.on_change = Some(Rc::new(handler));
        self
    }
}

// Geometry, in em. The cap is a box standing on its own walls inside a
// recessed socket; its height above the socket floor is the one thing that moves.
const SOCKET: f32 = 4.4;
const CAP: f32 = 3.3;
const GAP: f32 = (SOCKET - CAP) / 2.0;

const H_UP: f32 = 0.95;
const H_HOVER: f32 = 0.82;
const H_PRESSED: f32 = 0.1;
const H_LATCHED: f32 = 0.34;
const H_LATCHED_HOVER: f32 = 0.3;

/// `{ stiffness: 520, damping: 30, mass: 0.6 }`: a touch of bounce.
#[derive(Clone, Copy, Debug)]
struct HeightSpring {
    value: f32,
    velocity: f32,
    target: f32,
    last: Instant,
}

impl HeightSpring {
    fn new(value: f32) -> Self {
        Self {
            value,
            velocity: 0.0,
            target: value,
            last: Instant::now(),
        }
    }

    fn step(&mut self, now: Instant) -> f32 {
        let mut remaining = now
            .saturating_duration_since(self.last)
            .as_secs_f32()
            .min(0.064);
        self.last = now;
        if self.settled() {
            return self.value;
        }
        while remaining > 0.0 {
            let h = remaining.min(1.0 / 240.0);
            let force = -520.0 * (self.value - self.target) - 30.0 * self.velocity;
            self.velocity += force / 0.6 * h;
            self.value += self.velocity * h;
            remaining -= h;
        }
        if (self.value - self.target).abs() < 0.0005 && self.velocity.abs() < 0.005 {
            self.value = self.target;
            self.velocity = 0.0;
        }
        self.value
    }

    fn settled(&self) -> bool {
        self.value == self.target && self.velocity == 0.0
    }
}

struct SwitchState {
    internal: bool,
    hovered: bool,
    pressing: bool,
    focus_visible: bool,
    height: HeightSpring,
    /// Lamp and spill, 0..1 (500ms opacity transition).
    lit: Transition,
    focus: FocusHandle,
}

impl Pressable for SwitchState {
    fn set_hovered(&mut self, hovered: bool) -> bool {
        let changed = self.hovered != hovered || (!hovered && self.pressing);
        self.hovered = hovered;
        if !hovered {
            // Leaving cancels a press, like `onPointerLeave`.
            self.pressing = false;
        }
        changed
    }
    fn press(&mut self, keyboard: bool, _: &mut Window, _: &mut App) -> bool {
        self.focus_visible = keyboard;
        let changed = !self.pressing;
        self.pressing = true;
        changed
    }
    fn release(&mut self, _: &mut Window, _: &mut App) -> bool {
        let changed = self.pressing;
        self.pressing = false;
        changed
    }
}

struct Palette {
    hi: Hsla,
    mid: Hsla,
    lo: Hsla,
    well: Hsla,
    well_lo: Hsla,
    floor: Hsla,
    spill: f32,
}

impl Palette {
    fn new(dark: bool) -> Self {
        if dark {
            Self {
                hi: gpui::rgb(0x3a3a40).into(),
                mid: gpui::rgb(0x26262b).into(),
                lo: gpui::rgb(0x18181b).into(),
                well: gpui::rgb(0x0d0d10).into(),
                well_lo: gpui::rgb(0x050506).into(),
                floor: rgb_a(0x000000, 0.8),
                spill: 0.6,
            }
        } else {
            Self {
                hi: gpui::rgb(0xffffff).into(),
                mid: gpui::rgb(0xefeff2).into(),
                lo: gpui::rgb(0xd9d9df).into(),
                well: gpui::rgb(0xc9c9d1).into(),
                well_lo: gpui::rgb(0xaeaeb8).into(),
                floor: rgb_a(0x141428, 0.35),
                spill: 0.35,
            }
        }
    }
}

// --- colour helpers: CSS `color-mix(in oklab, ...)` ---

fn to_linear(c: f32) -> f32 {
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

fn to_srgb(c: f32) -> f32 {
    let c = c.max(0.0);
    if c <= 0.0031308 {
        c * 12.92
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    }
}

fn oklab(c: Rgba) -> [f32; 3] {
    let (r, g, b) = (to_linear(c.r), to_linear(c.g), to_linear(c.b));
    let l = (0.412_221_46 * r + 0.536_332_55 * g + 0.051_445_995 * b).cbrt();
    let m = (0.211_903_5 * r + 0.680_699_5 * g + 0.107_396_96 * b).cbrt();
    let s = (0.088_302_46 * r + 0.281_718_85 * g + 0.629_978_7 * b).cbrt();
    [
        0.210_454_26 * l + 0.793_617_8 * m - 0.004_072_047 * s,
        1.977_998_5 * l - 2.428_592_2 * m + 0.450_593_7 * s,
        0.025_904_037 * l + 0.782_771_77 * m - 0.808_675_77 * s,
    ]
}

fn from_oklab([l, a, b]: [f32; 3], alpha: f32) -> Hsla {
    let l_ = (l + 0.396_337_78 * a + 0.215_803_76 * b).powi(3);
    let m_ = (l - 0.105_561_346 * a - 0.063_854_17 * b).powi(3);
    let s_ = (l - 0.089_484_18 * a - 1.291_485_5 * b).powi(3);
    Rgba {
        r: to_srgb(4.076_741_7 * l_ - 3.307_711_6 * m_ + 0.230_969_94 * s_).min(1.0),
        g: to_srgb(-1.268_438 * l_ + 2.609_757_4 * m_ - 0.341_319_38 * s_).min(1.0),
        b: to_srgb(-0.004_196_086_3 * l_ - 0.703_418_6 * m_ + 1.707_614_7 * s_).min(1.0),
        a: alpha,
    }
    .into()
}

/// `color-mix(in oklab, color amount%, toward)` for toward = white or black.
fn mix(color: Hsla, amount: f32, white: bool) -> Hsla {
    let c = Rgba::from(color);
    let p = amount / 100.0;
    let lab = oklab(c);
    let target = if white {
        [1.0, 0.0, 0.0]
    } else {
        [0.0, 0.0, 0.0]
    };
    let t = 1.0 - p;
    // Premultiplied mix; the far colour is opaque.
    let alpha = c.a * p + t;
    let w = c.a * p / alpha.max(1e-6);
    from_oklab(
        [lab[0] * w + target[0] * (1.0 - w), lab[1] * w, lab[2] * w],
        alpha,
    )
}

fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

fn mix_srgb(a: Hsla, b: Hsla, t: f32) -> Hsla {
    let (a, b) = (Rgba::from(a), Rgba::from(b));
    Rgba {
        r: lerp(a.r, b.r, t),
        g: lerp(a.g, b.g, t),
        b: lerp(a.b, b.b, t),
        a: lerp(a.a, b.a, t),
    }
    .into()
}

fn shadow(x: f32, y: f32, blur: f32, spread: f32, color: Hsla, inset: bool) -> BoxShadow {
    // GPUI's blur radius is the gaussian sigma; CSS's is twice that.
    BoxShadow {
        color,
        offset: point(px(x), px(y)),
        blur_radius: px(blur / 2.0),
        spread_radius: px(spread),
        inset,
    }
}

/// A rounded box filled with a multi-stop gradient (`angle` 180 = top to
/// bottom, 90 = left to right), painted as masked two-stop segments.
fn paint_gradient(
    bounds: Bounds<Pixels>,
    radius: Pixels,
    angle: f32,
    stops: &[(f32, Hsla)],
    window: &mut Window,
) {
    let vertical = angle == 180.0;
    let (start, extent) = if vertical {
        (bounds.origin.y, bounds.size.height)
    } else {
        (bounds.origin.x, bounds.size.width)
    };
    for (i, pair) in stops.windows(2).enumerate() {
        let (a, b) = (pair[0], pair[1]);
        if b.0 <= a.0 {
            continue;
        }
        let first = i == 0;
        let last = i + 2 == stops.len();
        // Neighbours share the exact same (pixel-rounded) edge: no seam, no overlap.
        let edge = |t: f32| px((start + extent * t).as_f32().round());
        let lo = if first { start - px(4.0) } else { edge(a.0) };
        let hi = if last {
            start + extent + px(4.0)
        } else {
            edge(b.0)
        };
        let mask = if vertical {
            Bounds::new(
                point(bounds.origin.x - px(4.0), lo),
                size(bounds.size.width + px(8.0), hi - lo),
            )
        } else {
            Bounds::new(
                point(lo, bounds.origin.y - px(4.0)),
                size(hi - lo, bounds.size.height + px(8.0)),
            )
        };
        window.with_content_mask(Some(ContentMask { bounds: mask }), |window| {
            window.paint_quad(quad(
                bounds,
                Corners::all(radius),
                linear_gradient(
                    angle,
                    linear_color_stop(a.1, a.0),
                    linear_color_stop(b.1, b.0),
                ),
                px(0.0),
                transparent_black(),
                Default::default(),
            ));
        });
    }
}

/// The power mark (`M12 3v8` + `M7.05 6.4a7 7 0 1 0 9.9 0`), centred at `center`.
fn paint_mark(
    center: Point<Pixels>,
    side: f32,
    width: f32,
    offset: Point<Pixels>,
    color: Hsla,
    window: &mut Window,
) {
    if color.a <= 0.001 {
        return;
    }
    let unit = side / 24.0;
    let p = |x: f32, y: f32| {
        point(
            center.x + offset.x + px((x - 12.0) * unit),
            center.y + offset.y + px((y - 12.0) * unit),
        )
    };
    let w = width * unit;
    let options = StrokeOptions::default()
        .with_line_width(w)
        .with_line_cap(LineCap::Round)
        .with_line_join(LineJoin::Round);
    let mut b = PathBuilder::stroke(px(w)).with_style(PathStyle::Stroke(options));
    b.move_to(p(12.0, 3.0));
    b.line_to(p(12.0, 11.0));
    b.move_to(p(7.05, 6.4));
    b.arc_to(
        point(px(7.0 * unit), px(7.0 * unit)),
        px(0.0),
        true,
        false,
        p(16.95, 6.4),
    );
    if let Ok(path) = b.build() {
        window.paint_path(path, color);
    }
}

#[derive(Clone, Copy)]
struct Frame {
    em: f32,
    height: f32,
    lit: f32,
    color: Hsla,
    mark: Hsla,
    dark: bool,
    focus_visible: bool,
}

fn paint_switch(bounds: Bounds<Pixels>, f: Frame, window: &mut Window) {
    let em = |v: f32| px(v * f.em);
    let pal = Palette::new(f.dark);
    let cap = f.color;
    let o = bounds.origin;
    let at = |x: f32, y: f32, w: f32, h: f32| {
        Bounds::new(point(o.x + em(x), o.y + em(y)), size(em(w), em(h)))
    };
    let black = |a: f32| rgb_a(0x000000, a);
    let white = |a: f32| rgb_a(0xffffff, a);

    if f.focus_visible {
        // ring-2 ring-offset-2 around the rounded-[1.1em] button.
        let ring = Bounds::new(
            bounds.origin - point(px(4.0), px(4.0)),
            bounds.size + size(px(8.0), px(8.0)),
        );
        window.paint_quad(quad(
            ring,
            Corners::all(em(1.1) + px(4.0)),
            transparent_black(),
            px(2.0),
            rgb_a(0xa1a1a1, 1.0),
            Default::default(),
        ));
    }

    // The socket box sits inside the button's padding (0.5em, top 1.4em).
    let (sx, sy) = (0.5, 1.4);

    // Plate: a moulded plate with a lit top edge and a soft drop shadow.
    let plate = at(sx - 0.3, sy - 0.3, SOCKET + 0.6, SOCKET + 0.6);
    let plate_r = em(1.05);
    window.paint_drop_shadows(
        plate,
        Corners::all(plate_r),
        &[
            shadow(0.0, 0.5 * f.em, 1.0 * f.em, -0.3 * f.em, pal.floor, false),
            shadow(0.0, 0.08 * f.em, 0.1 * f.em, 0.0, black(0.18), false),
        ],
    );
    paint_gradient(
        plate,
        plate_r,
        180.0,
        &[(0.0, pal.hi), (0.5, pal.mid), (1.0, pal.lo)],
        window,
    );
    window.paint_inset_shadows(
        plate,
        Corners::all(plate_r),
        &[
            shadow(0.0, 0.05 * f.em, 0.0, 0.0, white(0.6), true),
            shadow(0.0, -0.06 * f.em, 0.0, 0.0, black(0.18), true),
        ],
    );

    // Well: the recess the cap travels in, darker the deeper it goes.
    let well = at(sx, sy, SOCKET, SOCKET);
    let well_r = em(0.85);
    window.paint_drop_shadows(
        well,
        Corners::all(well_r),
        &[shadow(0.0, 0.04 * f.em, 0.0, 0.0, white(0.5), false)],
    );
    paint_gradient(
        well,
        well_r,
        180.0,
        &[(0.0, pal.well_lo), (1.0, pal.well)],
        window,
    );
    window.paint_inset_shadows(
        well,
        Corners::all(well_r),
        &[
            shadow(0.0, 0.14 * f.em, 0.3 * f.em, 0.0, black(0.5), true),
            shadow(0.0, -0.04 * f.em, 0.0, 0.0, white(0.25), true),
        ],
    );

    // Light from a latched cap pooling in the well (blur 0.35em).
    let spill = pal.spill * f.lit;
    if spill > 0.001 {
        let mut c = cap;
        c.a *= spill;
        window.paint_drop_shadows(
            at(sx + 0.15, sy + 0.15, SOCKET - 0.3, SOCKET - 0.3),
            Corners::all(em(0.75)),
            &[BoxShadow {
                color: c,
                offset: point(px(0.0), px(0.0)),
                blur_radius: em(0.35),
                spread_radius: px(0.0),
                inset: false,
            }],
        );
    }

    let h = f.height;
    let lift = (h / H_UP).clamp(0.0, 1.0);

    // Shadow the cap casts on the well floor: spreads and fades as it rises.
    {
        let scale = lerp(0.92, 1.06, lift);
        let side = CAP * scale;
        let drop = 0.05 + h * 0.35;
        let off = GAP + (CAP - side) / 2.0;
        window.paint_drop_shadows(
            at(sx + off, sy + off + drop, side, side),
            Corners::all(em(0.7 * scale)),
            &[BoxShadow {
                color: black(0.7 * lerp(0.35, 1.0, lift)),
                offset: point(px(0.0), px(0.0)),
                blur_radius: em(0.3),
                spread_radius: px(0.0),
                inset: false,
            }],
        );
    }

    // Walls: from the cap's top down to the floor, clipped at the floor.
    let cap_r = em(0.7);
    let walls = at(sx + GAP, sy + GAP - h, CAP, CAP + h);
    let wall_top = mix(cap, 62.0, false);
    let wall_bottom = mix_srgb(wall_top, mix(cap, 40.0, false), (CAP + h) / (CAP + H_UP));
    paint_gradient(
        walls,
        cap_r,
        180.0,
        &[(0.0, wall_top), (1.0, wall_bottom)],
        window,
    );
    // Rounded corners turn away from the light at both sides.
    paint_gradient(
        walls,
        cap_r,
        90.0,
        &[
            (0.0, black(0.35)),
            (0.18, black(0.0)),
            (0.18, white(0.0)),
            (0.5, white(0.08)),
            (0.82, white(0.0)),
            (0.82, black(0.0)),
            (1.0, black(0.35)),
        ],
        window,
    );

    // Cap: the top face, carried up by the walls.
    let cap_box = at(sx + GAP, sy + GAP - h, CAP, CAP);
    paint_gradient(
        cap_box,
        cap_r,
        180.0,
        &[
            (0.0, mix(cap, 80.0, true)),
            (0.45, cap),
            (1.0, mix(cap, 86.0, false)),
        ],
        window,
    );
    window.paint_inset_shadows(
        cap_box,
        Corners::all(cap_r),
        &[
            shadow(0.0, 0.06 * f.em, 0.0, 0.0, mix(cap, 45.0, true), true),
            shadow(
                0.0,
                -0.08 * f.em,
                0.05 * f.em,
                0.0,
                mix(cap, 60.0, false),
                true,
            ),
        ],
    );

    // A shallow dish in the middle of the cap, lit from above.
    let dish = at(sx + GAP + 0.34, sy + GAP - h + 0.34, CAP - 0.68, CAP - 0.68);
    let dish_r = em(0.5);
    window.paint_drop_shadows(
        dish,
        Corners::all(dish_r),
        &[shadow(
            0.0,
            0.04 * f.em,
            0.0,
            0.0,
            mix(cap, 55.0, true),
            false,
        )],
    );
    paint_gradient(
        dish,
        dish_r,
        180.0,
        &[(0.0, mix(cap, 82.0, false)), (1.0, mix(cap, 92.0, true))],
        window,
    );
    window.paint_inset_shadows(
        dish,
        Corners::all(dish_r),
        &[shadow(
            0.0,
            0.07 * f.em,
            0.12 * f.em,
            0.0,
            mix(cap, 45.0, false),
            true,
        )],
    );

    // Inner lamp: a radial glow through the cap while latched on.
    let center = cap_box.center();
    if f.lit > 0.001 {
        window.with_content_mask(Some(ContentMask { bounds: cap_box }), |window| {
            let glow = |r: f32, sigma: f32, color: Hsla, window: &mut Window| {
                window.paint_drop_shadows(
                    Bounds::new(center - point(em(r), em(r)), size(em(2.0 * r), em(2.0 * r))),
                    Corners::all(em(r)),
                    &[BoxShadow {
                        color,
                        offset: point(px(0.0), px(0.0)),
                        blur_radius: em(sigma),
                        spread_radius: px(0.0),
                        inset: false,
                    }],
                );
            };
            glow(1.15, 0.45, rgb_a(0xffc8aa, 0.2 * f.lit), window);
            glow(0.55, 0.45, rgb_a(0xfff0e1, 0.6 * f.lit), window);
        });
    }

    // Power mark, with a soft white halo when lit or a dark lip when not.
    let side = 1.25 * f.em;
    let stroke = 2.4;
    paint_mark(
        center,
        side,
        stroke,
        point(px(0.0), em(0.04)),
        black(0.35 * (1.0 - f.lit)),
        window,
    );
    if f.lit > 0.001 {
        for (extra, alpha) in [(2.6, 0.12), (1.6, 0.18), (0.8, 0.28)] {
            paint_mark(
                center,
                side,
                stroke + extra,
                point(px(0.0), px(0.0)),
                white(alpha * f.lit),
                window,
            );
        }
    }
    paint_mark(
        center,
        side,
        stroke,
        point(px(0.0), px(0.0)),
        f.mark,
        window,
    );
}

impl RenderOnce for RealisticSwitch {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let default_checked = self.default_checked;
        let state =
            window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<SwitchState>| {
                let on = default_checked;
                SwitchState {
                    internal: on,
                    hovered: false,
                    pressing: false,
                    focus_visible: false,
                    height: HeightSpring::new(if on { H_LATCHED } else { H_UP }),
                    lit: Transition::new(if on { 1.0 } else { 0.0 }),
                    focus: cx.focus_handle().tab_stop(true),
                }
            });

        let now = Instant::now();
        let controlled = self.checked;
        let illuminated = self.illuminated;
        let disabled = self.disabled;
        let (checked, height, lit, animating) = state.update(cx, |s, _| {
            let checked = controlled.unwrap_or(s.internal);
            let hovering = s.hovered && !disabled;
            let target = if s.pressing {
                H_PRESSED
            } else if checked {
                if hovering { H_LATCHED_HOVER } else { H_LATCHED }
            } else if hovering {
                H_HOVER
            } else {
                H_UP
            };
            if s.height.target != target {
                s.height.step(now);
                s.height.target = target;
            }
            let height = s.height.step(now);
            s.lit.animate_to(
                if illuminated && checked { 1.0 } else { 0.0 },
                ms(500),
                Easing::STANDARD,
            );
            let animating = !s.height.settled() || s.lit.is_animating(now);
            (checked, height, s.lit.value(now), animating)
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

        let dark = match self.tone {
            RealisticSwitchTone::Dark => true,
            RealisticSwitchTone::Light => false,
            RealisticSwitchTone::Auto => matches!(
                window.appearance(),
                WindowAppearance::Dark | WindowAppearance::VibrantDark
            ),
        };
        let em = self.size.em();
        let frame = Frame {
            em,
            height,
            lit,
            color: self.color,
            mark: self.mark_color,
            dark,
            focus_visible,
        };

        let switch = div()
            .id(self.id.clone())
            .relative()
            .flex_none()
            .w(px(em * (SOCKET + 1.0)))
            .h(px(em * (SOCKET + 1.9)))
            .when(disabled, |el| el.opacity(0.5).cursor_not_allowed())
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| paint_switch(bounds, frame, window),
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            );

        let switch = wire(switch, &state, &focus, disabled);
        if disabled {
            return switch;
        }
        let on_change = self.on_change.clone();
        let click_state = state.clone();
        switch.on_click(move |_: &ClickEvent, window, cx| {
            let next = !checked;
            if controlled.is_none() {
                click_state.update(cx, |s, cx| {
                    s.internal = next;
                    cx.notify();
                });
            }
            if let Some(on_change) = on_change.as_ref() {
                on_change(next, window, cx);
            }
        })
    }
}
