import { cellPhase } from './coverage.js';

export interface ShimmerOptions {
  /** Monotonic time, in whatever unit the caller drives. */
  time: number;
  /** Amplitude of the wobble, in glyph steps. 0 (default) disables it. */
  shimmer?: number;
  /** Cycles per unit of time. 0 freezes the pattern. Defaults to 1. */
  speed?: number;
  seed?: number;
}

const TAU = Math.PI * 2;

/**
 * Per-cell wobble to add to a glyph index, in [-shimmer, +shimmer].
 *
 * Each cell gets its own phase from a hash, so the frame ripples instead of
 * pulsing as one block. Purely a function of its arguments - the same time
 * always yields the same frame, which is what makes recording reproducible.
 */
export function shimmerAt(col: number, row: number, options: ShimmerOptions): number {
  const { time, shimmer = 0, speed = 1, seed = 0 } = options;
  if (shimmer === 0) return 0;
  return Math.sin(TAU * (time * speed + cellPhase(col, row, seed))) * shimmer;
}
