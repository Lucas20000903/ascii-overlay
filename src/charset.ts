/**
 * Built-in glyph ramps, each ordered dark to bright and starting blank so empty
 * areas stay empty.
 */
export const RAMPS = {
  minimal: ' .:#',
  standard: ' .:-=+*#%@',
  detailed: ' .,:;irsXA253hMHGS#9B&@',
  blocks: ' ░▒▓█',
} as const;

export type RampName = keyof typeof RAMPS;

const isRampName = (v: string): v is RampName => v in RAMPS;

/**
 * Turn a ramp name or a literal ramp into the string to index.
 *
 * `invert` reverses it, so bright areas take the dense glyphs - the look you
 * want when drawing dark ink on a light background.
 */
export function resolveRamp(spec: string, invert = false): string {
  const ramp = isRampName(spec) ? RAMPS[spec] : spec;
  if (ramp.length === 0) throw new Error('ramp must contain at least one glyph');
  return invert ? [...ramp].reverse().join('') : ramp;
}
