import { describe, expect, test } from 'vitest';
import { renderAscii } from './render.js';
import { RAMPS } from './charset.js';
import type { Source } from './grid.js';

const RAMP = ' .:-=+*#%@';
const BLANK_BRAILLE = '⠀';

function src(width: number, height: number, px: [number, number, number][]): Source {
  const data = new Uint8ClampedArray(width * height * 4);
  px.forEach(([r, g, b], i) => {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  });
  return { width, height, data };
}
const solid = (w: number, h: number, v: number): Source =>
  src(w, h, Array.from({ length: w * h }, () => [v, v, v] as [number, number, number]));

const base = { mode: 'characters', cellWidth: 1, cellHeight: 1, ramp: RAMP } as const;
const chars = (s: Source, o: object = {}) =>
  renderAscii(s, { ...base, ...o }).cells.map(c => c.char).join('');

describe('Characters section', () => {
  test('resolves a named ramp', () => {
    const g = renderAscii(solid(1, 1, 255), { ...base, ramp: 'blocks' });
    expect(g.cells[0]!.char).toBe(RAMPS.blocks.at(-1));
  });

  test('invert flips which end of the ramp bright areas take', () => {
    expect(chars(solid(1, 1, 255), { invert: true })).toBe(' ');
    expect(chars(solid(1, 1, 0), { invert: true })).toBe('@');
  });
});

describe('Intensity section', () => {
  test('contrast pushes a light-mid cell to a denser glyph', () => {
    const plain = chars(solid(1, 1, 170));
    const punchy = chars(solid(1, 1, 170), { tone: { contrast: 2 } });
    expect(RAMP.indexOf(punchy)).toBeGreaterThan(RAMP.indexOf(plain));
  });

  test('brightness lifts a dark cell off blank', () => {
    expect(chars(solid(1, 1, 0))).toBe(' ');
    expect(chars(solid(1, 1, 0), { tone: { brightness: 0.5 } })).not.toBe(' ');
  });

  test('darkThreshold blanks cells below it but keeps the grid shape', () => {
    const g = renderAscii(solid(2, 1, 60), { ...base, darkThreshold: 0.5 });
    expect(g.cols).toBe(2);
    expect(g.cells.map(c => c.char)).toEqual([' ', ' ']);
  });

  test('edgeEmphasis marks the boundary and leaves flat areas blank', () => {
    const ramp = src(6, 1, [[0,0,0],[0,0,0],[0,0,0],[255,255,255],[255,255,255],[255,255,255]]);
    const out = chars(ramp, { edgeEmphasis: 1 });
    expect(out[0]).toBe(' ');            // flat dark
    expect(out[5]).toBe(' ');            // flat bright
    expect(out[2]).not.toBe(' ');        // boundary
    expect(out[3]).not.toBe(' ');
  });

  test('coverage 0 blanks every cell without changing the grid', () => {
    const g = renderAscii(solid(4, 2, 255), { ...base, coverage: 0 });
    expect(g.cells).toHaveLength(8);
    expect(new Set(g.cells.map(c => c.char))).toEqual(new Set([' ']));
  });

  test('coverage thins a bright field without emptying it', () => {
    const g = renderAscii(solid(30, 30, 255), { ...base, coverage: 0.5 });
    const drawn = g.cells.filter(c => c.char !== ' ').length;
    expect(drawn).toBeGreaterThan(300);
    expect(drawn).toBeLessThan(600);
  });
});

describe('Color section', () => {
  test('bw preset flattens the cell colour', () => {
    const g = renderAscii(src(1, 1, [[200, 40, 40]]), { ...base, grade: { preset: 'bw' } });
    const { r, g: gg, b } = g.cells[0]!.color;
    expect(r).toBe(gg);
    expect(gg).toBe(b);
  });

  test('a tint shifts the cell colour', () => {
    const plain = renderAscii(src(1, 1, [[200, 200, 200]]), base).cells[0]!.color;
    const tinted = renderAscii(src(1, 1, [[200, 200, 200]]),
      { ...base, grade: { tint: { color: { r: 255, g: 0, b: 0 } } } }).cells[0]!.color;
    expect(tinted.b).toBeLessThan(plain.b);
  });

  test('grading the colour does not change the glyph', () => {
    expect(chars(solid(1, 1, 200), { grade: { preset: 'cool' } }))
      .toBe(chars(solid(1, 1, 200)));
  });
});

describe('Mask section', () => {
  const source = solid(4, 1, 255);
  /** Shapes live in user code now; the renderer only sees a predicate. */
  const mask = (col: number) => col < 2;

  test('keeps glyphs inside the mask and blanks the rest', () => {
    expect(chars(source, { mask })).toBe('@@  ');
  });

  test('applies to braille mode as well', () => {
    const g = renderAscii(solid(4, 4, 255), {
      mode: 'braille', cellWidth: 2, cellHeight: 4,
      mask: (col: number) => col === 0,
    });
    expect(g.cells.map(c => c.char)).toEqual(['⣿', BLANK_BRAILLE]);
  });

  test('applies to dither mode as well', () => {
    const g = renderAscii(solid(4, 1, 255), {
      mode: 'dither', cellWidth: 1, cellHeight: 1,
      mask: (col: number) => col < 2,
    });
    expect(g.cells.map(c => c.char).slice(2)).toEqual([' ', ' ']);
  });
});

describe('Animation section', () => {
  test('shimmer changes the frame as time advances', () => {
    const s = solid(20, 4, 130);
    const a = chars(s, { animation: { time: 0, shimmer: 3 } });
    const b = chars(s, { animation: { time: 0.5, shimmer: 3 } });
    expect(a).not.toBe(b);
  });

  test('the same time always gives the same frame', () => {
    const s = solid(20, 4, 130);
    const opts = { animation: { time: 0.37, shimmer: 3 } };
    expect(chars(s, opts)).toBe(chars(s, opts));
  });

  test('no shimmer leaves the frame static', () => {
    const s = solid(20, 4, 130);
    expect(chars(s, { animation: { time: 0 } })).toBe(chars(s, { animation: { time: 5 } }));
  });
});
