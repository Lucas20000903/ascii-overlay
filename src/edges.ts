/** Largest magnitude a Sobel pair can reach on 0..1 input. */
const MAX_MAGNITUDE = 4 * Math.SQRT2;

const KX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
const KY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

/**
 * Sobel edge magnitude per pixel, normalised to 0..1.
 *
 * Border pixels replicate the nearest row and column, so an edge running along
 * the frame does not read as a phantom gradient.
 */
export function sobel(
  gray: readonly number[] | Float32Array,
  width: number,
  height: number,
): Float32Array {
  if (gray.length !== width * height) {
    throw new Error(`gray length ${gray.length} does not match ${width}x${height}`);
  }

  const clampX = (x: number) => (x < 0 ? 0 : x > width - 1 ? width - 1 : x);
  const clampY = (y: number) => (y < 0 ? 0 : y > height - 1 ? height - 1 : y);
  const out = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let gx = 0, gy = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++, k++) {
          const v = gray[clampY(y + dy) * width + clampX(x + dx)]!;
          gx += v * KX[k]!;
          gy += v * KY[k]!;
        }
      }
      const m = Math.hypot(gx, gy) / MAX_MAGNITUDE;
      out[y * width + x] = m > 1 ? 1 : m;
    }
  }

  return out;
}
