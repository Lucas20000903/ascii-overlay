export interface DitherOptions {
  /** Grey level at or above which a pixel turns on. Defaults to 0.5. */
  threshold?: number;
}

/** Error diffusion weights, as fractions of 16, relative to the current pixel. */
const DIFFUSION: readonly [dx: number, dy: number, weight: number][] = [
  [1, 0, 7 / 16],
  [-1, 1, 3 / 16],
  [0, 1, 5 / 16],
  [1, 1, 1 / 16],
];

/**
 * Binarise a greyscale image with Floyd-Steinberg error diffusion.
 *
 * `gray` holds values in 0..1 in raster order. The returned array holds one
 * 0 or 1 per pixel. Input is not modified.
 */
export function floydSteinberg(
  gray: readonly number[] | Float32Array,
  width: number,
  height: number,
  options: DitherOptions = {},
): Uint8Array {
  if (gray.length !== width * height) {
    throw new Error(`gray length ${gray.length} does not match ${width}x${height}`);
  }
  const threshold = options.threshold ?? 0.5;

  const buf = Float32Array.from(gray);
  const out = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const value = buf[i]!;
      const bit = value >= threshold ? 1 : 0;
      out[i] = bit;

      const error = value - bit;
      if (error === 0) continue;
      for (const [dx, dy, weight] of DIFFUSION) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny >= height) continue;
        buf[ny * width + nx]! += error * weight;
      }
    }
  }

  return out;
}
