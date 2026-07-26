import { describe, expect, test } from 'vitest';
import { applyColor } from './color.js';

const grey = { r: 128, g: 128, b: 128 };
const red = { r: 200, g: 40, b: 40 };

describe('applyColor presets', () => {
  test('leaves the colour alone by default', () => {
    expect(applyColor(red, {})).toEqual(red);
  });

  test('none is a no-op', () => {
    expect(applyColor(red, { preset: 'none' })).toEqual(red);
  });

  test('bw flattens every channel to the same value', () => {
    const c = applyColor(red, { preset: 'bw' });
    expect(c.r).toBe(c.g);
    expect(c.g).toBe(c.b);
  });

  test('sepia warms a neutral grey', () => {
    const c = applyColor(grey, { preset: 'sepia' });
    expect(c.r).toBeGreaterThan(c.g);
    expect(c.g).toBeGreaterThan(c.b);
  });

  test('warm favours red over blue', () => {
    const c = applyColor(grey, { preset: 'warm' });
    expect(c.r).toBeGreaterThan(c.b);
  });

  test('cool favours blue over red', () => {
    const c = applyColor(grey, { preset: 'cool' });
    expect(c.b).toBeGreaterThan(c.r);
  });
});

describe('applyColor saturation', () => {
  test('leaves the colour at saturation 1', () => {
    expect(applyColor(red, { saturation: 1 })).toEqual(red);
  });

  test('greys the colour at saturation 0', () => {
    const c = applyColor(red, { saturation: 0 });
    expect(c.r).toBe(c.g);
    expect(c.g).toBe(c.b);
  });

  test('oversaturates past 1', () => {
    const c = applyColor(red, { saturation: 2 });
    expect(c.r).toBeGreaterThan(red.r);
  });
});

describe('applyColor tint', () => {
  test('multiply darkens', () => {
    const c = applyColor(grey, { tint: { color: { r: 128, g: 128, b: 128 }, blend: 'multiply' } });
    expect(c.r).toBeLessThan(grey.r);
  });

  test('screen lightens', () => {
    const c = applyColor(grey, { tint: { color: { r: 128, g: 128, b: 128 }, blend: 'screen' } });
    expect(c.r).toBeGreaterThan(grey.r);
  });

  test('opacity 0 makes the tint a no-op', () => {
    expect(applyColor(red, { tint: { color: { r: 0, g: 255, b: 0 }, opacity: 0 } })).toEqual(red);
  });

  test('opacity mixes proportionally', () => {
    const c = applyColor({ r: 0, g: 0, b: 0 },
      { tint: { color: { r: 255, g: 255, b: 255 }, blend: 'screen', opacity: 0.5 } });
    expect(c.r).toBeCloseTo(128, 0);
  });

  test('keeps channels inside 0..255', () => {
    const c = applyColor({ r: 250, g: 250, b: 250 },
      { tint: { color: { r: 255, g: 255, b: 255 }, blend: 'screen' } });
    expect(c.r).toBeLessThanOrEqual(255);
  });

  test('returns whole numbers', () => {
    const c = applyColor(red, { saturation: 0.37 });
    expect(Number.isInteger(c.r)).toBe(true);
  });
});
