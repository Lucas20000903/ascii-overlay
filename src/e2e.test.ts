import { writeFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { renderAscii, DEFAULT_RAMP } from './render.js';
import { gridToText } from './text.js';
import { glyphIndex } from './ramp.js';
import { luminance } from './luminance.js';
import type { Source } from './grid.js';

/** Left-to-right luminance ramp, with RGB bands down the frame. */
function testChart(width: number, height: number): Source {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const band = Math.floor((y * 4) / height);
    for (let x = 0; x < width; x++) {
      const v = Math.round((x * 255) / (width - 1));
      const [r, g, b] = band === 0 ? [v, v, v]
        : band === 1 ? [v, 0, 0]
        : band === 2 ? [0, v, 0]
        : [0, 0, v];
      const i = (y * width + x) * 4;
      data[i] = r!; data[i + 1] = g!; data[i + 2] = b!; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('a luminance ramp end to end', () => {
  const chart = testChart(64, 32);

  test('brightens monotonically across the grey band', () => {
    const grid = renderAscii(chart, {
      mode: 'characters', cellWidth: 2, cellHeight: 8, ramp: DEFAULT_RAMP,
    });
    const greyRow = grid.cells.filter(c => c.row === 0);
    const indices = greyRow.map(c => DEFAULT_RAMP.indexOf(c.char));

    expect(indices[0]).toBe(0);
    expect(indices.at(-1)).toBe(DEFAULT_RAMP.length - 1);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]!).toBeGreaterThanOrEqual(indices[i - 1]!);
    }
  });

  test('reaches a brighter glyph in the green band than the blue band', () => {
    const grid = renderAscii(chart, {
      mode: 'characters', cellWidth: 2, cellHeight: 8, ramp: DEFAULT_RAMP,
    });
    const brightest = (row: number) => Math.max(
      ...grid.cells.filter(c => c.row === row).map(c => DEFAULT_RAMP.indexOf(c.char)));
    expect(brightest(2)).toBeGreaterThan(brightest(3)); // green outshines blue
  });

  test('agrees with the per-cell luminance it was built from', () => {
    const grid = renderAscii(chart, {
      mode: 'characters', cellWidth: 4, cellHeight: 8, ramp: DEFAULT_RAMP,
    });
    for (const cell of grid.cells) {
      const expected = glyphIndex(
        luminance(cell.color.r, cell.color.g, cell.color.b), DEFAULT_RAMP.length);
      // the cell colour is rounded, so allow the neighbouring bucket
      expect(Math.abs(DEFAULT_RAMP.indexOf(cell.char) - expected)).toBeLessThanOrEqual(1);
    }
  });

  test('fills braille cells in the bright half and empties them in the dark half', () => {
    const grid = renderAscii(chart, { mode: 'braille', cellWidth: 4, cellHeight: 8 });
    const row = grid.cells.filter(c => c.row === 0);
    expect(row[0]!.char).toBe('⠀');            // darkest cell is blank
    expect(row.at(-1)!.char).toBe('⣿');        // brightest cell is full
  });

  test('writes a sample of each mode for eyeballing', () => {
    const parts: string[] = [];
    for (const mode of ['characters', 'braille', 'dither'] as const) {
      const grid = renderAscii(chart, {
        mode, cellWidth: mode === 'braille' ? 2 : 1, cellHeight: mode === 'braille' ? 4 : 2,
        ramp: DEFAULT_RAMP,
      });
      parts.push(`--- ${mode} (${grid.cols}x${grid.rows}) ---`, gridToText(grid), '');
    }
    const art = parts.join('\n');
    writeFileSync('sample-art.txt', art);
    expect(art).toContain('---');
  });
});
