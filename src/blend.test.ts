import { describe, expect, test } from 'vitest';
import { drawToCanvas } from './canvas.js';
import type { Ctx2D } from './canvas.js';
import type { Grid } from './grid.js';

function recorder() {
  const ops: string[] = [];
  const atFillText: string[] = [];
  const stack: string[] = [];
  const ctx = {
    canvas: { width: 20, height: 10 },
    fillStyle: '', font: '', textBaseline: '', filter: 'none', globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    setTransform() {},
    save() { stack.push(this.globalCompositeOperation); ops.push('save'); },
    restore() {
      const v = stack.pop();
      if (v !== undefined) this.globalCompositeOperation = v;
      ops.push('restore');
    },
    clearRect: () => { ops.push('clearRect'); },
    fillRect: () => { ops.push('fillRect'); },
    drawImage: () => { ops.push('drawImage'); },
    fillText(this: { globalCompositeOperation: string }) {
      atFillText.push(this.globalCompositeOperation);
      ops.push('fillText');
    },
  };
  return { ctx: ctx as unknown as Ctx2D, raw: ctx, ops, atFillText };
}

const grid: Grid = {
  cols: 1, rows: 1,
  cells: [{ char: 'a', color: { r: 9, g: 9, b: 9 }, x: 0, y: 0, col: 0, row: 0 }],
};

describe('glyph blend mode', () => {
  test('draws normally by default', () => {
    const { ctx, atFillText } = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8 });
    expect(atFillText).toEqual(['source-over']);
  });

  test('composites the glyph layer with the requested mode', () => {
    const { ctx, atFillText } = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8, blend: 'color-dodge' });
    expect(atFillText).toEqual(['color-dodge']);
  });

  test('puts the composite mode back when it is done', () => {
    const { ctx, raw } = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8, blend: 'screen' });
    expect(raw.globalCompositeOperation).toBe('source-over');
  });

  test('leaves the backdrop out of the glyph blend', () => {
    const { ctx, ops } = recorder();
    drawToCanvas(ctx, grid, {
      fontSize: 8, blend: 'screen',
      backdrop: { image: {} as CanvasImageSource },
    });
    expect(ops.indexOf('drawImage')).toBeLessThan(ops.indexOf('fillText'));
  });
});
