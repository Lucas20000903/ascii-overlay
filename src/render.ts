import { shimmerAt } from './animate.js';
import { brailleGlyph } from './braille.js';
import { resolveRamp } from './charset.js';
import { applyColor } from './color.js';
import { shouldDraw } from './coverage.js';
import { floydSteinberg } from './dither.js';
import { sobel } from './edges.js';
import { gridShape } from './grid.js';
import { luminance } from './luminance.js';
import { glyphIndex } from './ramp.js';
import { meanColorRect } from './sample.js';
import { applyTone } from './tone.js';
import type { ShimmerOptions } from './animate.js';
import type { ColorOptions } from './color.js';
import type { Cell, Grid, RGB, Source } from './grid.js';
import type { ToneOptions } from './tone.js';

export type AsciiMode = 'characters' | 'braille' | 'dither';

export const DEFAULT_RAMP = ' .:-=+*#%@';

/** Glyph the dither mode uses for an "on" cell. */
const BLOCK = '█';
const BLANK_BRAILLE = '⠀';

const BRAILLE_COLS = 2;
const BRAILLE_ROWS = 4;

export interface RenderOptions {
  mode: AsciiMode;
  /** Cell footprint in source pixels. */
  cellWidth: number;
  cellHeight: number;

  // --- Characters ---
  /** A ramp name from `RAMPS` or a literal ramp, dark to bright. */
  ramp?: string;
  /** Reverse the ramp, so bright areas take the dense glyphs. */
  invert?: boolean;

  // --- Intensity ---
  /** Contrast, brightness and gamma applied to each cell's luminance. */
  tone?: ToneOptions;
  /** 0..1. At 1 the glyphs follow edges instead of overall brightness. */
  edgeEmphasis?: number;
  /** 0..1. Cells dimmer than this are left blank. */
  darkThreshold?: number;
  /** 0..1 fraction of cells to keep. Thinning is scattered, not row-wise. */
  coverage?: number;
  coverageSeed?: number;

  // --- Colour ---
  /** Colour grading applied to each cell's colour: preset, saturation, tint. */
  grade?: ColorOptions;

  // --- Mask ---
  /**
   * Restrict where glyphs appear. Cells this rejects are left blank, still in
   * the grid, so whatever sits below shows through.
   *
   * A predicate rather than a shape: rectangles, ellipses, freehand paths and
   * image mattes are all just functions, and the renderer has no reason to know
   * which one you meant.
   *
   * The third argument is the cell's luminance in 0..1, after `tone` and
   * `edgeEmphasis` have shaped it, which makes brightness a selection criterion
   * as well as position. `darkThreshold` keeps the bright end; a predicate can
   * keep either end, or a band, or both together with a shape.
   */
  mask?: (col: number, row: number, luminance: number) => boolean;

  // --- Animation ---
  animation?: ShimmerOptions;

  /** Cut-off in 0..1 for braille dots and dither cells. Defaults to 0.5. */
  threshold?: number;

  /**
   * Displace where each cell reads from, in source pixels.
   *
   * The grid stays put; only the window each cell looks through moves, so the
   * picture appears to shift underneath and the glyphs change to follow. Same
   * result as warping the source bitmap and far cheaper - no resampling pass,
   * just different coordinates.
   *
   * Reads past the edge clamp to the nearest pixel.
   */
  sampleOffset?: (col: number, row: number) => { x: number; y: number };
}

const NO_OFFSET = { x: 0, y: 0 };

/** Mean colour and shaped luminance for every cell, in row-major order. */
interface CellPass {
  colors: RGB[];
  lum: Float32Array;
}

function cellPass(
  source: Source, cols: number, rows: number, options: RenderOptions,
): CellPass {
  const { cellWidth, cellHeight } = options;
  const colors: RGB[] = [];
  let lum = new Float32Array(cols * rows);

  const shift = options.sampleOffset;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const d = shift ? shift(col, row) : NO_OFFSET;
      const x0 = col * cellWidth + d.x;
      const y0 = row * cellHeight + d.y;
      const c = meanColorRect(source, x0, y0, x0 + cellWidth, y0 + cellHeight);
      colors.push(c);
      lum[row * cols + col] = luminance(c.r, c.g, c.b);
    }
  }

  if (options.tone) {
    const toned = new Float32Array(lum.length);
    for (let i = 0; i < lum.length; i++) toned[i] = applyTone(lum[i]!, options.tone);
    lum = toned;
  }

  const emphasis = options.edgeEmphasis ?? 0;
  if (emphasis > 0) {
    const edges = sobel(lum, cols, rows);
    const mixed = new Float32Array(lum.length);
    for (let i = 0; i < lum.length; i++) {
      mixed[i] = lum[i]! * (1 - emphasis) + edges[i]! * emphasis;
    }
    lum = mixed;
  }

  return { colors, lum };
}

