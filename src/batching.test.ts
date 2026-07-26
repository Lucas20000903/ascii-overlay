import { describe, expect, test } from 'vitest';
import { drawToCanvas } from './canvas.js';
import type { Ctx2D } from './canvas.js';
import type { Cell, Grid } from './grid.js';

interface Call { op: string; args: unknown[] }

/** Recorder whose font advances `advance` px per glyph. */
function recorder(advance: number) {
  const calls: Call[] = [];
  const ctx = {
    canvas: { width: 100, height: 20 },
    fillStyle: '', font: '', textBaseline: '', filter: 'none', globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    measureText: (text: string) => ({ width: text.length * advance }),
    setTransform: () => {},
    save: () => { calls.push({ op: 'save', args: [] }); },
    restore: () => { calls.push({ op: 'restore', args: [] }); },
    clearRect: (...args: unknown[]) => { calls.push({ op: 'clearRect', args }); },
    fillRect: (...args: unknown[]) => { calls.push({ op: 'fillRect', args }); },
    drawImage: (...args: unknown[]) => { calls.push({ op: 'drawImage', args }); },
    fillText: (...args: unknown[]) => { calls.push({ op: 'fillText', args }); },
  };
  return { ctx: ctx as unknown as Ctx2D, calls };
}

const cell = (char: string, col: number, cw: number): Cell => ({
  char, color: { r: 9, g: 9, b: 9 }, x: col * cw, y: 0, col, row: 0,
});

/** Four same-coloured glyphs in a row, cells `cw` wide. */
const rowOf = (chars: string, cw: number): Grid => ({
  cols: chars.length, rows: 1,
  cells: [...chars].map((c, i) => cell(c, i, cw)),
});

const texts = (calls: Call[]) => calls.filter(c => c.op === 'fillText').map(c => c.args);

describe('glyph batching', () => {
  test('draws a whole run in one call when the cells match the font advance', () => {
    const { ctx, calls } = recorder(6);
    drawToCanvas(ctx, rowOf('abcd', 6), { fontSize: 10 });
    expect(texts(calls)).toEqual([['abcd', 0, 0]]);
  });

  test('falls back to one call per glyph when the cells are wider than the font', () => {
    // batching would let the text drift out of its cells
    const { ctx, calls } = recorder(6);
    drawToCanvas(ctx, rowOf('abcd', 9), { fontSize: 10 });
    expect(texts(calls)).toEqual([
      ['a', 0, 0], ['b', 9, 0], ['c', 18, 0], ['d', 27, 0],
    ]);
  });

  test('falls back when the cells are narrower than the font', () => {
    const { ctx, calls } = recorder(6);
    drawToCanvas(ctx, rowOf('ab', 4), { fontSize: 10 });
    expect(texts(calls)).toHaveLength(2);
  });

  test('breaks a batch where a blank interrupts', () => {
    const { ctx, calls } = recorder(6);
    drawToCanvas(ctx, rowOf('ab cd', 6), { fontSize: 10 });
    expect(texts(calls)).toEqual([['ab', 0, 0], ['cd', 18, 0]]);
  });

  test('breaks a batch where the colour changes', () => {
    const grid: Grid = {
      cols: 2, rows: 1,
      cells: [
        { char: 'a', color: { r: 1, g: 1, b: 1 }, x: 0, y: 0, col: 0, row: 0 },
        { char: 'b', color: { r: 2, g: 2, b: 2 }, x: 6, y: 0, col: 1, row: 0 },
      ],
    };
    const { ctx, calls } = recorder(6);
    drawToCanvas(ctx, grid, { fontSize: 10 });
    expect(texts(calls)).toEqual([['a', 0, 0], ['b', 6, 0]]);
  });

  test('batches a whole row under a flat colour override', () => {
    const grid: Grid = {
      cols: 3, rows: 1,
      cells: [
        { char: 'a', color: { r: 1, g: 1, b: 1 }, x: 0, y: 0, col: 0, row: 0 },
        { char: 'b', color: { r: 2, g: 2, b: 2 }, x: 6, y: 0, col: 1, row: 0 },
        { char: 'c', color: { r: 3, g: 3, b: 3 }, x: 12, y: 0, col: 2, row: 0 },
      ],
    };
    const { ctx, calls } = recorder(6);
    drawToCanvas(ctx, grid, { fontSize: 10, color: '#fff' });
    expect(texts(calls)).toEqual([['abc', 0, 0]]);
  });

  test('cannot batch a single-column grid, so draws it per glyph', () => {
    const { ctx, calls } = recorder(6);
    drawToCanvas(ctx, rowOf('a', 6), { fontSize: 10 });
    expect(texts(calls)).toEqual([['a', 0, 0]]);
  });
});

describe('clear', () => {
  test('clears before drawing by default', () => {
    const { ctx, calls } = recorder(6);
    drawToCanvas(ctx, rowOf('ab', 6), { fontSize: 10 });
    expect(calls[0]!.op).toBe('clearRect');
  });

  test('leaves what is already there when clear is off', () => {
    const { ctx, calls } = recorder(6);
    drawToCanvas(ctx, rowOf('ab', 6), { fontSize: 10, clear: false });
    expect(calls.some(c => c.op === 'clearRect' || c.op === 'fillRect')).toBe(false);
  });

  test('still paints a background when one is given and clear is off', () => {
    const { ctx, calls } = recorder(6);
    drawToCanvas(ctx, rowOf('ab', 6), { fontSize: 10, clear: false, background: '#000' });
    expect(calls.some(c => c.op === 'fillRect')).toBe(true);
  });
});
