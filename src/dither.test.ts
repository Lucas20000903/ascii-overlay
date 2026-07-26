import { describe, expect, test } from 'vitest';
import { floydSteinberg } from './dither.js';

const bits = (a: Uint8Array) => Array.from(a);

describe('floydSteinberg', () => {
  test('leaves a black image fully off', () => {
    expect(bits(floydSteinberg([0, 0, 0, 0], 2, 2))).toEqual([0, 0, 0, 0]);
  });

  test('leaves a white image fully on', () => {
    expect(bits(floydSteinberg([1, 1, 1, 1], 2, 2))).toEqual([1, 1, 1, 1]);
  });

  test('pushes quantisation error onto the next pixel in the row', () => {
    // 0.5 rounds up to 1, leaving -0.5 error; 7/16 of it drops the
    // neighbour to 0.28125, which rounds down.
    expect(bits(floydSteinberg([0.5, 0.5], 2, 1))).toEqual([1, 0]);
  });

  test('spreads error onto the row below', () => {
    expect(bits(floydSteinberg([0.5, 0.5, 0.5, 0.5], 2, 2))).toEqual([1, 0, 0, 1]);
  });

  test('honours a custom threshold', () => {
    expect(bits(floydSteinberg([0.3], 1, 1))).toEqual([0]);
    expect(bits(floydSteinberg([0.3], 1, 1, { threshold: 0.2 }))).toEqual([1]);
  });

  test('rejects a length that does not match the dimensions', () => {
    expect(() => floydSteinberg([0, 0, 0], 2, 2)).toThrow(/length/i);
  });
});
