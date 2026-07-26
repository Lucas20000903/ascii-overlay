import { describe, expect, test } from 'vitest';
import { RAMPS, resolveRamp } from './charset.js';

describe('resolveRamp', () => {
  test('resolves a named preset', () => {
    expect(resolveRamp('standard')).toBe(RAMPS.standard);
  });

  test('offers a denser preset than standard', () => {
    expect(RAMPS.detailed.length).toBeGreaterThan(RAMPS.standard.length);
  });

  test('offers a sparser preset than standard', () => {
    expect(RAMPS.minimal.length).toBeLessThan(RAMPS.standard.length);
  });

  test('passes a custom ramp through unchanged', () => {
    expect(resolveRamp(' .#')).toBe(' .#');
  });

  test('reverses the ramp when inverted', () => {
    expect(resolveRamp(' .#', true)).toBe('#. ');
  });

  test('every preset runs dark to bright, starting from blank', () => {
    for (const ramp of Object.values(RAMPS)) {
      expect(ramp[0]).toBe(' ');
      expect(ramp.length).toBeGreaterThan(1);
    }
  });

  test('rejects an empty ramp', () => {
    expect(() => resolveRamp('')).toThrow(/ramp/i);
  });
});
