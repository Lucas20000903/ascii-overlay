/** The slice of a canvas context needed to measure text. */
export interface TextMeasureCtx {
  font: string;
  measureText(text: string): {
    width: number;
    actualBoundingBoxAscent?: number;
    actualBoundingBoxDescent?: number;
  };
}

export interface MeasureCellOptions {
  /** Glyph to measure. Defaults to `M`; use a full block for solid ramps. */
  sample?: string;
  /**
   * Measure the whole ramp instead of one glyph, and take the mean ink height.
   * Packs rows so the average glyph just meets the row below.
   */
  ramp?: string;
  /** Multiplies the measured height. Below 1 rows overlap, above 1 they gap. */
  lineHeight?: number;
  fontFamily?: string;
}

export interface CellMetrics {
  cellWidth: number;
  cellHeight: number;
}

/**
 * Cell size that makes glyphs tile without gaps.
 *
 * The width is the font's advance. The height is the sample glyph's **ink**,
 * not the font size: 11px monospace advances 6.6px and inks about 8px tall, so
 * using the font size leaves a blank band under every row and the art reads as
 * horizontal stripes.
 *
 * Ink height varies by glyph - at 11px, `+` inks 5.7px and `@` inks 9.3px - so
 * no single cell height suits every glyph. Sizing to the densest glyph gaps the
 * sparse ones; sizing to the mean overlaps the dense ones into a lattice.
 * `M` sits in between and is the default; pass `ramp` for the mean, and
 * `lineHeight` to tune either way.
 */
export function measureCell(
  ctx: TextMeasureCtx,
  fontSize: number,
  options: MeasureCellOptions = {},
): CellMetrics {
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new Error('font size must be positive');
  }

  const { sample = 'M', ramp, lineHeight = 1, fontFamily = 'monospace' } = options;
  ctx.font = `${fontSize}px ${fontFamily}`;

  const inkOf = (ch: string) => {
    const m = ctx.measureText(ch);
    return (m.actualBoundingBoxAscent ?? 0) + (m.actualBoundingBoxDescent ?? 0);
  };

  let ink: number;
  if (ramp === undefined) {
    ink = inkOf(sample);
  } else {
    const inked = [...ramp].filter(ch => ch.trim().length > 0).map(inkOf);
    ink = inked.length === 0 ? 0 : inked.reduce((a, b) => a + b, 0) / inked.length;
  }

  return {
    cellWidth: ctx.measureText(sample).width,
    cellHeight: ink > 0 ? ink * lineHeight : fontSize,
  };
}
