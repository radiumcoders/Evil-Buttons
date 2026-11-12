//! MinecraftButton: a pixel stone menu button that cracks every few taps,
//! shatters into chips, and drops itself as a bobbing item you pick up to
//! respawn it. A pixel pickaxe follows the pointer and swings on every tap.

use gpui::{
    App, AppContext, Bounds, ClickEvent, ContentMask, Context, CursorStyle, ElementId, FocusHandle,
    Hsla, InteractiveElement, IntoElement, KeyDownEvent, KeyUpEvent, MouseButton, ParentElement,
    PathBuilder, Pixels, Point, RenderOnce, SharedString, StatefulInteractiveElement, Styled, Task,
    Window, canvas, deferred, div, point, prelude::FluentBuilder, px, quad, size,
    transparent_black,
};
use std::{cell::Cell, rc::Rc};

use crate::interaction::is_activation_key;
use crate::motion::{Duration, Easing, Instant, Timeline, keyframes};
use crate::surface::{ms, rgb_a};

type ClickHandler = Rc<dyn Fn(&ClickEvent, &mut Window, &mut App)>;
type CrackHandler = Rc<dyn Fn(u32, &mut Window, &mut App)>;
type EventHandler = Rc<dyn Fn(&mut Window, &mut App)>;
/// Crack order cached by (cols, rows, seed).
type CrackCache = ((i64, i64, u32), Rc<Vec<(i64, i64)>>);

/// A pixel stone menu button that cracks, breaks, and drops itself as an item.
///
/// Bring a pixel font (the docs use Pixelify Sans) with [`font_family`](Self::font_family).
///
/// ```ignore
/// MinecraftButton::new("singleplayer")
///     .font_family("Pixelify Sans")
///     .on_crack(|stage, _, _| println!("crack stage {stage}"))
///     .on_break(|_, _| println!("broken"))
/// ```
#[derive(IntoElement)]
pub struct MinecraftButton {
    id: ElementId,
    label: SharedString,
    taps_per_stage: u32,
    stages: u32,
    pickaxe: bool,
    respawn_after: Option<Duration>,
    font_family: Option<SharedString>,
    disabled: bool,
    on_click: Option<ClickHandler>,
    on_crack: Option<CrackHandler>,
    on_break: Option<EventHandler>,
    on_respawn: Option<EventHandler>,
}

impl MinecraftButton {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            label: "Singleplayer".into(),
            taps_per_stage: 5,
            stages: 4,
            pickaxe: true,
            respawn_after: None,
            font_family: None,
            disabled: false,
            on_click: None,
            on_crack: None,
            on_break: None,
            on_respawn: None,
        }
    }

    /// Button label. Defaults to "Singleplayer".
    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = label.into();
        self
    }

    /// Taps needed to advance one crack stage. Defaults to 5.
    pub fn taps_per_stage(mut self, taps: u32) -> Self {
        self.taps_per_stage = taps;
        self
    }

    /// Stages until it breaks (after `taps_per_stage * stages` taps). Defaults to 4.
    pub fn stages(mut self, stages: u32) -> Self {
        self.stages = stages;
        self
    }

    /// Draw a pixel pickaxe at the pointer that winds up on press and strikes
    /// on release. Defaults to `true`.
    pub fn pickaxe(mut self, pickaxe: bool) -> Self {
        self.pickaxe = pickaxe;
        self
    }

    /// Respawn automatically this long after breaking. By default it waits
    /// for the dropped item to be picked up.
    pub fn respawn_after(mut self, after: Duration) -> Self {
        self.respawn_after = Some(after);
        self
    }

    /// Font family for the label and the item tooltip, e.g. a pixel font.
    pub fn font_family(mut self, family: impl Into<SharedString>) -> Self {
        self.font_family = Some(family.into());
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    /// Fired on every tap, before it counts.
    pub fn on_click(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(handler));
        self
    }

    /// Fired when the crack deepens to a new stage (1-based).
    pub fn on_crack(mut self, handler: impl Fn(u32, &mut Window, &mut App) + 'static) -> Self {
        self.on_crack = Some(Rc::new(handler));
        self
    }

    /// Fired when the button finally breaks.
    pub fn on_break(mut self, handler: impl Fn(&mut Window, &mut App) + 'static) -> Self {
        self.on_break = Some(Rc::new(handler));
        self
    }

    /// Fired when the button comes back.
    pub fn on_respawn(mut self, handler: impl Fn(&mut Window, &mut App) + 'static) -> Self {
        self.on_respawn = Some(Rc::new(handler));
        self
    }
}

/// One texture pixel, in px. Everything snaps to this grid.
const PX: f32 = 3.0;
/// Stone tile size in texels.
const TILE: usize = 16;
const STONE_BASE: u32 = 0x7d7d7d;
const STONE_SHADES: [u32; 5] = [0x747474, 0x6a6a6a, 0x868686, 0x8f8f8f, 0x5f5f5f];

/// `mulberry32`, bit-for-bit with the JavaScript original.
struct Mulberry(u32);

impl Mulberry {
    fn next(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6d2b_79f5);
        let mut t = self.0;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        f64::from(t ^ (t >> 14)) / 4_294_967_296.0
    }
}

/// The seeded 16×16 stone texture: `None` is the base colour.
fn stone_texture() -> [[Option<u32>; TILE]; TILE] {
    let mut rand = Mulberry(1337);
    let mut tex = [[None; TILE]; TILE];
    for row in tex.iter_mut() {
        for texel in row.iter_mut() {
            if rand.next() < 0.45 {
                continue;
            }
            let shade = STONE_SHADES[(rand.next() * STONE_SHADES.len() as f64) as usize];
            *texel = Some(shade);
        }
    }
    tex
}