/**
 * Whether a cell should be left blank.
 *
 * Blank cells stay in the grid - they just draw nothing, so a backdrop shows
 * through instead of the grid collapsing.
 */
function isBlanked(
  col: number, row: number, lum: number, options: RenderOptions,
): boolean {
  if (options.darkThreshold !== undefined && lum < options.darkThreshold) return true;

  if (options.coverage !== undefined &&
      !shouldDraw(col, row, options.coverage, options.coverageSeed ?? 0)) return true;

  if (options.mask && !options.mask(col, row, lum)) return true;

  return false;
}

/** Shimmer nudges the glyph index; the result still has to land on the ramp. */
function shimmerIndex(
  index: number, col: number, row: number, count: number, options: RenderOptions,
): number {
  if (!options.animation?.shimmer) return index;
  const moved = Math.round(index + shimmerAt(col, row, options.animation));
  return moved < 0 ? 0 : moved > count - 1 ? count - 1 : moved;
}

function makeCell(
  char: string, color: RGB, col: number, row: number, options: RenderOptions,
): Cell {
  return {
    char,
    color: applyColor(color, options.grade ?? {}),
    x: col * options.cellWidth,
    y: row * options.cellHeight,
    col,
    row,
  };
}

function renderCharacters(source: Source, options: RenderOptions): Grid {
  const { cols, rows } = gridShape(source, options.cellWidth, options.cellHeight);
  const { colors, lum } = cellPass(source, cols, rows, options);
  const ramp = resolveRamp(options.ramp ?? DEFAULT_RAMP, options.invert);
  const cells: Cell[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const y = lum[i]!;
      let char = ' ';
      if (!isBlanked(col, row, y, options)) {
        const index = shimmerIndex(glyphIndex(y, ramp.length), col, row, ramp.length, options);
        char = ramp[index]!;
      }
      cells.push(makeCell(char, colors[i]!, col, row, options));
    }
  }

  return { cols, rows, cells };
}

function renderBraille(source: Source, options: RenderOptions): Grid {
  const { cellWidth, cellHeight } = options;
  const threshold = options.threshold ?? 0.5;
  const { cols, rows } = gridShape(source, cellWidth, cellHeight);
  const { colors, lum } = cellPass(source, cols, rows, options);
  const dotWidth = cellWidth / BRAILLE_COLS;
  const dotHeight = cellHeight / BRAILLE_ROWS;
  const cells: Cell[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      let char = BLANK_BRAILLE;

      if (!isBlanked(col, row, lum[i]!, options)) {
        const d = options.sampleOffset ? options.sampleOffset(col, row) : NO_OFFSET;
        const x0 = col * cellWidth + d.x;
        const y0 = row * cellHeight + d.y;
        const dots: boolean[] = [];
        for (let dy = 0; dy < BRAILLE_ROWS; dy++) {
          for (let dx = 0; dx < BRAILLE_COLS; dx++) {
            const c = meanColorRect(source,
              x0 + dx * dotWidth, y0 + dy * dotHeight,
              x0 + (dx + 1) * dotWidth, y0 + (dy + 1) * dotHeight);
            let dot = luminance(c.r, c.g, c.b);
            if (options.tone) dot = applyTone(dot, options.tone);
            dots.push(dot >= threshold);
          }
        }
        char = brailleGlyph(dots);
      }

      cells.push(makeCell(char, colors[i]!, col, row, options));
    }
  }

  return { cols, rows, cells };
}

function renderDither(source: Source, options: RenderOptions): Grid {
  const { cols, rows } = gridShape(source, options.cellWidth, options.cellHeight);
  const { colors, lum } = cellPass(source, cols, rows, options);

  // Diffuse over the whole field first: blanking cells beforehand would leak
  // their error into neighbours and skew the pattern.
  const bits = floydSteinberg(lum, cols, rows, { threshold: options.threshold });

  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const blanked = isBlanked(col, row, lum[i]!, options);
      cells.push(makeCell(
        !blanked && bits[i] ? BLOCK : ' ', colors[i]!, col, row, options));
    }
  }

  return { cols, rows, cells };
}

/** Reduce a source image to a grid of glyphs using the chosen mode. */
export function renderAscii(source: Source, options: RenderOptions): Grid {
  switch (options.mode) {
    case 'characters': return renderCharacters(source, options);
    case 'braille': return renderBraille(source, options);
    case 'dither': return renderDither(source, options);
    default:
      throw new Error(`unknown mode: ${String(options.mode)}`);
  }
}
