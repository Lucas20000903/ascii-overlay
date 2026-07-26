import { describe, expect, test } from 'vitest';
import { shouldDraw } from './coverage.js';

describe('shouldDraw', () => {
  test('draws every cell at full coverage', () => {
    for (let i = 0; i < 50; i++) expect(shouldDraw(i, 0, 1)).toBe(true);
  });

  test('draws nothing at zero coverage', () => {
    for (let i = 0; i < 50; i++) expect(shouldDraw(i, 0, 0)).toBe(false);
  });

  test('draws roughly the requested fraction', () => {
    let drawn = 0;
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) if (shouldDraw(col, row, 0.5)) drawn++;
    }
    expect(drawn / 10000).toBeGreaterThan(0.45);
    expect(drawn / 10000).toBeLessThan(0.55);
  });

  test('gives the same answer for the same cell every time', () => {
    const first = shouldDraw(7, 13, 0.5);
    for (let i = 0; i < 10; i++) expect(shouldDraw(7, 13, 0.5)).toBe(first);
  });

  test('varies the pattern with the seed', () => {
    const a: boolean[] = [], b: boolean[] = [];
    for (let i = 0; i < 200; i++) {
      a.push(shouldDraw(i, 0, 0.5, 1));
      b.push(shouldDraw(i, 0, 0.5, 2));
    }
    expect(a).not.toEqual(b);
  });

  test('does not simply drop whole rows or columns', () => {
    const row0 = Array.from({ length: 40 }, (_, i) => shouldDraw(i, 0, 0.5));
    const row1 = Array.from({ length: 40 }, (_, i) => shouldDraw(i, 1, 0.5));
    expect(row0).not.toEqual(row1);
  });
});