thread_local! {
    static STONE: [[Option<u32>; TILE]; TILE] = stone_texture();
}

fn js_round(x: f64) -> i64 {
    (x + 0.5).floor() as i64
}

/// Pixels of a crack network across a cols×rows grid, ordered so that any
/// prefix is a plausible earlier stage (every branch grows one step per round).
fn crack_order(cols: i64, rows: i64, seed: u32) -> Vec<(i64, i64)> {
    if cols < 2 || rows < 2 {
        return Vec::new();
    }
    struct Walker {
        x: f64,
        y: f64,
        a: f64,
        left: i64,
    }
    let mut rand = Mulberry(seed);
    let mut walkers = Vec::new();
    let origins = js_round(cols as f64 / 24.0).max(1);
    for i in 0..origins {
        let ox = ((i as f64 + 0.5) / origins as f64) * cols as f64 + (rand.next() - 0.5) * 4.0;
        let oy = rows as f64 / 2.0 + (rand.next() - 0.5) * 3.0;
        let branches = 4 + (rand.next() * 2.0).floor() as i64;
        for b in 0..branches {
            walkers.push(Walker {
                x: ox,
                y: oy,
                a: (b as f64 / branches as f64) * std::f64::consts::PI * 2.0 + rand.next() * 0.8,
                left: 7 + (rand.next() * 12.0).floor() as i64,
            });
        }
    }
    let mut seen = std::collections::HashSet::new();
    let mut order = Vec::new();
    while walkers.iter().any(|w| w.left > 0) {
        let count = walkers.len();
        for i in 0..count {
            if walkers[i].left <= 0 {
                continue;
            }
            let w = &mut walkers[i];
            w.left -= 1;
            w.a += (rand.next() - 0.5) * 1.1;
            w.x += w.a.cos();
            w.y += w.a.sin() * 0.75;
            let x = js_round(w.x);
            let y = js_round(w.y);
            if x < 0 || y < 0 || x >= cols || y >= rows {
                w.left = 0;
                continue;
            }
            if seen.insert(y * cols + x) {
                order.push((x, y));
            }
            if rand.next() < 0.12 && w.left > 3 {
                let (wx, wy, wa, wl) = (w.x, w.y, w.a, w.left);
                let turn = if rand.next() < 0.5 { -0.9 } else { 0.9 };
                walkers.push(Walker {
                    x: wx,
                    y: wy,
                    a: wa + turn,
                    left: wl / 2,
                });
            }
        }
    }
    order
}

// The diamond pickaxe sprite (16×16, head facing left), one char per texel.
const PICKAXE: [&str; 16] = [
    "................",
    "......aaaaa.....",
    "...bcadeedfa....",
    "...gheeaaaa.....",
    "...aedc.........",
    "..adegbc........",
    "..aea.ghc.......",
    "..aea..gbc......",
    "..ada...ghc.....",
    "..afa....gbc....",
    "...a......ghc...",
    "...........gbc..",
    "............ghc.",
    ".............gb.",
    "................",
    "................",
];

fn pickaxe_color(c: u8) -> Option<u32> {
    Some(match c {
        b'a' => 0x0e3f36,
        b'b' => 0x684e1e,
        b'c' => 0x493615,
        b'd' => 0x2bc7ac,
        b'e' => 0x27b29a,
        b'f' => 0x33ebcb,
        b'g' => 0x281e0b,
        b'h' => 0x896727,
        _ => return None,
    })
}

/// The pointer sits on the head's top-left corner (texel 3,2); swings pivot on the grip (14,13).
const HOTSPOT: (f32, f32) = (3.5 * PX, 2.5 * PX);
const GRIP: (f32, f32) = (14.5 * PX, 13.5 * PX);
const WIND_UP: f32 = 24.0;
const STRIKE: f32 = -28.0;
const SWING_EASE: Easing = Easing::CubicBezier(0.3, 0.0, 0.2, 1.0);

/// Tiny xorshift for chip scatter (Math.random in the original).
struct Rng(u32);

impl Rng {
    fn next(&mut self) -> f32 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        (x >> 8) as f32 / (1u32 << 24) as f32
    }
}

struct Chip {
    x0: f32,
    y0: f32,
    size: f32,
    color: u32,
    vx: f32,
    vy: f32,
    duration: f32,
    start: Instant,
}

impl Chip {
    /// Offset and opacity, stepped through 11 WAAPI keyframes snapped to the texel grid.
    fn at(&self, now: Instant) -> Option<(f32, f32, f32)> {
        let t = now.saturating_duration_since(self.start).as_secs_f32() / self.duration;
        if t >= 1.0 {
            return None;
        }
        let frame = |s: usize| {
            let tt = s as f32 / 10.0 * self.duration;
            let dx = (self.vx * tt / PX).round() * PX;
            let dy = ((self.vy * tt + 0.5 * 900.0 * tt * tt) / PX).round() * PX;
            let o = if s < 7 {
                1.0
            } else {
                1.0 - (s - 7) as f32 / 3.0
            };
            (dx, dy, o)
        };
        let pos = t * 10.0;
        let s = (pos.floor() as usize).min(9);
        let f = pos - s as f32;
        let (a, b) = (frame(s), frame(s + 1));
        Some((
            a.0 + (b.0 - a.0) * f,
            a.1 + (b.1 - a.1) * f,
            a.2 + (b.2 - a.2) * f,
        ))
    }
}

