import { toDrawList } from './paint.js';
import { isBlankGlyph, toRuns } from './runs.js';
import type { Ctx2D, GlyphBlend } from './canvas.js';
import type { Cell, Grid } from './grid.js';

/** Logical drawing area, in source pixels. */
export interface PaintEnv {
  width: number;
  height: number;
}

/**
 * Something that can paint itself onto either backend.
 *
 * This is the extension point: the library ships fill, image and ascii layers,
 * and anything else satisfying this contract joins the same stack. Composition
 * state (blend, opacity, filter) is applied by the compositor, so a layer only
 * has to draw itself.
 */
export interface Layer {
  /** How this layer composites onto the layers below. */
  blend?: GlyphBlend;
  /** 0..1. */
  opacity?: number;
  /** A css filter for the canvas backend, or `url(#id)` for svg. */
  filter?: string;
  paintCanvas(ctx: Ctx2D, env: PaintEnv): void;
  /** Markup for the svg backend. Return `''` to sit the layer out. */
  toSvgMarkup(env: PaintEnv): string;
}

/** Properties every layer accepts. */
export interface LayerOptions {
  blend?: GlyphBlend;
  opacity?: number;
  filter?: string;
}

const composed = (l: Layer) =>
  (l.blend !== undefined && l.blend !== 'normal')
  || (l.opacity !== undefined && l.opacity !== 1)
  || l.filter !== undefined;

/* ---------------------------------------------------------------- canvas -- */

export interface PaintLayersOptions {
  /** Device pixels per source pixel. Defaults to 1. */
  pixelRatio?: number;
  /** Wipe the surface first. Defaults to true. */
  clear?: boolean;
}

/**
 * Paint a stack of layers onto a 2D canvas context, bottom first.
 *
 * Composition state is pushed and popped around each layer that needs it, so
 * a blurred layer cannot smear the one above it. Layers that ask for nothing
 * skip the save/restore entirely.
 */
export function paintLayers(
  ctx: Ctx2D,
  layers: readonly Layer[],
  options: PaintLayersOptions = {},
): void {
  const ratio = options.pixelRatio ?? 1;
  if (ratio !== 1) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const env: PaintEnv = {
    width: ctx.canvas.width / ratio,
    height: ctx.canvas.height / ratio,
  };

  if (options.clear ?? true) ctx.clearRect(0, 0, env.width, env.height);

  for (const layer of layers) {
    const wrap = composed(layer);
    if (wrap) {
      ctx.save();
      if (layer.filter !== undefined) ctx.filter = layer.filter;
      if (layer.opacity !== undefined) ctx.globalAlpha = layer.opacity;
      if (layer.blend !== undefined && layer.blend !== 'normal') {
        ctx.globalCompositeOperation = layer.blend;
      }
    }
    layer.paintCanvas(ctx, env);
    if (wrap) ctx.restore();
  }

  if (ratio !== 1) ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/* ------------------------------------------------------------------- svg -- */

export interface LayersToSvgOptions extends PaintEnv {
  /** Markup placed in `<defs>`, where filters and gradients are declared. */
  defs?: string;
}

/** Serialise a stack of layers as a standalone SVG document. */
export function layersToSvg(
  layers: readonly Layer[],
  options: LayersToSvgOptions,
): string {
  const { width, height, defs } = options;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}">`,
  ];
  if (defs !== undefined) parts.push(`<defs>${defs}</defs>`);

  for (const layer of layers) {
    const markup = layer.toSvgMarkup({ width, height });
    if (markup === '') continue;

    const attrs: string[] = [];
    if (layer.filter !== undefined) attrs.push(`filter="${layer.filter}"`);
    if (layer.opacity !== undefined) attrs.push(`opacity="${layer.opacity}"`);
    if (layer.blend !== undefined && layer.blend !== 'normal') {
      attrs.push(`style="mix-blend-mode:${layer.blend}"`);
    }

    parts.push(attrs.length === 0 ? markup : `<g ${attrs.join(' ')}>${markup}</g>`);
  }

  parts.push('</svg>');
  return parts.join('\n');
}

/* ---------------------------------------------------------------- layers -- */

/** A flat colour across the whole area. */
export function fillLayer(color: string, options: LayerOptions = {}): Layer {
  return {
    ...options,
    paintCanvas(ctx, env) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, env.width, env.height);
    },
    toSvgMarkup: () => `<rect width="100%" height="100%" fill="${color}"/>`,
  };
}

