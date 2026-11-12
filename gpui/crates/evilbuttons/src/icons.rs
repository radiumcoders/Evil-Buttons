//! Stroke icons painted straight onto the scene, so the crate needs no asset
//! source (GPUI's `svg()` element reads files through one). Coordinates are
//! authored on the usual 24×24 (or 16×16) icon grid and scaled at paint time.

use gpui::{Bounds, Hsla, PathBuilder, PathStyle, Pixels, Point, StrokeOptions, Window, point, px};
use lyon::tessellation::{LineCap, LineJoin};

/// Which glyph to paint.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Icon {
    /// `m6 4 4 4-4 4` on a 16 grid.
    ChevronRight,
    /// `M20 6 9 17l-5-5` on a 24 grid.
    Check,
    /// Two overlapping rounded squares on a 24 grid.
    Copy,
}

impl Icon {
    fn grid(self) -> f32 {
        match self {
            Self::ChevronRight => 16.0,
            _ => 24.0,
        }
    }

    fn trace(self, b: &mut PathBuilder) {
        let p = |x: f32, y: f32| point(px(x), px(y));
        match self {
            Self::ChevronRight => {
                b.move_to(p(6.0, 4.0));
                b.line_to(p(10.0, 8.0));
                b.line_to(p(6.0, 12.0));
            }
            Self::Check => {
                b.move_to(p(20.0, 6.0));
                b.line_to(p(9.0, 17.0));
                b.line_to(p(4.0, 12.0));
            }
            Self::Copy => {
                // rect x=8 y=8 w=12 h=12 rx=2
                let r = p(2.0, 2.0);
                b.move_to(p(10.0, 8.0));
                b.line_to(p(18.0, 8.0));
                b.arc_to(r, px(0.0), false, true, p(20.0, 10.0));
                b.line_to(p(20.0, 18.0));
                b.arc_to(r, px(0.0), false, true, p(18.0, 20.0));
                b.line_to(p(10.0, 20.0));
                b.arc_to(r, px(0.0), false, true, p(8.0, 18.0));
                b.line_to(p(8.0, 10.0));
                b.arc_to(r, px(0.0), false, true, p(10.0, 8.0));
                b.close();
                // M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2
                b.move_to(p(16.0, 8.0));
                b.line_to(p(16.0, 6.0));
                b.arc_to(r, px(0.0), false, false, p(14.0, 4.0));
                b.line_to(p(6.0, 4.0));
                b.arc_to(r, px(0.0), false, false, p(4.0, 6.0));
                b.line_to(p(4.0, 14.0));
                b.arc_to(r, px(0.0), false, false, p(6.0, 16.0));
                b.line_to(p(8.0, 16.0));
            }
        }
    }
}

/// Paints `icon` centred in `bounds`, at `scale` (1.0 = fills the bounds).
/// `stroke` is in icon-grid units, like the SVG `strokeWidth` attribute.
pub(crate) fn paint_icon(
    icon: Icon,
    bounds: Bounds<Pixels>,
    stroke: f32,
    scale: f32,
    color: Hsla,
    window: &mut Window,
) {
    if scale <= 0.001 || color.a <= 0.001 {
        return;
    }
    let side = bounds.size.width.min(bounds.size.height);
    let unit = side / px(icon.grid()) * scale;
    let options = StrokeOptions::default()
        .with_line_width(stroke * unit)
        .with_line_cap(LineCap::Round)
        .with_line_join(LineJoin::Round);
    let mut builder = PathBuilder::stroke(px(stroke * unit)).with_style(PathStyle::Stroke(options));
    icon.trace(&mut builder);
    let half = icon.grid() * 0.5;
    let center: Point<Pixels> = bounds.center();
    builder.translate(point(px(-half), px(-half)));
    builder.scale(unit);
    builder.translate(center);
    if let Ok(path) = builder.build() {
        window.paint_path(path, color);
    }
}