/// A WAAPI-style rotation animation with `fill: forwards`.
#[derive(Clone)]
struct Swing {
    timeline: Timeline,
    frames: Vec<(f32, f32)>,
}

impl Swing {
    fn angle(&self, now: Instant) -> f32 {
        keyframes(SWING_EASE.apply(self.timeline.progress(now)), &self.frames)
    }
}

#[derive(Clone, Copy, PartialEq)]
enum ItemPhase {
    Drop,
    Loop,
    PickUp,
}

struct McState {
    taps: u32,
    broken: bool,
    seed: u32,
    hovered: bool,
    pressed: bool,
    focus_visible: bool,
    swing: Option<Swing>,
    kick: Option<(Timeline, f32)>,
    respawned: Option<Timeline>,
    chips: Vec<Chip>,
    rng: Rng,
    item: Option<(ItemPhase, Instant)>,
    item_hovered: bool,
    /// The break came from the keyboard, so the focused item shows focus-visible.
    item_keyboard: bool,
    cracks: Option<CrackCache>,
    bounds: Rc<Cell<Option<Bounds<Pixels>>>>,
    focus: FocusHandle,
    item_focus: FocusHandle,
    task: Option<Task<()>>,
}

impl McState {
    fn cracks(&mut self, cols: i64, rows: i64) -> Rc<Vec<(i64, i64)>> {
        let key = (cols, rows, self.seed);
        if let Some((k, order)) = &self.cracks
            && *k == key
        {
            return order.clone();
        }
        let order = Rc::new(crack_order(cols, rows, self.seed));
        self.cracks = Some((key, order.clone()));
        order
    }

    fn swing_to(&mut self, frames: &[f32], duration: Duration) {
        let now = Instant::now();
        let from = self.swing.as_ref().map_or(0.0, |s| s.angle(now));
        let mut list = vec![(0.0, from)];
        if frames.len() == 1 {
            list.push((1.0, frames[0]));
        } else {
            // Explicit keyframes start from their first value.
            list.clear();
            list.push((0.0, frames[0]));
            list.push((0.35, frames[1]));
            list.push((1.0, frames[2]));
        }
        self.swing = Some(Swing {
            timeline: Timeline::start(duration),
            frames: list,
        });
    }

    fn spawn_chips(&mut self, origin: (f32, f32), area: (f32, f32), count: usize, force: f32) {
        let now = Instant::now();
        for _ in 0..count {
            let r = &mut self.rng;
            let size = PX * (1.0 + (r.next() * 2.0).floor());
            let color = if r.next() < 0.3 {
                STONE_BASE
            } else {
                STONE_SHADES[((r.next() * 5.0) as usize).min(4)]
            };
            let x0 = origin.0 + (r.next() - 0.5) * area.0;
            let y0 = origin.1 + (r.next() - 0.5) * area.1;
            let vx = (r.next() - 0.5) * 2.0 * force;
            let vy = -(0.4 + r.next()) * force;
            let duration = (450.0 + r.next() * 450.0) / 1000.0;
            self.chips.push(Chip {
                x0,
                y0,
                size,
                color,
                vx,
                vy,
                duration,
                start: now,
            });
        }
    }
}

fn shade(hex: u32, brightness: f32) -> Hsla {
    let mut c = gpui::rgb(hex);
    c.r *= brightness;
    c.g *= brightness;
    c.b *= brightness;
    c.into()
}

fn rect(window: &mut Window, b: Bounds<Pixels>, color: impl Into<gpui::Background>) {
    window.paint_quad(quad(
        b,
        Corners0::ZERO,
        color,
        px(0.0),
        transparent_black(),
        Default::default(),
    ));
}

struct Corners0;
impl Corners0 {
    const ZERO: gpui::Corners<Pixels> = gpui::Corners {
        top_left: Pixels::ZERO,
        top_right: Pixels::ZERO,
        bottom_right: Pixels::ZERO,
        bottom_left: Pixels::ZERO,
    };
}

fn at(o: Point<Pixels>, x: f32, y: f32, w: f32, h: f32) -> Bounds<Pixels> {
    Bounds::new(o + point(px(x), px(y)), size(px(w), px(h)))
}

/// Tiles the stone texture over `bounds` (background-size 48px, from the top left).
fn paint_stone(bounds: Bounds<Pixels>, brightness: f32, window: &mut Window) {
    rect(window, bounds, shade(STONE_BASE, brightness));
    let (w, h) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
    let cols = (w / PX).ceil() as usize;
    let rows = (h / PX).ceil() as usize;
    window.with_content_mask(Some(ContentMask { bounds }), |window| {
        STONE.with(|tex| {
            for y in 0..rows {
                for x in 0..cols {
                    if let Some(c) = tex[y % TILE][x % TILE] {
                        let b = at(bounds.origin, x as f32 * PX, y as f32 * PX, PX, PX);
                        rect(window, b, shade(c, brightness));
                    }
                }
            }
        });
    });
}

#[derive(Clone)]
struct Face {
    lit: bool,
    pressed: bool,
    brightness: f32,
    cracks: Rc<Vec<(i64, i64)>>,
    visible_cracks: usize,
    grid: (i64, i64),
}

