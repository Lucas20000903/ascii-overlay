import { luminance } from './luminance.js';
import type { Source } from './grid.js';

/** Single-channel coverage map, 0 (clear) to 255 (covered), one byte per pixel. */
export interface Mask {
  width: number;
  height: number;
  data: Uint8Array;
}

const blank = (width: number, height: number): Mask =>
  ({ width, height, data: new Uint8Array(width * height) });

export interface Rect { x: number; y: number; width: number; height: number }

/** Axis-aligned rectangle. */
export function rectMask(width: number, height: number, rect: Rect): Mask {
  const m = blank(width, height);
  const x1 = Math.min(width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(height, Math.ceil(rect.y + rect.height));
  for (let y = Math.max(0, Math.floor(rect.y)); y < y1; y++) {
    for (let x = Math.max(0, Math.floor(rect.x)); x < x1; x++) {
      m.data[y * width + x] = 255;
    }
  }
  return m;
}

export interface Ellipse { cx: number; cy: number; rx: number; ry: number }

/** Ellipse centred on `cx`,`cy`. */
export function ellipseMask(width: number, height: number, e: Ellipse): Mask {
  const m = blank(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - e.cx) / e.rx;
      const dy = (y - e.cy) / e.ry;
      if (dx * dx + dy * dy <= 1) m.data[y * width + x] = 255;
    }
  }
  return m;
}

export type Point = readonly [x: number, y: number];

/**
 * Arbitrary polygon, filled by the even-odd rule.
 *
 * This is the shape a freehand mask reduces to once its path is sampled.
 */
export function polygonMask(width: number, height: number, points: readonly Point[]): Mask {
  if (points.length < 3) throw new Error('a polygon needs at least three points');
  const m = blank(width, height);

  for (let y = 0; y < height; y++) {
    const py = y + 0.5;
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i]!;
        const [xj, yj] = points[j]!;
        if ((yi > py) !== (yj > py) &&
            px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      if (inside) m.data[y * width + x] = 255;
    }
  }
  return m;
}

/**
 * Mean coverage of a rectangle, as 0..1.
 *
 * Anything outside the mask counts as uncovered: the mask says where art is
 * allowed, so beyond its bounds the answer is "nowhere".
 */
export function sampleMask(
  mask: Mask,
  fx0: number, fy0: number, fx1: number, fy1: number,
): number {
  const x0 = Math.max(0, Math.floor(fx0));
  const y0 = Math.max(0, Math.floor(fy0));
  const x1 = Math.min(mask.width, Math.max(x0 + 1, Math.floor(fx1)));
  const y1 = Math.min(mask.height, Math.max(y0 + 1, Math.floor(fy1)));
  if (x0 >= mask.width || y0 >= mask.height) return 0;

  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      sum += mask.data[y * mask.width + x]!;
      n++;
    }
  }
  return n === 0 ? 0 : sum / n / 255;
}

export interface ImageMaskOptions {
  /** Which channel becomes coverage. Defaults to `alpha`. */
  from?: 'alpha' | 'luminance';
  invert?: boolean;
}

/**
 * Use an image as the mask.
 *
 * `alpha` suits a cut-out PNG; `luminance` suits a hand-painted black-and-white
 * matte, where white means "draw here". Grey levels carry through as partial
 * coverage, so a soft-edged matte gives a soft-edged boundary.
 */
export function imageMask(source: Source, options: ImageMaskOptions = {}): Mask {
  const { from = 'alpha', invert = false } = options;
  const data = new Uint8Array(source.width * source.height);

  for (let i = 0; i < data.length; i++) {
    const p = i * 4;
    const v = from === 'alpha'
      ? source.data[p + 3]!
      : Math.round(luminance(source.data[p]!, source.data[p + 1]!, source.data[p + 2]!) * 255);
    data[i] = invert ? 255 - v : v;
  }

  return { width: source.width, height: source.height, data };
}
