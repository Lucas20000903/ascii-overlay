export interface ToneOptions {
  /** 1 leaves contrast alone; higher steepens around mid grey. */
  contrast?: number;
  /** Added after contrast. 0 leaves brightness alone. */
  brightness?: number;
  /** 1 is linear; below 1 darkens midtones, above 1 lifts them. */
  gamma?: number;
}

const PIVOT = 0.5;

/**
 * Shape a cell's luminance before a glyph is chosen.
 *
 * Applied in order: gamma, then contrast around mid grey, then brightness.
 * Contrast pivots at 0.5 so raising it does not also brighten the frame.
 */
export function applyTone(lum: number, options: ToneOptions): number {
  const { contrast = 1, brightness = 0, gamma = 1 } = options;

  let y = lum;
  if (gamma !== 1) y = Math.pow(y, 1 / gamma);
  if (contrast !== 1) y = (y - PIVOT) * contrast + PIVOT;
  if (brightness !== 0) y += brightness;

  return y < 0 ? 0 : y > 1 ? 1 : y;
}