fn paint_face(bounds: Bounds<Pixels>, f: &Face, window: &mut Window) {
    let o = bounds.origin;
    let (w, h) = (bounds.size.width.as_f32(), bounds.size.height.as_f32());
    // 0 0 0 3px outline: black, or white when hovered, focused or pressed.
    let ring = if f.lit { 0xffffff } else { 0x000000 };
    rect(
        window,
        at(o, -3.0, -3.0, w + 6.0, h + 6.0),
        shade(ring, 1.0),
    );
    paint_stone(bounds, f.brightness, window);
    // Bevel: light top-left, dark bottom-right (flipped while pressed).
    // The first CSS inset shadow paints on top, so it goes last here.
    let light = |a| rgb_a(0xffffff, a);
    let dark = |a| rgb_a(0x000000, a);
    let (top_left, bottom_right) = if f.pressed {
        (dark(0.38), light(0.2))
    } else {
        (light(0.32), dark(0.38))
    };
    let (under, over) = (bottom_right, top_left);
    rect(window, at(o, 0.0, h - PX, w, PX), under);
    rect(window, at(o, w - PX, 0.0, PX, h), under);
    rect(window, at(o, 0.0, 0.0, w, PX), over);
    rect(window, at(o, 0.0, 0.0, PX, h), over);

    // Cracks, drawn on an SVG-like cols×rows grid stretched over the button.
    if f.visible_cracks > 0 {
        let (cols, rows) = f.grid;
        let (cw, ch) = (w / cols as f32, h / rows as f32);
        for &(x, y) in f.cracks.iter().take(f.visible_cracks) {
            let b = at(o, x as f32 * cw, (y + 1) as f32 * ch, cw, ch);
            window.with_content_mask(Some(ContentMask { bounds }), |window| {
                rect(window, b, rgb_a(0xffffff, 0.14));
            });
        }
        for &(x, y) in f.cracks.iter().take(f.visible_cracks) {
            rect(
                window,
                at(o, x as f32 * cw, y as f32 * ch, cw, ch),
                rgb_a(0x101010, 0.82),
            );
        }
    }
}

/// Paints the pickaxe with its top-left at `origin`, rotated `angle` degrees
/// clockwise around the grip, with its 2px drop shadow.
fn paint_pickaxe(origin: Point<Pixels>, angle: f32, window: &mut Window) {
    let (sin, cos) = angle.to_radians().sin_cos();
    let rot = |x: f32, y: f32| {
        let (dx, dy) = (x - GRIP.0, y - GRIP.1);
        origin
            + point(
                px(GRIP.0 + dx * cos - dy * sin),
                px(GRIP.1 + dx * sin + dy * cos),
            )
    };
    let texel = |b: &mut PathBuilder, x: f32, y: f32| {
        b.move_to(rot(x, y));
        b.line_to(rot(x + PX, y));
        b.line_to(rot(x + PX, y + PX));
        b.line_to(rot(x, y + PX));
        b.close();
    };
    let opaque: Vec<(usize, usize, u8)> = PICKAXE
        .iter()
        .enumerate()
        .flat_map(|(y, row)| {
            row.bytes()
                .enumerate()
                .filter(|(_, c)| *c != b'.')
                .map(move |(x, c)| (x, y, c))
        })
        .collect();
    // drop-shadow(2px 2px 0 rgb(0 0 0 / 0.25)), in the sprite's own space.
    let mut b = PathBuilder::fill();
    for &(x, y, _) in &opaque {
        texel(&mut b, x as f32 * PX + 2.0, y as f32 * PX + 2.0);
    }
    if let Ok(path) = b.build() {
        window.paint_path(path, rgb_a(0x000000, 0.25));
    }
    for key in b'a'..=b'h' {
        let mut b = PathBuilder::fill();
        let mut any = false;
        for &(x, y, c) in &opaque {
            if c == key {
                texel(&mut b, x as f32 * PX, y as f32 * PX);
                any = true;
            }
        }
        if any && let (Ok(path), Some(color)) = (b.build(), pickaxe_color(key)) {
            window.paint_path(path, shade(color, 1.0));
        }
    }
}

/// The dropped item: an 8×8-texel stone block (24px) with a 2px outline and
/// bevel, turned `turn` degrees around Y under a 240px perspective.
fn paint_item(center: Point<Pixels>, turn: f32, scale: f32, outline: u32, window: &mut Window) {
    let (sin, cos) = turn.to_radians().sin_cos();
    let project = |x: f32, y: f32| {
        let (x, y) = (x * scale, y * scale);
        let z = -x * sin;
        let k = 240.0 / (240.0 - z);
        center + point(px(x * cos * k), px(y * k))
    };
    let quad_path = |x0: f32, y0: f32, x1: f32, y1: f32| {
        let mut b = PathBuilder::fill();
        b.move_to(project(x0, y0));
        b.line_to(project(x1, y0));
        b.line_to(project(x1, y1));
        b.line_to(project(x0, y1));
        b.close();
        b.build().ok()
    };
    let fill = |window: &mut Window, x0, y0, x1, y1, color: Hsla| {
        if let Some(p) = quad_path(x0, y0, x1, y1) {
            window.paint_path(p, color);
        }
    };
    if cos.abs() < 0.02 {
        return;
    }
    fill(window, -14.0, -14.0, 14.0, 14.0, shade(outline, 1.0));
    fill(window, -12.0, -12.0, 12.0, 12.0, shade(STONE_BASE, 1.0));
    STONE.with(|tex| {
        for (ty, row) in tex.iter().take(8).enumerate() {
            for (tx, texel) in row.iter().take(8).enumerate() {
                if let Some(c) = texel {
                    let (x, y) = (-12.0 + tx as f32 * PX, -12.0 + ty as f32 * PX);
                    fill(window, x, y, x + PX, y + PX, shade(*c, 1.0));
                }
            }
        }
    });
    let dark = rgb_a(0x000000, 0.38);
    let light = rgb_a(0xffffff, 0.32);
    fill(window, -12.0, 10.0, 12.0, 12.0, dark);
    fill(window, 10.0, -12.0, 12.0, 12.0, dark);
    fill(window, -12.0, -12.0, 12.0, -10.0, light);
    fill(window, -12.0, -12.0, -10.0, 12.0, light);
}

