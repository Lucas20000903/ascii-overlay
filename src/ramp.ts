/**
 * Bucket a luminance into a glyph slot.
 *
 * Buckets are equal width; the top bucket is closed so luminance 1 lands on
 * the last glyph instead of overflowing.
 */
export function glyphIndex(lum: number, count: number): number {
  if (count < 1) throw new Error('ramp must contain at least one glyph');
  const i = Math.floor(lum * count);
  return i < 0 ? 0 : i > count - 1 ? count - 1 : i;
}

/** Pick a glyph from a ramp written dark-to-bright. */
export function glyphFor(lum: number, ramp: string): string {
  if (ramp.length === 0) throw new Error('ramp must contain at least one glyph');
  return ramp[glyphIndex(lum, ramp.length)]!;
}
