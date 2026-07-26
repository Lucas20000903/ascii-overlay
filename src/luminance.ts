const WR = 0.2126, WG = 0.7152, WB = 0.0722;

/** Largest value the weighted sum can take, computed the same way as the sum
 *  itself so that white divides to exactly 1 rather than 1 - epsilon. */
const MAX = WR * 255 + WG * 255 + WB * 255;

/** Relative luminance (Rec. 709) of an 8-bit sRGB triple, in [0, 1]. */
export function luminance(r: number, g: number, b: number): number {
  const y = (WR * r + WG * g + WB * b) / MAX;
  return y < 0 ? 0 : y > 1 ? 1 : y;
}
