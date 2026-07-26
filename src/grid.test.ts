import { describe, expect, test } from 'vitest';
import { renderGrid } from './grid.js';
import type { Source } from './grid.js';

const RAMP = ' .:-=+*#%@'; // 10 glyphs, dark to bright

/** Build an RGBA source from a list of [r,g,b] rows. */
function src(width: number, height: number, px: [number, number, number][]): Source {
  const data = new Uint8ClampedArray(width * height * 4);
  px.forEach(([r, g, b], i) => {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  });
  return { width, height, data };
}

const solid = (w: number, h: number, c: [number, number, number]): Source =>
  src(w, h, Array.from({ length: w * h }, () => c));

describe('renderGrid', () => {
  test('derives grid dimensions from source size and cell size', () => {
    const g = renderGrid(solid(4, 2, [0, 0, 0]), { cellWidth: 2, cellHeight: 2, ramp: RAMP });
    expect(g.cols).toBe(2);
    expect(g.rows).toBe(1);
    expect(g.cells).toHaveLength(2);
  });

  test('covers a source that is not a whole number of cells', () => {
    const g = renderGrid(solid(5, 2, [0, 0, 0]), { cellWidth: 2, cellHeight: 2, ramp: RAMP });
    expect(g.cols).toBe(3);
  });

  test('gives a black source the darkest glyph', () => {
    const g = renderGrid(solid(2, 2, [0, 0, 0]), { cellWidth: 2, cellHeight: 2, ramp: RAMP });
    expect(g.cells[0]!.char).toBe(' ');
  });

  test('gives a white source the brightest glyph', () => {
    const g = renderGrid(solid(2, 2, [255, 255, 255]), { cellWidth: 2, cellHeight: 2, ramp: RAMP });
    expect(g.cells[0]!.char).toBe('@');
  });

  test('averages the pixels a cell covers', () => {
    // one 2x1 cell over one black and one white pixel -> mid grey
    const g = renderGrid(src(2, 1, [[0, 0, 0], [255, 255, 255]]),
      { cellWidth: 2, cellHeight: 1, ramp: RAMP });
    expect(g.cells[0]!.color).toEqual({ r: 128, g: 128, b: 128 });
    expect(g.cells[0]!.char).toBe('+'); // luminance 0.5 -> bucket 5
  });

  test('keeps each cell independent', () => {
    const g = renderGrid(src(2, 1, [[0, 0, 0], [255, 255, 255]]),
      { cellWidth: 1, cellHeight: 1, ramp: RAMP });
    expect(g.cells.map(c => c.char)).toEqual([' ', '@']);
  });

  test('reports each cell position in source pixels', () => {
    const g = renderGrid(solid(4, 2, [0, 0, 0]), { cellWidth: 2, cellHeight: 2, ramp: RAMP });
    expect(g.cells[1]!.x).toBe(2);
    expect(g.cells[1]!.y).toBe(0);
  });

  test('rejects a non-positive cell size', () => {
    expect(() => renderGrid(solid(2, 2, [0, 0, 0]),
      { cellWidth: 0, cellHeight: 2, ramp: RAMP })).toThrow(/cell/i);
  });
});
