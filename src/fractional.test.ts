import { describe, expect, test } from 'vitest';
import { renderGrid } from './grid.js';
import { renderAscii, DEFAULT_RAMP } from './render.js';
import type { Source } from './grid.js';

/** Monospace advance widths are fractional, so cell sizes are too. */
const ADVANCE = 6.6;

const solid = (w: number, h: number, v: number): Source => {
  const data = new Uint8ClampedArray(w * h * 4);
  data.fill(v);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width: w, height: h, data };
};

describe('fractional cell sizes', () => {
  test('renderGrid still picks a real glyph for every cell', () => {
    const grid = renderGrid(solid(40, 22, 255),
      { cellWidth: ADVANCE, cellHeight: 11, ramp: DEFAULT_RAMP });
    for (const cell of grid.cells) {
      expect(DEFAULT_RAMP).toContain(cell.char);
    }
  });

  test('renderGrid keeps cell colours numeric', () => {
    const grid = renderGrid(solid(40, 22, 128),
      { cellWidth: ADVANCE, cellHeight: 11, ramp: DEFAULT_RAMP });
    for (const cell of grid.cells) {
      expect(Number.isFinite(cell.color.r)).toBe(true);
      expect(Number.isFinite(cell.color.g)).toBe(true);
      expect(Number.isFinite(cell.color.b)).toBe(true);
    }
  });

  test('a white image is uniformly the brightest glyph', () => {
    const grid = renderGrid(solid(40, 22, 255),
      { cellWidth: ADVANCE, cellHeight: 11, ramp: DEFAULT_RAMP });
    expect(new Set(grid.cells.map(c => c.char))).toEqual(new Set(['@']));
  });

  test('braille fills every dot of a white image', () => {
    const grid = renderAscii(solid(40, 22, 255), {
      mode: 'braille', cellWidth: ADVANCE, cellHeight: 9,
    });
    expect(new Set(grid.cells.map(c => c.char))).toEqual(new Set(['⣿']));
  });

  test('dither turns a bright image mostly on', () => {
    const grid = renderAscii(solid(40, 22, 240), {
      mode: 'dither', cellWidth: ADVANCE, cellHeight: 5,
    });
    const on = grid.cells.filter(c => c.char === '█').length;
    expect(on).toBeGreaterThan(grid.cells.length / 2);
  });
});
