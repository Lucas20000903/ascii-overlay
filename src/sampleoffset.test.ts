import { describe, expect, test } from 'vitest';
import { renderAscii } from './render.js';
import type { Source } from './grid.js';

/** 8x1: the left half black, the right half white. */
const edge: Source = (() => {
  const data = new Uint8ClampedArray(8 * 4);
  for (let x = 0; x < 8; x++) {
    const v = x < 4 ? 0 : 255;
    data[x * 4] = v; data[x * 4 + 1] = v; data[x * 4 + 2] = v; data[x * 4 + 3] = 255;
  }
  return { width: 8, height: 1, data };
})();

const base = { mode: 'characters', cellWidth: 4, cellHeight: 1, ramp: ' @' } as const;
const chars = (o: object = {}) =>
  renderAscii(edge, { ...base, ...o }).cells.map(c => c.char).join('');

describe('sampleOffset', () => {
  test('reads each cell in place by default', () => {
    expect(chars()).toBe(' @');
  });

  test('moves where a cell reads from', () => {
    // shifted a whole cell right, the dark cell now reads the bright half
    expect(chars({ sampleOffset: () => ({ x: 4, y: 0 }) })).toBe('@@');
  });

  test('clamps at the edge rather than reading nothing', () => {
    expect(chars({ sampleOffset: () => ({ x: -40, y: 0 }) })).toBe('  ');
  });

  test('is told which cell it is placing', () => {
    const seen: string[] = [];
    chars({ sampleOffset: (col: number, row: number) => { seen.push(`${col},${row}`); return { x: 0, y: 0 }; } });
    expect(seen).toEqual(['0,0', '1,0']);
  });

  test('can displace one cell and not another', () => {
    expect(chars({ sampleOffset: (col: number) => ({ x: col === 0 ? 4 : 0, y: 0 }) }))
      .toBe('@@');
  });

  test('reaches the braille dots too', () => {
    const tall: Source = (() => {
      const data = new Uint8ClampedArray(4 * 4 * 4);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const v = x < 2 ? 0 : 255;
        const i = (y * 4 + x) * 4;
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
      }
      return { width: 4, height: 4, data };
    })();
    const plain = renderAscii(tall, { mode: 'braille', cellWidth: 2, cellHeight: 4 });
    const moved = renderAscii(tall, {
      mode: 'braille', cellWidth: 2, cellHeight: 4,
      sampleOffset: () => ({ x: 2, y: 0 }),
    });
    expect(plain.cells[0]!.char).toBe('⠀');
    expect(moved.cells[0]!.char).toBe('⣿');
  });

  test('reaches dither mode too', () => {
    const plain = renderAscii(edge, { mode: 'dither', cellWidth: 4, cellHeight: 1 });
    const moved = renderAscii(edge, {
      mode: 'dither', cellWidth: 4, cellHeight: 1,
      sampleOffset: () => ({ x: 4, y: 0 }),
    });
    expect(plain.cells.map(c => c.char)).not.toEqual(moved.cells.map(c => c.char));
  });
});