/// `tracking-wide`, in em.
const TRACKING: f32 = 0.025;

/// The label, glyph by glyph (GPUI text has no letter-spacing), with its
/// `text-shadow: 3px 3px 0 #3f3f3f`, centred in `bounds`.
fn paint_label(
    text: &SharedString,
    bounds: Bounds<Pixels>,
    scale: f32,
    color: u32,
    window: &mut Window,
    cx: &mut App,
) {
    let size = 18.0 * scale;
    let font = window.text_style().font();
    let run = gpui::TextRun {
        len: text.len(),
        font,
        color: gpui::black(),
        background_color: None,
        underline: None,
        strikethrough: None,
    };
    let line = window
        .text_system()
        .shape_line(text.clone(), px(size), &[run], None);
    let spacing = TRACKING * size;
    let glyphs = line.runs.iter().map(|r| r.glyphs.len()).sum::<usize>();
    let width = line.width.as_f32() + spacing * glyphs as f32;
    let left = bounds.center().x - px(width / 2.0);
    // leading-none: the line box is exactly the font size.
    let top = bounds.center().y - px(size / 2.0);
    let baseline = top + (px(size) - line.ascent - line.descent) / 2.0 + line.ascent;
    for (offset, hex) in [(3.0 * scale, 0x3f3f3f), (0.0, color)] {
        let mut i = 0;
        for run in &line.runs {
            for glyph in &run.glyphs {
                let at = point(
                    left + glyph.position.x + px(spacing * i as f32 + offset),
                    baseline + glyph.position.y + px(offset),
                );
                i += 1;
                window
                    .paint_glyph(at, run.font_id, glyph.id, px(size), shade(hex, 1.0))
                    .ok();
            }
        }
    }
    let _ = cx;
}

fn step_value(t: f32, steps: f32) -> f32 {
    // CSS `steps(n, end)`.
    (t * steps).floor() / steps
}

impl RenderOnce for MinecraftButton {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state = window.use_keyed_state(self.id.clone(), cx, |_, cx: &mut Context<McState>| {
            McState {
                taps: 0,
                broken: false,
                seed: 7,
                hovered: false,
                pressed: false,
                focus_visible: false,
                swing: None,
                kick: None,
                respawned: None,
                chips: Vec::new(),
                rng: Rng(0x9e37_79b9),
                item: None,
                item_hovered: false,
                item_keyboard: false,
                cracks: None,
                bounds: Rc::new(Cell::new(None)),
                focus: cx.focus_handle().tab_stop(true),
                item_focus: cx.focus_handle().tab_stop(true),
                task: None,
            }
        });

        let now = Instant::now();
        let per_stage = self.taps_per_stage.max(1);
        let stage_count = self.stages.max(1);
        // The last stage is the break itself, so the visible crack levels stop one short.
        let crack_levels = stage_count.saturating_sub(1).max(1);
        let disabled = self.disabled;

        let bounds_cell = state.read(cx).bounds.clone();
        let measured = bounds_cell.get();
        let (w, h) = measured.map_or((224.0, 48.0), |b| {
            (b.size.width.as_f32(), b.size.height.as_f32())
        });
        let grid = ((w / PX).ceil() as i64, (h / PX).ceil() as i64);

        let snapshot = state.update(cx, |s, _| {
            s.chips.retain(|c| c.at(now).is_some());
            if let Some((t, _)) = s.kick
                && t.is_done(now)
            {
                s.kick = None;
            }
            if let Some(t) = s.respawned
                && t.is_done(now)
            {
                s.respawned = None;
            }
            if let Some((ItemPhase::Drop, start)) = s.item
                && now.saturating_duration_since(start) >= ms(360)
            {
                s.item = Some((ItemPhase::Loop, start + ms(360)));
            }
            let level = (s.taps / per_stage).min(crack_levels);
            let cracks = s.cracks(grid.0, grid.1);
            let visible = ((cracks.len() as f32 * level as f32) / crack_levels as f32).round();
            let swing_animating = s.swing.as_ref().is_some_and(|w| !w.timeline.is_done(now));
            (
                s.broken,
                s.hovered,
                s.pressed,
                (s.focus_visible || window.last_input_was_keyboard()) && s.focus.is_focused(window),
                s.swing.as_ref().map_or(0.0, |w| w.angle(now)),
                s.kick,
                s.respawned.map(|t| t.progress(now)),
                cracks,
                visible as usize,
                s.item,
                (
                    s.item_hovered,
                    s.item.is_some() && s.item_keyboard && s.item_focus.is_focused(window),
                ),
                !s.chips.is_empty() || swing_animating || s.kick.is_some() || s.respawned.is_some(),
                s.focus.clone(),
                s.item_focus.clone(),
            )
        });
        let (
            broken,
            hovered,
            pressed,
            focus_visible,
            angle,
            kick,
            respawn_t,
            cracks,
            visible_cracks,
            item,
            item_lit,
            busy,
            focus,
            item_focus,
        ) = snapshot;
        if busy || item.is_some() {
            window.request_animation_frame();
        }

        let aiming = self.pickaxe && hovered && !broken && !disabled;
        let lit = !disabled && (hovered || focus_visible || pressed);
        let reduce_press = pressed && !disabled;

