import { describe, expect, test } from 'vitest';
import { brailleGlyph } from './braille.js';

/** dots are given in raster order for a 2-wide, 4-tall cell: index = y * 2 + x */
const NONE = Array(8).fill(false);
const on = (...idx: number[]) => NONE.map((_, i) => idx.includes(i));

describe('brailleGlyph', () => {
  test('maps an empty cell to blank braille', () => {
    expect(brailleGlyph(NONE)).toBe('⠀');
  });

  test('maps a full cell to all eight dots', () => {
    expect(brailleGlyph(Array(8).fill(true))).toBe('⣿');
  });

  test('maps the top-left dot to dot 1', () => {
    expect(brailleGlyph(on(0))).toBe('⠁');
  });

  test('maps the top-right dot to dot 4', () => {
    expect(brailleGlyph(on(1))).toBe('⠈');
  });

  test('maps the bottom-left dot to dot 7', () => {
    expect(brailleGlyph(on(6))).toBe('⡀');
  });

  test('maps the bottom-right dot to dot 8', () => {
    expect(brailleGlyph(on(7))).toBe('⢀');
  });

  test('combines dots additively', () => {
    expect(brailleGlyph(on(0, 1))).toBe('⠉');
  });

  test('rejects a cell that is not eight dots', () => {
    expect(() => brailleGlyph([true, false])).toThrow(/eight/i);
  });
});
