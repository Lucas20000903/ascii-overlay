const BRAILLE_BASE = 0x2800;

/**
 * Dot bit values for a 2-wide, 4-tall cell, indexed in raster order
 * (`index = y * 2 + x`).
 *
 * Unicode numbers braille dots down the left column, then down the right, with
 * the fourth row appended last:
 *
 *     1 4
 *     2 5
 *     3 6
 *     7 8
 */
const DOT_BITS = [
  0x01, 0x08, // y=0: dots 1, 4
  0x02, 0x10, // y=1: dots 2, 5
  0x04, 0x20, // y=2: dots 3, 6
  0x40, 0x80, // y=3: dots 7, 8
];

/** Encode eight raster-ordered dots as a braille character. */
export function brailleGlyph(dots: readonly boolean[]): string {
  if (dots.length !== DOT_BITS.length) {
    throw new Error('a braille cell needs exactly eight dots');
  }
  let mask = 0;
  for (let i = 0; i < DOT_BITS.length; i++) {
    if (dots[i]) mask |= DOT_BITS[i]!;
  }
  return String.fromCharCode(BRAILLE_BASE + mask);
}