        // Kick: translate keyframes 0 → (-k, k/2) → (k, 0) → 0 under steps(4, end).
        let (kick_x, kick_y) = kick.map_or((0.0, 0.0), |(t, k)| {
            let p = step_value(t.progress(now), 4.0);
            (
                keyframes(
                    p,
                    &[(0.0, 0.0), (1.0 / 3.0, -k), (2.0 / 3.0, k), (1.0, 0.0)],
                ),
                keyframes(
                    p,
                    &[
                        (0.0, 0.0),
                        (1.0 / 3.0, k / 2.0),
                        (2.0 / 3.0, 0.0),
                        (1.0, 0.0),
                    ],
                ),
            )
        });
        // Respawn: scale(0.9) → 1 under steps(3, end).
        let scale = respawn_t.map_or(1.0, |t| 0.9 + 0.1 * step_value(t, 3.0));
        let brightness = if disabled { 0.75 } else { 1.0 };
        let text_color = if disabled {
            0xa0a0a0
        } else if lit {
            0xffffa0
        } else {
            0xe0e0e0
        };
        let face = Face {
            lit,
            pressed: reduce_press,
            brightness,
            cracks,
            visible_cracks,
            grid,
        };
        let label = self.label.clone();
        let font = self.font_family.clone();

        let mut button = div()
            .id(("mc-button", 0usize))
            .relative()
            .flex()
            .flex_none()
            .h(px(48.0))
            .min_w(px(224.0))
            .px(px(24.0))
            .items_center()
            .justify_center()
            .top(px(kick_y + if reduce_press { PX } else { 0.0 }))
            .left(px(kick_x))
            .when(broken, |el| el.opacity(0.0))
            .child(
                canvas(
                    move |bounds, _, _| bounds_cell.set(Some(bounds)),
                    move |bounds, _, window, _| {
                        let b = crate::surface::scale_bounds(bounds, scale);
                        paint_face(b, &face, window);
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            )
            // Lays out the label; the layers below draw it (with its 3px shadow).
            .child(
                div()
                    .text_size(px(18.0))
                    .line_height(px(18.0))
                    .text_color(transparent_black())
                    .whitespace_nowrap()
                    // tracking-wide: 0.025em after every letter.
                    .pr(px(TRACKING * 18.0 * label.chars().count() as f32))
                    .child(label.clone()),
            )
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, cx| {
                        let b = crate::surface::scale_bounds(bounds, scale);
                        paint_label(&label, b, scale, text_color, window, cx);
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            );

        if !disabled && !broken {
            button = self.wire_button(button, &state, &focus, aiming);
        } else if disabled {
            button = button.cursor_not_allowed();
        }

        // Chips layer, above the button and free to fly outside it.
        let chips_state = state.clone();
        let chips = canvas(
            |_, _, _| {},
            move |bounds, _, window, cx| {
                let now = Instant::now();
                let s = chips_state.read(cx);
                for chip in &s.chips {
                    let Some((dx, dy, o)) = chip.at(now) else {
                        continue;
                    };
                    let b = at(
                        bounds.origin,
                        chip.x0 + dx,
                        chip.y0 + dy,
                        chip.size,
                        chip.size,
                    );
                    let mut c = shade(chip.color, 1.0);
                    c.a = o;
                    rect(window, b, c);
                    // inset -1px -1px 0 rgb(0 0 0 / 0.25)
                    let shadow = rgb_a(0x000000, 0.25 * o);
                    let (x, y, sz) = (chip.x0 + dx, chip.y0 + dy, chip.size);
                    rect(window, at(bounds.origin, x, y + sz - 1.0, sz, 1.0), shadow);
                    rect(
                        window,
                        at(bounds.origin, x + sz - 1.0, y, 1.0, sz - 1.0),
                        shadow,
                    );
                }
            },
        )
        .absolute()
        .top_0()
        .left_0()
        .size_full();

        let mut wrapper = div()
            .id(self.id.clone())
            .relative()
            .flex()
            .flex_none()
            .when_some(font, |el, f| el.font_family(f))
            .child(button)
            .child(chips);

        if let Some((phase, start)) = item {
            let (hovered, focus_ring) = item_lit;
            wrapper = wrapper.child(self.item(
                &state,
                &item_focus,
                (phase, start),
                (hovered || focus_ring, focus_ring),
                now,
            ));
        }

        if aiming {
            wrapper = wrapper.child(
                deferred(
                    canvas(
                        |_, _, _| {},
                        move |_, _, window, _| {
                            let mouse = window.mouse_position();
                            let origin = mouse - point(px(HOTSPOT.0), px(HOTSPOT.1));
                            paint_pickaxe(origin, angle, window);
                        },
                    )
                    .absolute()
                    .size_0(),
                )
                .with_priority(1),
            );
        }
        wrapper
    }
}

impl MinecraftButton {
    fn wire_button(
        &self,
        button: gpui::Stateful<gpui::Div>,
        state: &gpui::Entity<McState>,
        focus: &FocusHandle,
        aiming: bool,
    ) -> gpui::Stateful<gpui::Div> {
        let hover = state.clone();
        let mv = state.clone();
        let down = state.clone();
        let up = state.clone();
        let up_out = state.clone();
        let key_down = state.clone();
        let key_up = state.clone();
        let click = state.clone();
        let focus_for_down = focus.clone();
        let per_stage = self.taps_per_stage.max(1);
        let stage_count = self.stages.max(1);
        let break_at = per_stage * stage_count;
        let crack_levels = stage_count.saturating_sub(1).max(1);
        let respawn_after = self.respawn_after;
        let on_click = self.on_click.clone();
        let on_crack = self.on_crack.clone();
        let on_break = self.on_break.clone();
        let on_respawn = self.on_respawn.clone();
        let pickaxe = self.pickaxe;
        button
            .track_focus(focus)
            .cursor(if aiming {
                CursorStyle::Crosshair
            } else {
                CursorStyle::PointingHand
            })
            .on_hover(move |hovered, _, cx| {
                hover.update(cx, |s, cx| {
                    s.hovered = *hovered;
                    cx.notify();
                });
            })
            // The pickaxe follows the pointer.
            .on_mouse_move(move |_, _, cx| {
                mv.update(cx, |_, cx| cx.notify());
            })
            .on_mouse_down(MouseButton::Left, move |_, window, cx| {
                window.focus(&focus_for_down, cx);
                down.update(cx, |s, cx| {
                    s.pressed = true;
                    s.focus_visible = false;
                    if pickaxe && s.hovered {
                        s.swing_to(&[WIND_UP], ms(90));
                    }
                    cx.notify();
                });
            })
            .on_mouse_up(MouseButton::Left, move |_, _, cx| {
                up.update(cx, |s, cx| {
                    s.pressed = false;
                    cx.notify();
                });
            })
            .on_mouse_up_out(MouseButton::Left, move |_, _, cx| {
                up_out.update(cx, |s, cx| {
                    s.pressed = false;
                    cx.notify();
                });
            })
            .on_key_down(move |e: &KeyDownEvent, _, cx| {
                if !e.is_held && is_activation_key(e.keystroke.key.as_str()) {
                    key_down.update(cx, |s, cx| {
                        s.focus_visible = true;
                        s.pressed = true;
                        cx.notify();
                    });
                }
            })
            .on_key_up(move |e: &KeyUpEvent, _, cx| {
                if is_activation_key(e.keystroke.key.as_str()) {
                    key_up.update(cx, |s, cx| {
                        s.pressed = false;
                        cx.notify();
                    });
                }
            })
            .on_click(move |e, window, cx| {
                if let Some(handler) = on_click.as_ref() {
                    handler(e, window, cx);
                }
                let handle = window.window_handle();
                let respawned = on_respawn.clone();
                let outcome = click.update(cx, |s, cx| {
                    if s.broken {
                        return None;
                    }
                    let level = (s.taps / per_stage).min(crack_levels);
                    let next = s.taps + 1;
                    let next_level = (next / per_stage).min(crack_levels);
                    let breaking = next >= break_at;
                    let deepened = !breaking && next_level > level;
                    // Strike from wherever the wind-up left the pickaxe.
                    if pickaxe && s.hovered {
                        s.swing_to(&[WIND_UP, STRIKE, 0.0], ms(240));
                    }
                    if let Some(b) = s.bounds.get() {
                        let (w, h) = (b.size.width.as_f32(), b.size.height.as_f32());
                        if breaking {
                            let count = (w / 3.0).round().min(90.0) as usize;
                            s.spawn_chips((w / 2.0, h / 2.0), (w, h), count, 260.0);
                        } else {
                            let origin = if e.is_keyboard() {
                                (w / 2.0, h / 2.0)
                            } else {
                                let p = e.position() - b.origin;
                                (p.x.as_f32(), p.y.as_f32())
                            };
                            let (count, force) = if deepened { (10, 200.0) } else { (4, 140.0) };
                            s.spawn_chips(origin, (6.0, 6.0), count, force);
                            let (dur, k) = if deepened { (180, 3.0) } else { (110, 1.5) };
                            s.kick = Some((Timeline::start(ms(dur)), k));
                        }
                    }
                    s.taps = next;
                    if breaking {
                        s.broken = true;
                        s.pressed = false;
                        s.item = Some((ItemPhase::Drop, Instant::now()));
                        s.item_keyboard = e.is_keyboard();
                        s.task = respawn_after.map(|after| {
                            cx.spawn(async move |this, cx| {
                                cx.background_executor().timer(after).await;
                                let Ok(done) = this.update(cx, |s, cx| {
                                    cx.notify();
                                    s.broken.then(|| respawn(s))
                                }) else {
                                    return;
                                };
                                if let (Some(()), Some(h)) = (done, respawned) {
                                    cx.update_window(handle, |_, window, cx| h(window, cx)).ok();
                                }
                            })
                        });
                    }
                    cx.notify();
                    Some((
                        deepened.then_some(next_level),
                        breaking,
                        s.item_focus.clone(),
                    ))
                });
                let Some((crack, breaking, item_focus)) = outcome else {
                    return;
                };
                if let (Some(stage), Some(h)) = (crack, on_crack.as_ref()) {
                    h(stage, window, cx);
                }
                if breaking {
                    window.focus(&item_focus, cx);
                    if let Some(h) = on_break.as_ref() {
                        h(window, cx);
                    }
                }
            })
    }