export interface ImageLayerOptions extends LayerOptions {
  /**
   * URL for the svg backend. Defaults to the element's own `src`, which covers
   * an `<img>`; a canvas or bitmap source has no url, so pass one to include
   * the layer in svg output.
   */
  href?: string;
  /**
   * Gaussian blur radius in px.
   *
   * Prefer this over writing `blur()` into `filter` yourself: a blur kernel at
   * the frame edge averages in the transparency beyond it and the border goes
   * dark. Knowing the radius lets the layer bleed the image outwards so the
   * kernel has real pixels to read.
   */
  blur?: number;
}

/**
 * How far to bleed a blurred image past the frame.
 *
 * Two standard deviations covers most of the kernel's weight; beyond that the
 * contribution is too small to see, and the bleed is a visible zoom.
 */
const BLEED = 2;

/** An image stretched across the whole area. */
export function imageLayer(
  image: CanvasImageSource,
  options: ImageLayerOptions = {},
): Layer {
  const { href, blur, ...layer } = options;
  const url = href ?? (image as { src?: string }).src;
  const blurred = blur !== undefined && blur > 0;
  const filter = blurred
    ? [layer.filter, `blur(${blur}px)`].filter(Boolean).join(' ')
    : layer.filter;

  return {
    ...layer,
    filter,
    paintCanvas(ctx, env) {
      if (!blurred) {
        ctx.drawImage(image, 0, 0, env.width, env.height);
        return;
      }
      const bleed = blur * BLEED;
      ctx.drawImage(image, -bleed, -bleed, env.width + bleed * 2, env.height + bleed * 2);
    },
    toSvgMarkup: env => (url === undefined ? ''
      : `<image href="${url}" x="0" y="0" width="${env.width}" height="${env.height}"` +
        ' preserveAspectRatio="none"/>'),
  };
}

