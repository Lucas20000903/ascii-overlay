import type { RGB, Source } from './grid.js';

const clamp = (v: number, hi: number) => (v < 0 ? 0 : v > hi ? hi : v);

/**
 * Mean colour of a source rectangle given in (possibly fractional) pixels.
 *
 * Cell sizes are routinely fractional - a monospace advance width is something
 * like 6.6px - so the rectangle is snapped to whole pixels before sampling.
 * Without that, indices land between elements, reads come back `undefined` and
 * the whole colour turns into NaN.
 *
 * A rectangle that falls outside the image is clamped to the nearest edge pixel,
 * so no cell is left without a colour and edges do not darken.
 */
export function meanColorRect(
  source: Source,
  fx0: number, fy0: number, fx1: number, fy1: number,
): RGB {
  if (source.width === 0 || source.height === 0) return { r: 0, g: 0, b: 0 };

  // Pull the rectangle inside the image rather than letting it collapse. A
  // sub-cell that lands entirely past the edge would otherwise read as black
  // and leave a dark fringe down the right and bottom of every render.
  const x0 = clamp(Math.floor(fx0), source.width - 1);
  const y0 = clamp(Math.floor(fy0), source.height - 1);
  let x1 = clamp(Math.floor(fx1), source.width);
  let y1 = clamp(Math.floor(fy1), source.height);
  if (x1 <= x0) x1 = x0 + 1;
  if (y1 <= y0) y1 = y0 + 1;

  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    let i = (y * source.width + x0) * 4;
    for (let x = x0; x < x1; x++, i += 4) {
      sr += source.data[i]!;
      sg += source.data[i + 1]!;
      sb += source.data[i + 2]!;
      n++;
    }
  }

  return n === 0 ? { r: 0, g: 0, b: 0 } : { r: sr / n, g: sg / n, b: sb / n };
}

/** Mean colour of one grid cell. */
export function meanColorCell(
  source: Source,
  col: number, row: number, cellWidth: number, cellHeight: number,
): RGB {
  return meanColorRect(
    source,
    col * cellWidth, row * cellHeight,
    (col + 1) * cellWidth, (row + 1) * cellHeight,
  );
}

export const roundRGB = (c: RGB): RGB =>
  ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) });
