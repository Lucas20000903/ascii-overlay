import { describe, expect, test } from 'vitest';
import { drawToCanvas } from './canvas.js';
import type { Ctx2D } from './canvas.js';
import type { Grid } from './grid.js';

interface Call { op: string; args: unknown[] }

function recorder(width = 40, height = 10) {
  const calls: Call[] = [];
  const styles: string[] = [];
  const ctx: Ctx2D & { calls: Call[]; styles: string[] } = {
    canvas: { width, height },
    fillStyle: '',
    font: '',
    textBaseline: '',
    filter: 'none',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    save: () => { calls.push({ op: 'save', args: [] }); },
    setTransform: (...args) => { calls.push({ op: 'setTransform', args }); },
    measureText: (t: string) => ({ width: 0 }),
    restore: () => { calls.push({ op: 'restore', args: [] }); },
    drawImage: (...args) => { calls.push({ op: 'drawImage', args }); },
    clearRect: (...args) => { calls.push({ op: 'clearRect', args }); },
    fillRect: (...args) => { calls.push({ op: 'fillRect', args }); },
    fillText(...args) { styles.push(this.fillStyle as string); calls.push({ op: 'fillText', args }); },
    calls,
    styles,
  };
  return ctx;
}

const grid: Grid = {
  cols: 2, rows: 1,
  cells: [
    { char: 'a', color: { r: 1, g: 2, b: 3 }, x: 0, y: 0, col: 0, row: 0 },
    { char: ' ', color: { r: 0, g: 0, b: 0 }, x: 8, y: 0, col: 1, row: 0 },
  ],
};

describe('drawToCanvas', () => {
  test('paints the background over the whole canvas', () => {
    const ctx = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8, background: '#123' });
    expect(ctx.calls[0]).toEqual({ op: 'fillRect', args: [0, 0, 40, 10] });
  });

  test('clears instead of filling when no background is given', () => {
    const ctx = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8 });
    expect(ctx.calls[0]!.op).toBe('clearRect');
  });

  test('uses a monospace font at the requested size', () => {
    const ctx = recorder();
    drawToCanvas(ctx, grid, { fontSize: 12 });
    expect(ctx.font).toBe('12px monospace');
  });

  test('anchors glyphs from their top-left corner', () => {
    const ctx = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8 });
    expect(ctx.textBaseline).toBe('top');
  });

  test('draws only the visible glyphs', () => {
    const ctx = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8 });
    const text = ctx.calls.filter(c => c.op === 'fillText');
    expect(text).toHaveLength(1);
    expect(text[0]!.args).toEqual(['a', 0, 0]);
  });

  test('draws each glyph in its cell colour', () => {
    const ctx = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8 });
    expect(ctx.styles).toEqual(['rgb(1,2,3)']);
  });
});