export interface AsciiLayerOptions extends LayerOptions {
  fontSize: number;
  /** Draw every glyph in this colour instead of its cell colour. */
  color?: string;
  fontFamily?: string;
  /** Needed by the svg backend to pin run widths. Read off the grid otherwise. */
  cellWidth?: number;
  cellHeight?: number;
  /**
   * Fill behind each cell, painted before its glyph.
   *
   * A string paints every cell alike. A function is called per cell, so
   * `c => \`rgb(${c.color.r},${c.color.g},${c.color.b})\`` turns the art into
   * colour blocks with the glyphs sitting on top. Returning `null` leaves that
   * cell unpainted.
   */
  cellBackground?: string | ((cell: Cell) => string | null);
  /**
   * Fill cells holding no glyph. Defaults to true, matching a terminal where
   * every cell has a background.
   *
   * Turn it off to punch the blanks out, so the fill traces the art and
   * whatever sits below shows through the gaps.
   */
  fillBlankCells?: boolean;
  /**
   * Displace each glyph from its cell, in source pixels.
   *
   * The cell keeps its place - only the glyph moves - so a per-frame wobble
   * reads as the drawing shaking rather than the grid sliding. Warping the
   * source image instead barely survives the cell averaging: a 2px displacement
   * changes under 1% of glyphs on a 6.6x8px grid.
   *
   * Runs cannot batch when glyphs move independently, so this costs one draw
   * per glyph.
   */
  offset?: (cell: Cell) => { x: number; y: number };
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const escapeXml = (s: string) => s.replace(/[&<>]/g, c => ESCAPES[c]!);

/** Horizontal step between cells, read back off the grid. */
function cellAdvance(grid: Grid): number | null {
  if (grid.cols < 2) return null;
  const [a, b] = grid.cells;
  if (!a || !b || b.row !== a.row) return null;
  return b.x - a.x;
}

/** Vertical step between rows, read back off the grid. */
function rowAdvance(grid: Grid): number | null {
  if (grid.rows < 2) return null;
  const a = grid.cells[0];
  const b = grid.cells[grid.cols];
  return a && b ? b.y - a.y : null;
}

interface BackgroundRun { x: number; y: number; width: number; color: string }

/**
 * Merge horizontally adjacent cells that share a background colour.
 *
 * One rect per stretch rather than per cell, for the same reason glyphs are
 * batched into runs. A skipped cell ends the run so the gap stays a gap.
 */
function backgroundRuns(
  grid: Grid,
  fill: string | ((cell: Cell) => string | null),
  step: number,
  fillBlanks: boolean,
): BackgroundRun[] {
  const runs: BackgroundRun[] = [];
  let current: BackgroundRun | null = null;
  let lastCol = -1;

  for (const cell of grid.cells) {
    const skip = !fillBlanks && isBlankGlyph(cell.char);
    const color = skip ? null : typeof fill === 'string' ? fill : fill(cell);
    if (color === null) {
      current = null;
      continue;
    }
    if (current !== null && current.y === cell.y
        && current.color === color && cell.col === lastCol + 1) {
      current.width += step;
    } else {
      current = { x: cell.x, y: cell.y, width: step, color };
      runs.push(current);
    }
    lastCol = cell.col;
  }

  return runs;
}

/** A glyph grid. */
export function asciiLayer(grid: Grid, options: AsciiLayerOptions): Layer {
  const {
    fontSize, color, fontFamily, cellWidth, cellHeight, cellBackground,
    fillBlankCells = true, offset, ...layer
  } = options;
  const step = cellWidth ?? cellAdvance(grid) ?? fontSize;
  const rowStep = cellHeight ?? rowAdvance(grid) ?? fontSize;

  return {
    ...layer,
    paintCanvas(ctx) {
      if (cellBackground !== undefined) {
        for (const run of backgroundRuns(grid, cellBackground, step, fillBlankCells)) {
          ctx.fillStyle = run.color;
          ctx.fillRect(run.x, run.y, run.width, rowStep);
        }
      }

      ctx.font = `${fontSize}px ${fontFamily ?? 'monospace'}`;
      ctx.textBaseline = 'top';

      // One fillText per run rather than per glyph - most of the cost of a
      // frame. Canvas has no `textLength`, so a run only lands in its columns
      // when every glyph advances by exactly one cell. That needs two things:
      // the font has to be monospaced, and the cells have to be sized to it.
      // A proportional font passes the second test on its own, because the
      // cells were measured from the same face, and would then pack a run of
      // narrow glyphs into a fraction of the space it should span.
      const wide = ctx.measureText('M').width;
      const narrow = ctx.measureText('i').width;
      const monospaced = Math.abs(wide - narrow) < 0.05;
      const step2 = cellAdvance(grid);
      const batch = offset === undefined && monospaced
        && step2 !== null && Math.abs(step2 - wide) < 0.05;

      if (batch) {
        for (const run of toRuns(grid, { color })) {
          ctx.fillStyle = run.color;
          ctx.fillText(run.text, run.x, run.y);
        }
      } else if (offset === undefined) {
        for (const item of toDrawList(grid, { color })) {
          ctx.fillStyle = item.color;
          ctx.fillText(item.char, item.x, item.y);
        }
      } else {
        for (const cell of grid.cells) {
          if (isBlankGlyph(cell.char)) continue;
          const d = offset(cell);
          ctx.fillStyle = color
            ?? `rgb(${cell.color.r},${cell.color.g},${cell.color.b})`;
          ctx.fillText(cell.char, cell.x + d.x, cell.y + d.y);
        }
      }
    },
    toSvgMarkup() {
      const parts: string[] = [];
      if (cellBackground !== undefined) {
        for (const run of backgroundRuns(grid, cellBackground, step, fillBlankCells)) {
          parts.push(
            `<rect x="${run.x}" y="${run.y}" width="${run.width}" ` +
            `height="${rowStep}" fill="${run.color}"/>`,
          );
        }
      }
      parts.push(
        `<g font-family="${fontFamily ?? 'monospace'}" font-size="${fontSize}" ` +
        'dominant-baseline="text-before-edge" xml:space="preserve">',
      );
      if (offset === undefined) {
        for (const run of toRuns(grid, { color })) {
          parts.push(
            `<text x="${run.x}" y="${run.y}" fill="${run.color}" ` +
            `textLength="${run.cells * step}" lengthAdjust="spacing">` +
            `${escapeXml(run.text)}</text>`,
          );
        }
      } else {
        for (const cell of grid.cells) {
          if (isBlankGlyph(cell.char)) continue;
          const d = offset(cell);
          const fill = color ?? `rgb(${cell.color.r},${cell.color.g},${cell.color.b})`;
          parts.push(
            `<text x="${cell.x + d.x}" y="${cell.y + d.y}" fill="${fill}">` +
            `${escapeXml(cell.char)}</text>`,
          );
        }
      }
      parts.push('</g>');
      return parts.join('\n');
    },
  };
}
