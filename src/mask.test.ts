import { describe, expect, test } from 'vitest';
import { rectMask, ellipseMask, polygonMask, sampleMask } from './mask.js';

describe('rectMask', () => {
  test('covers the rectangle and clears the rest', () => {
    const m = rectMask(4, 4, { x: 1, y: 1, width: 2, height: 2 });
    expect(m.data[1 * 4 + 1]).toBe(255);
    expect(m.data[0]).toBe(0);
    expect(m.data[3 * 4 + 3]).toBe(0);
  });
});

describe('ellipseMask', () => {
  test('covers the centre and clears the corners', () => {
    const m = ellipseMask(9, 9, { cx: 4, cy: 4, rx: 3, ry: 3 });
    expect(m.data[4 * 9 + 4]).toBe(255);
    expect(m.data[0]).toBe(0);
    expect(m.data[8 * 9 + 8]).toBe(0);
  });
});

describe('polygonMask', () => {
  test('fills the inside of a triangle', () => {
    const m = polygonMask(10, 10, [[0, 0], [9, 0], [0, 9]]);
    expect(m.data[1 * 10 + 1]).toBe(255); // inside
    expect(m.data[9 * 10 + 9]).toBe(0);   // outside the hypotenuse
  });

  test('needs at least three points', () => {
    expect(() => polygonMask(4, 4, [[0, 0], [1, 1]])).toThrow(/three/i);
  });
});

describe('sampleMask', () => {
  const m = rectMask(4, 4, { x: 0, y: 0, width: 2, height: 4 });

  test('reports full coverage inside the shape', () => {
    expect(sampleMask(m, 0, 0, 2, 4)).toBeCloseTo(1, 6);
  });

  test('reports no coverage outside the shape', () => {
    expect(sampleMask(m, 2, 0, 4, 4)).toBeCloseTo(0, 6);
  });

  test('averages partial coverage', () => {
    expect(sampleMask(m, 0, 0, 4, 4)).toBeCloseTo(0.5, 6);
  });

  test('treats anything outside the mask as uncovered', () => {
    expect(sampleMask(m, 10, 10, 12, 12)).toBe(0);
  });
});
