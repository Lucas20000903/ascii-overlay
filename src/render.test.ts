import { describe, expect, test } from 'vitest';
import { renderAscii } from './render.js';
import type { Source } from './grid.js';

function src(width: number, height: number, px: [number, number, number][]): Source {
  const data = new Uint8ClampedArray(width * height * 4);
  px.forEach(([r, g, b], i) => {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  });
  return { width, height, data };
}
const solid = (w: number, h: number, c: [number, number, number]): Source =>
  src(w, h, Array.from({ length: w * h }, () => c));

const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [255, 255, 255];

describe('renderAscii characters mode', () => {
  test('picks glyphs off the ramp by luminance', () => {
    const g = renderAscii(solid(2, 2, WHITE),
      { mode: 'characters', cellWidth: 2, cellHeight: 2, ramp: ' .:-=+*#%@' });
    expect(g.cells[0]!.char).toBe('@');
  });
});

describe('renderAscii braille mode', () => {
  test('turns on dots only where the sub-cell is bright', () => {
    // one 2x4 cell: left column black, right column white
    const px: [number, number, number][] = [];
    for (let y = 0; y < 4; y++) { px.push(BLACK, WHITE); }
    const g = renderAscii(src(2, 4, px), { mode: 'braille', cellWidth: 2, cellHeight: 4 });
    expect(g.cols).toBe(1);
    expect(g.rows).toBe(1);
    expect(g.cells[0]!.char).toBe('⢸'); // dots 4,5,6,8 - the right column
  });

  test('leaves a dark cell blank', () => {
    const g = renderAscii(solid(2, 4, BLACK), { mode: 'braille', cellWidth: 2, cellHeight: 4 });
    expect(g.cells[0]!.char).toBe('⠀');
  });

  test('fills a bright cell', () => {
    const g = renderAscii(solid(2, 4, WHITE), { mode: 'braille', cellWidth: 2, cellHeight: 4 });
    expect(g.cells[0]!.char).toBe('⣿');
  });
});

describe('renderAscii dither mode', () => {
  test('diffuses error across neighbouring cells', () => {
    const grey: [number, number, number] = [128, 128, 128];
    const g = renderAscii(src(2, 1, [grey, grey]),
      { mode: 'dither', cellWidth: 1, cellHeight: 1 });
    expect(g.cells.map(c => c.char)).toEqual(['█', ' ']);
  });
});

describe('renderAscii', () => {
  test('keeps the mean cell colour for tinting', () => {
    const g = renderAscii(src(2, 1, [BLACK, WHITE]),
      { mode: 'characters', cellWidth: 2, cellHeight: 1, ramp: ' .:-=+*#%@' });
    expect(g.cells[0]!.color).toEqual({ r: 128, g: 128, b: 128 });
  });

  test('rejects an unknown mode', () => {
    expect(() => renderAscii(solid(2, 2, BLACK),
      // @ts-expect-error exercising the runtime guard
      { mode: 'voxel', cellWidth: 2, cellHeight: 2 })).toThrow(/mode/i);
  });
});