    fn item(
        &self,
        state: &gpui::Entity<McState>,
        item_focus: &FocusHandle,
        (phase, start): (ItemPhase, Instant),
        // (show the tooltip, draw the focus-visible outline)
        (lit, focus_ring): (bool, bool),
        now: Instant,
    ) -> impl IntoElement {
        let elapsed = now.saturating_duration_since(start).as_secs_f32();
        // Body transform: (translateY, scale, rotateY degrees, opacity).
        let (y, scale, turn, opacity) = match phase {
            ItemPhase::Drop => {
                let p = Easing::EASE_OUT.apply((elapsed / 0.36).min(1.0));
                (
                    keyframes(p, &[(0.0, 0.0), (0.4, -18.0), (1.0, 0.0)]),
                    keyframes(p, &[(0.0, 0.5), (0.4, 0.9), (1.0, 1.0)]),
                    0.0,
                    1.0,
                )
            }
            ItemPhase::Loop => {
                let p = (elapsed % 2.6) / 2.6;
                (
                    keyframes(p, &[(0.0, 0.0), (0.5, -5.0), (1.0, 0.0)]),
                    1.0,
                    360.0 * p,
                    1.0,
                )
            }
            ItemPhase::PickUp => {
                let p = Easing::CubicBezier(0.42, 0.0, 1.0, 1.0).apply((elapsed / 0.14).min(1.0));
                (-28.8 * p, 1.0 - 0.6 * p, 0.0, 1.0 - p)
            }
        };
        let outline = if focus_ring { 0xffffff } else { 0x000000 };
        let label = self.label.clone();
        let pick = state.clone();
        let hover = state.clone();
        let on_respawn = self.on_respawn.clone();
        let picking = phase == ItemPhase::PickUp;
        div()
            .id("mc-item")
            .absolute()
            .top(relative_half())
            .left(relative_half())
            .ml(px(-24.0))
            .mt(px(-24.0))
            .size(px(48.0))
            .track_focus(item_focus)
            .cursor_pointer()
            .child(
                // Ground shadow.
                div()
                    .absolute()
                    .bottom(px(4.0))
                    .left(px(14.0))
                    .w(px(20.0))
                    .h(px(4.0))
                    .bg(rgb_a(0x000000, 0.3)),
            )
            .child(
                canvas(
                    |_, _, _| {},
                    move |bounds, _, window, _| {
                        let c = bounds.center() + point(px(0.0), px(y));
                        paint_item(c, turn, scale, outline, window);
                    },
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full()
                .opacity(opacity),
            )
            .when(lit && !picking, |el| {
                // Item tooltip: near-black purple panel with a violet frame.
                el.child(
                    div()
                        .absolute()
                        .bottom(px(52.0))
                        .left(px(-200.0))
                        .right(px(-200.0))
                        .flex()
                        .justify_center()
                        .child(
                            div()
                                .relative()
                                .border(px(2.0))
                                .border_color(rgb_a(0x100010, 0.95))
                                .bg(rgb_a(0x100010, 0.95))
                                .px(px(6.0))
                                .py(px(4.0))
                                .text_size(px(14.0))
                                .line_height(px(14.0))
                                .whitespace_nowrap()
                                .child(
                                    div()
                                        .absolute()
                                        .top_0()
                                        .left_0()
                                        .size_full()
                                        .border(px(1.0))
                                        .border_color(rgb_a(0x5000ff, 0.5)),
                                )
                                .child(
                                    div()
                                        .relative()
                                        .child(
                                            div()
                                                .absolute()
                                                .top(px(2.0))
                                                .left(px(2.0))
                                                .text_color(shade(0x3f3f3f, 1.0))
                                                .child(label.clone()),
                                        )
                                        .child(
                                            div()
                                                .relative()
                                                .text_color(gpui::white())
                                                .child(label.clone()),
                                        ),
                                ),
                        ),
                )
            })
            .on_hover(move |hovered, _, cx| {
                hover.update(cx, |s, cx| {
                    s.item_hovered = *hovered;
                    cx.notify();
                });
            })
            .on_click(move |_, window, cx| {
                let pick2 = pick.clone();
                let on_respawn = on_respawn.clone();
                let started = pick.update(cx, |s, cx| {
                    if !matches!(s.item, Some((ItemPhase::Drop | ItemPhase::Loop, _))) {
                        return false;
                    }
                    s.item = Some((ItemPhase::PickUp, Instant::now()));
                    cx.notify();
                    true
                });
                if !started {
                    return;
                }
                let handle = window.window_handle();
                let focus = pick.read(cx).focus.clone();
                cx.spawn(async move |cx| {
                    cx.background_executor().timer(ms(140)).await;
                    cx.update_window(handle, |_, window, cx| {
                        pick2.update(cx, |s, cx| {
                            respawn(s);
                            cx.notify();
                        });
                        window.focus(&focus, cx);
                        if let Some(h) = on_respawn.as_ref() {
                            h(window, cx);
                        }
                    })
                    .ok();
                })
                .detach();
            })
    }
}

fn relative_half() -> gpui::DefiniteLength {
    gpui::relative(0.5)
}

fn respawn(s: &mut McState) {
    s.broken = false;
    s.taps = 0;
    s.seed += 1;
    s.item = None;
    s.item_hovered = false;
    s.swing = None;
    s.task = None;
    s.respawned = Some(Timeline::start(ms(180)));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mulberry_matches_javascript() {
        let mut r = Mulberry(1337);
        assert_eq!(r.next(), 0.1844118325971067);
        assert_eq!(r.next(), 0.18998925131745636);
    }

    #[test]
    fn cracks_match_javascript() {
        // crackOrder(75, 16, 7) in the React original.
        let order = crack_order(75, 16, 7);
        assert_eq!(order.len(), 201);
        assert_eq!(
            &order[..6],
            &[(12, 7), (11, 7), (10, 7), (10, 6), (11, 6), (38, 7)]
        );
        assert_eq!(&order[198..], &[(28, 7), (27, 7), (28, 6)]);
    }

    #[test]
    fn cracks_grow_and_stay_in_bounds() {
        let order = crack_order(75, 16, 7);
        assert!(!order.is_empty());
        assert!(
            order
                .iter()
                .all(|&(x, y)| (0..75).contains(&x) && (0..16).contains(&y))
        );
    }
}
