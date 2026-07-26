import { luminance } from './luminance.js';
import type { RGB } from './grid.js';

export type TintPreset =
  | 'none' | 'bw' | 'sepia' | 'warm' | 'cool' | 'vintage' | 'fade' | 'cyber';

export type BlendMode = 'multiply' | 'screen' | 'overlay' | 'soft-light';

export interface Tint {
  color: RGB;
  /** Defaults to `multiply`. */
  blend?: BlendMode;
  /** 0..1, how far to mix the blended result in. Defaults to 1. */
  opacity?: number;
}

export interface ColorOptions {
  preset?: TintPreset;
  /** 1 leaves saturation alone, 0 is fully grey, above 1 oversaturates. */
  saturation?: number;
  tint?: Tint;
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const grey = (c: RGB) => luminance(c.r, c.g, c.b) * 255;

const scale = (c: RGB, kr: number, kg: number, kb: number): RGB =>
  ({ r: c.r * kr, g: c.g * kg, b: c.b * kb });

/** Mix `c` towards its own grey level. */
function saturate(c: RGB, amount: number): RGB {
  const y = grey(c);
  return {
    r: y + (c.r - y) * amount,
    g: y + (c.g - y) * amount,
    b: y + (c.b - y) * amount,
  };
}

function sepia(c: RGB): RGB {
  return {
    r: 0.393 * c.r + 0.769 * c.g + 0.189 * c.b,
    g: 0.349 * c.r + 0.686 * c.g + 0.168 * c.b,
    b: 0.272 * c.r + 0.534 * c.g + 0.131 * c.b,
  };
}

/** Lift shadows towards mid grey, the way a faded print does. */
function fade(c: RGB): RGB {
  const lift = (v: number) => v * 0.75 + 40;
  return saturate({ r: lift(c.r), g: lift(c.g), b: lift(c.b) }, 0.7);
}

const PRESETS: Record<TintPreset, (c: RGB) => RGB> = {
  none: c => c,
  bw: c => { const y = grey(c); return { r: y, g: y, b: y }; },
  sepia,
  warm: c => scale(c, 1.12, 1.0, 0.86),
  cool: c => scale(c, 0.88, 1.0, 1.14),
  vintage: c => saturate(sepia(c), 0.65),
  fade,
  cyber: c => scale(saturate(c, 1.25), 0.72, 1.08, 1.32),
};

/** Channel blends, on 0..1 values. */
const BLENDS: Record<BlendMode, (base: number, top: number) => number> = {
  multiply: (a, b) => a * b,
  screen: (a, b) => 1 - (1 - a) * (1 - b),
  overlay: (a, b) => (a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b)),
  'soft-light': (a, b) =>
    b < 0.5 ? a - (1 - 2 * b) * a * (1 - a)
            : a + (2 * b - 1) * ((a < 0.25 ? ((16 * a - 12) * a + 4) * a : Math.sqrt(a)) - a),
};

function blendTint(c: RGB, tint: Tint): RGB {
  const { opacity = 1 } = tint;
  if (opacity === 0) return c;
  const f = BLENDS[tint.blend ?? 'multiply'];
  const mix = (base: number, top: number) => {
    const blended = f(base / 255, top / 255) * 255;
    return base + (blended - base) * opacity;
  };
  return {
    r: mix(c.r, tint.color.r),
    g: mix(c.g, tint.color.g),
    b: mix(c.b, tint.color.b),
  };
}

/**
 * Grade a cell's colour: preset first, then saturation, then the tint blend.
 *
 * Returns whole channel values so the result can go straight into a css colour.
 */
export function applyColor(color: RGB, options: ColorOptions): RGB {
  let c = PRESETS[options.preset ?? 'none'](color);
  if (options.saturation !== undefined && options.saturation !== 1) {
    c = saturate(c, options.saturation);
  }
  if (options.tint) c = blendTint(c, options.tint);
  return {
    r: Math.round(clamp255(c.r)),
    g: Math.round(clamp255(c.g)),
    b: Math.round(clamp255(c.b)),
  };
}
