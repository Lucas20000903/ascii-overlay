import { describe, expect, test } from 'vitest';
import { shimmerAt } from './animate.js';

describe('shimmerAt', () => {
  test('is silent when shimmer is off', () => {
    expect(shimmerAt(3, 4, { time: 1.5 })).toBe(0);
    expect(shimmerAt(3, 4, { time: 1.5, shimmer: 0 })).toBe(0);
  });

  test('stays inside the requested amplitude', () => {
    for (let t = 0; t < 40; t++) {
      const v = shimmerAt(t % 7, (t * 3) % 5, { time: t / 10, shimmer: 0.25 });
      expect(Math.abs(v)).toBeLessThanOrEqual(0.25 + 1e-9);
    }
  });

  test('gives neighbouring cells different phases', () => {
    const a = shimmerAt(0, 0, { time: 0.3, shimmer: 1 });
    const b = shimmerAt(1, 0, { time: 0.3, shimmer: 1 });
    expect(a).not.toBeCloseTo(b, 6);
  });

  test('moves as time passes', () => {
    const a = shimmerAt(2, 2, { time: 0, shimmer: 1 });
    const b = shimmerAt(2, 2, { time: 0.25, shimmer: 1 });
    expect(a).not.toBeCloseTo(b, 6);
  });

  test('freezes when speed is zero', () => {
    const a = shimmerAt(2, 2, { time: 0, shimmer: 1, speed: 0 });
    const b = shimmerAt(2, 2, { time: 99, shimmer: 1, speed: 0 });
    expect(a).toBeCloseTo(b, 9);
  });

  test('repeats exactly for the same inputs', () => {
    const args = { time: 1.234, shimmer: 0.5, seed: 7 } as const;
    expect(shimmerAt(5, 6, args)).toBe(shimmerAt(5, 6, args));
  });

  test('changes pattern with the seed', () => {
    const a = shimmerAt(5, 6, { time: 1, shimmer: 1, seed: 1 });
    const b = shimmerAt(5, 6, { time: 1, shimmer: 1, seed: 2 });
    expect(a).not.toBeCloseTo(b, 6);
  });
});
