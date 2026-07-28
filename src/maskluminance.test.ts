import { describe, expect, test } from 'vitest';
import { renderAscii } from './render.js';
import type { Source } from './grid.js';

/** Four cells stepping dark to bright. */
const ramp4: Source = (() => {
  const data = new Uint8ClampedArray(4 * 4);
  [0, 85, 170, 255].forEach((v, i) => {
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  });
  return { width: 4, height: 1, data };
})();

const base = { mode: 'characters', cellWidth: 1, cellHeight: 1, ramp: ' .:-=+*#%@' } as const;
const chars = (o: object = {}) =>
  renderAscii(ramp4, { ...base, ...o }).cells.map(c => c.char).join('');

describe('mask sees the cell luminance', () => {
  test('hands the luminance over as the third argument', () => {
    const seen: number[] = [];
    renderAscii(ramp4, { ...base, mask: (_c, _r, lum: number) => { seen.push(+lum.toFixed(2)); return true; } });
    expect(seen).toEqual([0, 0.33, 0.67, 1]);
  });

  test('keeps the dark end and drops the bright, which darkThreshold cannot do', () => {
    const out = chars({ mask: (_c: number, _r: number, lum: number) => lum < 0.5 });
    expect(out.slice(2)).toBe('  ');
    expect(out.slice(0, 2)).not.toBe('  ');
  });

  test('darkThreshold still cuts the other way', () => {
    const out = chars({ darkThreshold: 0.5 });
    expect(out.slice(0, 2)).toBe('  ');
  });

  test('selects a band between two levels', () => {
    const out = chars({ mask: (_c: number, _r: number, lum: number) => lum > 0.2 && lum < 0.8 });
    expect(out[0]).toBe(' ');
    expect(out[3]).toBe(' ');
    expect(out[1]).not.toBe(' ');
    expect(out[2]).not.toBe(' ');
  });

  test('still takes the column and row', () => {
    expect(chars({ mask: (col: number) => col < 2 }).slice(2)).toBe('  ');
  });

  test('reports the luminance after tone has shaped it', () => {
    const seen: number[] = [];
    renderAscii(ramp4, {
      ...base, tone: { brightness: 0.5 },
      mask: (_c, _r, lum: number) => { seen.push(+lum.toFixed(2)); return true; },
    });
    expect(seen).toEqual([0.5, 0.83, 1, 1]);
  });

  test('reaches braille and dither too', () => {
    const wide: Source = (() => {
      const data = new Uint8ClampedArray(8 * 4 * 4);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
        const v = x < 4 ? 0 : 255;
        const i = (y * 8 + x) * 4;
        data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
      }
      return { width: 8, height: 4, data };
    })();
    const dim = (_c: number, _r: number, lum: number) => lum < 0.5;
    const braille = renderAscii(wide, { mode: 'braille', cellWidth: 4, cellHeight: 4, mask: dim });
    expect(braille.cells[1]!.char).toBe('⠀');
    const dither = renderAscii(wide, { mode: 'dither', cellWidth: 4, cellHeight: 4, mask: dim });
    expect(dither.cells[1]!.char).toBe(' ');
  });
});
