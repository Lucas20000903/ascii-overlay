import { describe, expect, test } from 'vitest';
import { drawToCanvas } from './canvas.js';
import type { Ctx2D } from './canvas.js';
import type { Grid } from './grid.js';

interface Call { op: string; args: unknown[] }

function recorder(width: number, height: number) {
  const calls: Call[] = [];
  const ctx = {
    canvas: { width, height },
    fillStyle: '', font: '', textBaseline: '', filter: 'none', globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    save: () => { calls.push({ op: 'save', args: [] }); },
    restore: () => { calls.push({ op: 'restore', args: [] }); },
    setTransform: (...args: unknown[]) => { calls.push({ op: 'setTransform', args }); },
    clearRect: (...args: unknown[]) => { calls.push({ op: 'clearRect', args }); },
    fillRect: (...args: unknown[]) => { calls.push({ op: 'fillRect', args }); },
    drawImage: (...args: unknown[]) => { calls.push({ op: 'drawImage', args }); },
    fillText: (...args: unknown[]) => { calls.push({ op: 'fillText', args }); },
  };
  return { ctx: ctx as unknown as Ctx2D, calls };
}

const grid: Grid = {
  cols: 1, rows: 1,
  cells: [{ char: 'a', color: { r: 1, g: 2, b: 3 }, x: 4, y: 6, col: 0, row: 0 }],
};

const image = {} as CanvasImageSource;

describe('pixelRatio', () => {
  test('leaves the transform alone at ratio 1', () => {
    const { ctx, calls } = recorder(40, 20);
    drawToCanvas(ctx, grid, { fontSize: 8 });
    expect(calls.some(c => c.op === 'setTransform')).toBe(false);
  });

  test('scales the context by the ratio', () => {
    const { ctx, calls } = recorder(80, 40);
    drawToCanvas(ctx, grid, { fontSize: 8, pixelRatio: 2 });
    expect(calls[0]).toEqual({ op: 'setTransform', args: [2, 0, 0, 2, 0, 0] });
  });

  test('covers the logical area, not the device area', () => {
    const { ctx, calls } = recorder(80, 40);
    drawToCanvas(ctx, grid, { fontSize: 8, pixelRatio: 2, background: '#000' });
    expect(calls.find(c => c.op === 'fillRect')?.args).toEqual([0, 0, 40, 20]);
  });

  test('clears the logical area when there is no background', () => {
    const { ctx, calls } = recorder(80, 40);
    drawToCanvas(ctx, grid, { fontSize: 8, pixelRatio: 2 });
    expect(calls.find(c => c.op === 'clearRect')?.args).toEqual([0, 0, 40, 20]);
  });

  test('stretches the backdrop over the logical area', () => {
    const { ctx, calls } = recorder(80, 40);
    drawToCanvas(ctx, grid, { fontSize: 8, pixelRatio: 2, backdrop: { image } });
    expect(calls.find(c => c.op === 'drawImage')?.args).toEqual([image, 0, 0, 40, 20]);
  });

  test('keeps glyph coordinates in source space', () => {
    const { ctx, calls } = recorder(80, 40);
    drawToCanvas(ctx, grid, { fontSize: 8, pixelRatio: 2 });
    expect(calls.find(c => c.op === 'fillText')?.args).toEqual(['a', 4, 6]);
  });

  test('puts the transform back when it is done', () => {
    const { ctx, calls } = recorder(80, 40);
    drawToCanvas(ctx, grid, { fontSize: 8, pixelRatio: 2 });
    expect(calls.at(-1)).toEqual({ op: 'setTransform', args: [1, 0, 0, 1, 0, 0] });
  });
});
