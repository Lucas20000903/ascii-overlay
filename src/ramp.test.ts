import { describe, expect, test } from 'vitest';
import { glyphIndex, glyphFor } from './ramp.js';

describe('glyphIndex', () => {
  test('maps luminance 0 to the first glyph', () => {
    expect(glyphIndex(0, 10)).toBe(0);
  });

  test('maps luminance 1 to the last glyph', () => {
    expect(glyphIndex(1, 10)).toBe(9);
  });

  test('divides the range into equal buckets', () => {
    // 4 buckets: [0,.25) [.25,.5) [.5,.75) [.75,1]
    expect(glyphIndex(0.1, 4)).toBe(0);
    expect(glyphIndex(0.3, 4)).toBe(1);
    expect(glyphIndex(0.6, 4)).toBe(2);
    expect(glyphIndex(0.9, 4)).toBe(3);
  });

  test('never leaves the ramp bounds for any luminance', () => {
    for (let i = 0; i <= 200; i++) {
      const idx = glyphIndex(i / 200, 7);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThanOrEqual(6);
    }
  });

  test('is monotonic in luminance', () => {
    let prev = -1;
    for (let i = 0; i <= 200; i++) {
      const idx = glyphIndex(i / 200, 7);
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
  });
});

describe('glyphFor', () => {
  test('reads the ramp dark-to-bright', () => {
    expect(glyphFor(0, ' .:-=+*#%@')).toBe(' ');
    expect(glyphFor(1, ' .:-=+*#%@')).toBe('@');
  });

  test('rejects an empty ramp', () => {
    expect(() => glyphFor(0.5, '')).toThrow(/ramp/i);
  });
});
