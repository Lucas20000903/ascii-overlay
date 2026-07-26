import { describe, expect, test } from 'vitest';
import { luminance } from './luminance.js';

describe('luminance', () => {
  test('maps black to 0', () => {
    expect(luminance(0, 0, 0)).toBe(0);
  });

  test('maps white to 1', () => {
    expect(luminance(255, 255, 255)).toBe(1);
  });

  test('weights green most and blue least (Rec. 709)', () => {
    const r = luminance(255, 0, 0);
    const g = luminance(0, 255, 0);
    const b = luminance(0, 0, 255);
    expect(g).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(b);
    expect(g).toBeCloseTo(0.7152, 4);
  });
});
