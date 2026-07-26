import { luminance } from './luminance.js';
import { glyphFor } from './ramp.js';
import { meanColorCell, roundRGB } from './sample.js';

/** Raw RGBA pixels, laid out like `CanvasRenderingContext2D.getImageData`. */
export interface Source {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Cell {
  /** Glyph chosen for this cell. */
  char: string;
  /** Mean colour of the source pixels the cell covers. */
  color: RGB;
  /** Top-left corner of the cell, in source pixels. May be fractional. */
  x: number;
  y: number;
  col: number;
  row: number;
}

export interface Grid {
  cols: number;
  rows: number;
  cells: Cell[];
}

export interface GridOptions {
  cellWidth: number;
  cellHeight: number;
  /** Glyphs ordered dark to bright. */
  ramp: string;
}

/** Grid shape for a source, or a throw if the cell size is unusable. */
export function gridShape(source: Source, cellWidth: number, cellHeight: number) {
  if (!Number.isFinite(cellWidth) || cellWidth <= 0 ||
      !Number.isFinite(cellHeight) || cellHeight <= 0) {
    throw new Error('cell width and height must be positive');
  }
  return {
    cols: Math.ceil(source.width / cellWidth),
    rows: Math.ceil(source.height / cellHeight),
  };
}

/**
 * Reduce a source image to a grid of glyphs.
 *
 * Each cell takes the mean colour of the pixels it covers; the glyph comes from
 * that mean's luminance. Cell positions stay fractional so glyphs tile against
 * the font's advance width, while sampling snaps to whole pixels.
 */
export function renderGrid(source: Source, options: GridOptions): Grid {
  const { cellWidth, cellHeight, ramp } = options;
  const { cols, rows } = gridShape(source, cellWidth, cellHeight);
  const cells: Cell[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const mean = meanColorCell(source, col, row, cellWidth, cellHeight);
      cells.push({
        char: glyphFor(luminance(mean.r, mean.g, mean.b), ramp),
        color: roundRGB(mean),
        x: col * cellWidth,
        y: row * cellHeight,
        col,
        row,
      });
    }
  }

  return { cols, rows, cells };
}
