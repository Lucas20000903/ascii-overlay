/**
 * Stable pseudo-random value in [0, 1) for a cell.
 *
 * Hashed rather than drawn from `Math.random` so a cell keeps its verdict
 * between renders - a random draw would make the art flicker every frame.
 * Shared with the animation code, which uses it as a per-cell phase offset.
 */
export function cellPhase(col: number, row: number, seed: number): number {
  let h = (col * 0x1f1f1f1f) ^ (row * 0x85ebca6b) ^ (seed * 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x2545f491);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

/**
 * Whether a cell survives thinning.
 *
 * `coverage` is the fraction of cells to keep: 1 keeps everything, 0 keeps
 * nothing. Cells are chosen by hash, so the pattern is scattered rather than
 * dropping whole rows.
 */
export function shouldDraw(
  col: number,
  row: number,
  coverage: number,
  seed = 0,
): boolean {
  if (coverage >= 1) return true;
  if (coverage <= 0) return false;
  return cellPhase(col, row, seed) < coverage;
}
