import { describe, expect, test } from 'vitest';
import { sobel } from './edges.js';

/** width x height field, left `split` columns dark, the rest bright. */
const step = (width: number, height: number, split: number) =>
  Array.from({ length: width * height }, (_, i) => ((i % width) < split ? 0 : 1));

describe('sobel', () => {
  test('finds no edges in a flat field', () => {
    const out = sobel(new Array(16).fill(0.4), 4, 4);
    for (const v of out) expect(v).toBeCloseTo(0, 6);
  });

  test('returns one magnitude per pixel', () => {
    expect(sobel(new Array(12).fill(0), 4, 3)).toHaveLength(12);
  });

  test('responds strongly either side of a vertical step', () => {
    const out = sobel(step(4, 3, 2), 4, 3);
    expect(out[1 * 4 + 1]!).toBeGreaterThan(0.5);
    expect(out[1 * 4 + 2]!).toBeGreaterThan(0.5);
  });

  test('responds to a horizontal step too', () => {
    const rows = [0, 0, 1, 1].flatMap(v => new Array(4).fill(v));
    const out = sobel(rows, 4, 4);
    expect(out[1 * 4 + 1]!).toBeGreaterThan(0.5);
  });

  test('never exceeds 1', () => {
    const out = sobel(step(6, 6, 3), 6, 6);
    for (const v of out) expect(v).toBeLessThanOrEqual(1);
  });

  test('rejects a length that does not match the dimensions', () => {
    expect(() => sobel([0, 0, 0], 2, 2)).toThrow(/length/i);
  });
});
