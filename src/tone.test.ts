import { describe, expect, test } from 'vitest';
import { applyTone } from './tone.js';

describe('applyTone', () => {
  test('leaves luminance alone with neutral settings', () => {
    expect(applyTone(0.42, {})).toBeCloseTo(0.42, 6);
  });

  test('holds mid grey fixed while raising contrast', () => {
    expect(applyTone(0.5, { contrast: 2 })).toBeCloseTo(0.5, 6);
  });

  test('pushes highlights up and shadows down as contrast rises', () => {
    expect(applyTone(0.7, { contrast: 2 })).toBeCloseTo(0.9, 6);
    expect(applyTone(0.3, { contrast: 2 })).toBeCloseTo(0.1, 6);
  });

  test('flattens towards mid grey as contrast falls', () => {
    expect(applyTone(1, { contrast: 0 })).toBeCloseTo(0.5, 6);
  });

  test('shifts the whole range with brightness', () => {
    expect(applyTone(0.4, { brightness: 0.2 })).toBeCloseTo(0.6, 6);
  });

  test('applies gamma before contrast and brightness', () => {
    expect(applyTone(0.25, { gamma: 0.5 })).toBeCloseTo(0.0625, 6);
  });

  test('clamps into 0..1', () => {
    expect(applyTone(0.9, { brightness: 0.5 })).toBe(1);
    expect(applyTone(0.1, { brightness: -0.5 })).toBe(0);
  });
});
