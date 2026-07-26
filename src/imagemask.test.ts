import { describe, expect, test } from 'vitest';
import { imageMask } from './mask.js';
import type { Source } from './grid.js';

/** RGBA source from [r,g,b,a] tuples. */
function src(width: number, height: number, px: [number, number, number, number][]): Source {
  const data = new Uint8ClampedArray(width * height * 4);
  px.forEach(([r, g, b, a], i) => {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
  });
  return { width, height, data };
}

const OPAQUE_BLACK: [number, number, number, number] = [0, 0, 0, 255];
const CLEAR_WHITE: [number, number, number, number] = [255, 255, 255, 0];

describe('imageMask', () => {
  test('reads the alpha channel by default', () => {
    const m = imageMask(src(2, 1, [OPAQUE_BLACK, CLEAR_WHITE]));
    expect(m.data[0]).toBe(255);
    expect(m.data[1]).toBe(0);
  });

  test('reads brightness when asked to', () => {
    const m = imageMask(src(2, 1, [OPAQUE_BLACK, [255, 255, 255, 255]]),
      { from: 'luminance' });
    expect(m.data[0]).toBe(0);
    expect(m.data[1]).toBe(255);
  });

  test('carries a mid grey through as partial coverage', () => {
    const m = imageMask(src(1, 1, [[128, 128, 128, 255]]), { from: 'luminance' });
    expect(m.data[0]).toBeGreaterThan(100);
    expect(m.data[0]).toBeLessThan(160);
  });

  test('inverts coverage on request', () => {
    const m = imageMask(src(2, 1, [OPAQUE_BLACK, CLEAR_WHITE]), { invert: true });
    expect(m.data[0]).toBe(0);
    expect(m.data[1]).toBe(255);
  });

  test('keeps the source dimensions', () => {
    const m = imageMask(src(3, 2, Array(6).fill(OPAQUE_BLACK)));
    expect(m.width).toBe(3);
    expect(m.height).toBe(2);
    expect(m.data).toHaveLength(6);
  });

  test('weights luminance the same way the renderer does', () => {
    const green = imageMask(src(1, 1, [[0, 255, 0, 255]]), { from: 'luminance' }).data[0]!;
    const blue = imageMask(src(1, 1, [[0, 0, 255, 255]]), { from: 'luminance' }).data[0]!;
    expect(green).toBeGreaterThan(blue);
  });
});
