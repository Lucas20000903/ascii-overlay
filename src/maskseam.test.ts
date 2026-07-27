import { describe, expect, test } from 'vitest';
import { renderAscii } from './render.js';
import type { Source } from './grid.js';

const solid = (w: number, h: number, v: number): Source => {
  const data = new Uint8ClampedArray(w * h * 4);
  data.fill(v);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width: w, height: h, data };
};

const base = { mode: 'characters', cellWidth: 1, cellHeight: 1, ramp: ' @' } as const;
const chars = (s: Source, o: object = {}) =>
  renderAscii(s, { ...base, ...o }).cells.map(c => c.char).join('');

describe('mask as a predicate', () => {
  test('draws everywhere without one', () => {
    expect(chars(solid(4, 1, 255))).toBe('@@@@');
  });

  test('blanks the cells it rejects', () => {
    expect(chars(solid(4, 1, 255), { mask: (col: number) => col < 2 })).toBe('@@  ');
  });

  test('keeps the grid whole so the layers below show through', () => {
    const g = renderAscii(solid(4, 1, 255), { ...base, mask: () => false });
    expect(g.cells).toHaveLength(4);
    expect(g.cells.every(c => c.char === ' ')).toBe(true);
  });

  test('is told the row as well as the column', () => {
    const seen: string[] = [];
    renderAscii(solid(2, 2, 255), {
      ...base,
      mask: (col: number, row: number) => { seen.push(`${col},${row}`); return true; },
    });
    expect(seen).toEqual(['0,0', '1,0', '0,1', '1,1']);
  });

  test('reaches braille mode', () => {
    const g = renderAscii(solid(4, 4, 255), {
      mode: 'braille', cellWidth: 2, cellHeight: 4, mask: (col: number) => col === 0,
    });
    expect(g.cells.map(c => c.char)).toEqual(['⣿', '⠀']);
  });

  test('reaches dither mode', () => {
    const g = renderAscii(solid(4, 1, 255), {
      mode: 'dither', cellWidth: 1, cellHeight: 1, mask: (col: number) => col < 2,
    });
    expect(g.cells.map(c => c.char).slice(2)).toEqual([' ', ' ']);
  });
});
