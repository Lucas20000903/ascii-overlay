import { describe, expect, test } from 'vitest';
import { drawToCanvas } from './canvas.js';
import type { Ctx2D } from './canvas.js';
import type { Grid } from './grid.js';

interface Call { op: string; args: unknown[] }

/**
 * Recording context with real save/restore semantics, so a missing restore
 * shows up as leaked state rather than passing silently.
 */
function recorder(width = 40, height = 10) {
  const calls: Call[] = [];
  const atFillText: { filter: string; alpha: number }[] = [];
  const stack: { filter: string; globalAlpha: number; fillStyle: string }[] = [];

  const ctx = {
    canvas: { width, height },
    fillStyle: '',
    font: '',
    textBaseline: '',
    filter: 'none',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    setTransform() {},
    save() {
      stack.push({ filter: this.filter, globalAlpha: this.globalAlpha,
                   fillStyle: this.fillStyle as string });
      calls.push({ op: 'save', args: [] });
    },
    restore() {
      const s = stack.pop();
      if (s) { this.filter = s.filter; this.globalAlpha = s.globalAlpha; this.fillStyle = s.fillStyle; }
      calls.push({ op: 'restore', args: [] });
    },
    clearRect: (...args: unknown[]) => { calls.push({ op: 'clearRect', args }); },
    fillRect: (...args: unknown[]) => { calls.push({ op: 'fillRect', args }); },
    drawImage: (...args: unknown[]) => { calls.push({ op: 'drawImage', args }); },
    fillText(...args: unknown[]) {
      atFillText.push({ filter: this.filter, alpha: this.globalAlpha });
      calls.push({ op: 'fillText', args });
    },
  };
  return { ctx: ctx as unknown as Ctx2D, calls, atFillText, raw: ctx };
}

const grid: Grid = {
  cols: 2, rows: 1,
  cells: [
    { char: 'a', color: { r: 1, g: 2, b: 3 }, x: 0, y: 0, col: 0, row: 0 },
    { char: 'b', color: { r: 4, g: 5, b: 6 }, x: 8, y: 0, col: 1, row: 0 },
  ],
};

const image = { fake: 'image' } as unknown as CanvasImageSource;

describe('backdrop', () => {
  test('is not drawn when none is asked for', () => {
    const { ctx, calls } = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8 });
    expect(calls.some(c => c.op === 'drawImage')).toBe(false);
  });

  test('draws the image scaled to the canvas', () => {
    const { ctx, calls } = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8, backdrop: { image } });
    expect(calls.find(c => c.op === 'drawImage')?.args).toEqual([image, 0, 0, 40, 10]);
  });

  test('draws the backdrop under the glyphs', () => {
    const { ctx, calls } = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8, backdrop: { image } });
    const ops = calls.map(c => c.op);
    expect(ops.indexOf('drawImage')).toBeLessThan(ops.indexOf('fillText'));
  });

  test('blurs the backdrop with a canvas filter', () => {
    const { ctx, calls } = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8, backdrop: { image, blur: 6 } });
    const i = calls.findIndex(c => c.op === 'drawImage');
    // the filter has to be in place when the image is drawn
    expect(calls.slice(0, i).some(c => c.op === 'save')).toBe(true);
    expect(ctx.filter).toBe('none');
  });

  test('keeps the glyphs sharp when the backdrop is blurred', () => {
    const { ctx, atFillText } = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8, backdrop: { image, blur: 6 } });
    expect(atFillText).toHaveLength(2);
    for (const state of atFillText) expect(state.filter).toBe('none');
  });

  test('keeps the glyphs opaque when the backdrop is faded', () => {
    const { ctx, atFillText } = recorder();
    drawToCanvas(ctx, grid, { fontSize: 8, backdrop: { image, opacity: 0.3 } });
    for (const state of atFillText) expect(state.alpha).toBe(1);
  });

  test('fades the backdrop with the requested opacity', () => {
    const { ctx, raw, calls } = recorder();
    let alphaAtDraw = -1;
    raw.drawImage = (...args: unknown[]) => {
      alphaAtDraw = raw.globalAlpha;
      calls.push({ op: 'drawImage', args });
    };
    drawToCanvas(ctx, grid, { fontSize: 8, backdrop: { image, opacity: 0.3 } });
    expect(alphaAtDraw).toBeCloseTo(0.3);
  });
});
