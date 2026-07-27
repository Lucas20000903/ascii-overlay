import { describe, expect, test } from 'vitest';
import { asciiLayer, layersToSvg, paintLayers } from './layer.js';
import type { Ctx2D } from './canvas.js';
import type { Cell, Grid } from './grid.js';

interface Call { op: string; args: number[] }

function recorder() {
  const calls: Call[] = [];
  const ctx = {
    canvas: { width: 60, height: 40 },
    fillStyle: '', font: '', textBaseline: '', filter: 'none', globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    measureText: (t: string) => ({ width: t.length * 6.62 }),
    setTransform: () => {}, save: () => {}, restore: () => {}, clearRect: () => {},
    fillRect: (...args: number[]) => { calls.push({ op: 'fillRect', args }); },
    drawImage: () => {},
    fillText: (...args: unknown[]) => { calls.push({ op: 'fillText', args: args as number[] }); },
  };
  return { ctx: ctx as unknown as Ctx2D, calls };
}

/** Cells stepping a fractional advance apart, as a real monospace face does. */
const STEP = 6.62;
const ROW = 7.99;
const grid = (colours: [number, number, number][], rows = 1): Grid => {
  const cols = colours.length;
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const [r, g, b] = colours[col]!;
      cells.push({ char: 'x', color: { r, g, b }, x: col * STEP, y: row * ROW, col, row });
    }
  }
  return { cols, rows, cells };
};

const opts = { fontSize: 10, cellWidth: STEP, cellHeight: ROW };
const rects = (calls: Call[]) => calls.filter(c => c.op === 'fillRect').map(c => c.args);
const paint = (g: Grid, extra: object) => {
  const { ctx, calls } = recorder();
  paintLayers(ctx, [asciiLayer(g, { ...opts, ...extra })], { clear: false });
  return rects(calls);
};

const RED: [number, number, number] = [200, 0, 0];
const GREEN: [number, number, number] = [0, 200, 0];
const BLUE: [number, number, number] = [0, 0, 200];

describe('cell background seams', () => {
  test('snaps a run to whole pixels', () => {
    // a fractional edge would leave the boundary pixel half covered, and on a
    // transparent canvas half covered never composites back to opaque
    expect(paint(grid([RED, RED, RED]), { cellBackground: '#222' }))
      .toEqual([[0, 0, 20, 8]]);
  });

  test('makes neighbouring runs abut exactly', () => {
    const r = paint(grid([RED, GREEN, BLUE]), {
      cellBackground: (c: Cell) => `rgb(${c.color.r},${c.color.g},${c.color.b})`,
    });
    expect(r).toEqual([[0, 0, 7, 8], [7, 0, 6, 8], [13, 0, 7, 8]]);
    // no gap and no overlap anywhere along the row
    for (let i = 1; i < r.length; i++) {
      expect(r[i]![0]).toBe(r[i - 1]![0]! + r[i - 1]![2]!);
    }
  });

  test('makes rows abut exactly too', () => {
    const r = paint(grid([RED], 3), { cellBackground: '#222' });
    expect(r.map(a => [a[1], a[3]])).toEqual([[0, 8], [8, 8], [16, 8]]);
  });

  test('every bound is a whole number', () => {
    const r = paint(grid([RED, GREEN, BLUE], 2), {
      cellBackground: (c: Cell) => `rgb(${c.color.r},${c.color.g},${c.color.b})`,
    });
    for (const a of r) for (const v of a) expect(Number.isInteger(v)).toBe(true);
  });

  test('leaves the glyphs on their fractional positions', () => {
    const { ctx, calls } = recorder();
    paintLayers(ctx, [asciiLayer(grid([RED, RED]), { ...opts, cellBackground: '#222' })],
      { clear: false });
    const text = calls.filter(c => c.op === 'fillText');
    // batched into one run starting at 0; snapping ink would misalign columns
    expect(text[0]!.args[1]).toBe(0);
    expect(paint(grid([RED, GREEN]), {
      cellBackground: (c: Cell) => `rgb(${c.color.r},0,0)`,
    })[1]![0]).toBe(7);
  });

  test('snaps in svg as well', () => {
    const svg = layersToSvg([asciiLayer(grid([RED, GREEN]), { ...opts, cellBackground:
      (c: Cell) => `rgb(${c.color.r},${c.color.g},${c.color.b})` })], { width: 60, height: 40 });
    expect(svg).toContain('x="0" y="0" width="7" height="8"');
    expect(svg).toContain('x="7" y="0" width="6" height="8"');
  });
});
