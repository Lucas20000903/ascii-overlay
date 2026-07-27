import { describe, expect, test } from 'vitest';
import { drawToCanvas } from './canvas.js';
import type { Ctx2D } from './canvas.js';
import type { Grid } from './grid.js';

interface Call { op: string; args: unknown[] }

/** Recorder whose font advances `wide` for M and `narrow` for everything else. */
function recorder(wide: number, narrow: number) {
  const calls: Call[] = [];
  const ctx = {
    canvas: { width: 200, height: 40 },
    fillStyle: '', font: '', textBaseline: '', filter: 'none', globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    measureText: (t: string) => ({
      width: [...t].reduce((sum, c) => sum + (c === 'M' ? wide : narrow), 0),
    }),
    setTransform: () => {}, save: () => {}, restore: () => {},
    clearRect: () => {}, fillRect: () => {}, drawImage: () => {},
    fillText: (...args: unknown[]) => { calls.push({ op: 'fillText', args }); },
  };
  return { ctx: ctx as unknown as Ctx2D, calls };
}

/** Four glyphs stepping `step` px apart. */
const row = (chars: string, step: number): Grid => ({
  cols: chars.length, rows: 1,
  cells: [...chars].map((char, i) => ({
    char, color: { r: 9, g: 9, b: 9 }, x: i * step, y: 0, col: i, row: 0,
  })),
});

const texts = (calls: Call[]) => calls.map(c => c.args);

describe('proportional fonts', () => {
  test('batches when every glyph advances the same', () => {
    const { ctx, calls } = recorder(6, 6);
    drawToCanvas(ctx, row('iiii', 6), { fontSize: 10 });
    expect(texts(calls)).toEqual([['iiii', 0, 0]]);
  });

  test('does not batch when the font is proportional', () => {
    // cells are sized to M, but 'i' is narrower - a batched run would pack the
    // glyphs into a fraction of the space they are meant to occupy
    const { ctx, calls } = recorder(18, 6);
    drawToCanvas(ctx, row('iiii', 18), { fontSize: 10 });
    expect(texts(calls)).toEqual([
      ['i', 0, 0], ['i', 18, 0], ['i', 36, 0], ['i', 54, 0],
    ]);
  });

  test('still places every glyph in its own cell when it cannot batch', () => {
    const { ctx, calls } = recorder(18, 6);
    drawToCanvas(ctx, row('Mi', 18), { fontSize: 10 });
    expect(texts(calls)).toEqual([['M', 0, 0], ['i', 18, 0]]);
  });
});
