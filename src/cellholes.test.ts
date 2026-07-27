import { describe, expect, test } from 'vitest';
import { asciiLayer, layersToSvg, paintLayers } from './layer.js';
import type { Ctx2D } from './canvas.js';
import type { Cell, Grid } from './grid.js';

interface Call { op: string; args: unknown[]; fill?: string }

function recorder() {
  const calls: Call[] = [];
  const ctx = {
    canvas: { width: 60, height: 40 },
    fillStyle: '', font: '', textBaseline: '', filter: 'none', globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    measureText: (t: string) => ({ width: t.length * 6 }),
    setTransform: () => {}, save: () => {}, restore: () => {}, clearRect: () => {},
    fillRect(...args: unknown[]) { calls.push({ op: 'fillRect', args, fill: this.fillStyle as string }); },
    drawImage: () => {},
    fillText(...args: unknown[]) { calls.push({ op: 'fillText', args }); },
  };
  return { ctx: ctx as unknown as Ctx2D, calls };
}

const cell = (char: string, col: number, rgb: [number, number, number] = [9, 9, 9]): Cell =>
  ({ char, color: { r: rgb[0], g: rgb[1], b: rgb[2] }, x: col * 6, y: 0, col, row: 0 });

const row = (chars: string): Grid =>
  ({ cols: chars.length, rows: 1, cells: [...chars].map((c, i) => cell(c, i)) });

const opts = { fontSize: 10, cellWidth: 6, cellHeight: 10 };
const rects = (calls: Call[]) => calls.filter(c => c.op === 'fillRect');
const paint = (grid: Grid, extra: object) => {
  const { ctx, calls } = recorder();
  paintLayers(ctx, [asciiLayer(grid, { ...opts, ...extra })], { clear: false });
  return rects(calls);
};

describe('holes where there is no glyph', () => {
  test('fills blanks by default, like a terminal cell', () => {
    const r = paint(row('a b'), { cellBackground: '#222' });
    expect(r).toHaveLength(1);
    expect(r[0]!.args).toEqual([0, 0, 18, 10]);
  });

  test('leaves blanks unfilled when asked', () => {
    const r = paint(row('a b'), { cellBackground: '#222', fillBlankCells: false });
    expect(r.map(x => x.args)).toEqual([[0, 0, 6, 10], [12, 0, 6, 10]]);
  });

  test('breaks the run at the hole rather than spanning it', () => {
    const r = paint(row('aa bb'), { cellBackground: '#222', fillBlankCells: false });
    expect(r.map(x => x.args)).toEqual([[0, 0, 12, 10], [18, 0, 12, 10]]);
  });

  test('treats blank braille as a hole too', () => {
    const grid: Grid = { cols: 2, rows: 1, cells: [cell('⣿', 0), cell('⠀', 1)] };
    const r = paint(grid, { cellBackground: '#222', fillBlankCells: false });
    expect(r.map(x => x.args)).toEqual([[0, 0, 6, 10]]);
  });

  test('skips any cell whose colour function returns null', () => {
    const r = paint(row('abc'), {
      cellBackground: (c: Cell) => (c.col === 1 ? null : '#222'),
    });
    expect(r.map(x => x.args)).toEqual([[0, 0, 6, 10], [12, 0, 6, 10]]);
  });

  test('fills everything when nothing is skipped', () => {
    const r = paint(row('abc'), { cellBackground: '#222', fillBlankCells: false });
    expect(r).toHaveLength(1);
    expect(r[0]!.args).toEqual([0, 0, 18, 10]);
  });

  test('omits the rect in svg as well', () => {
    const svg = layersToSvg(
      [asciiLayer(row('a b'), { ...opts, cellBackground: '#222', fillBlankCells: false })],
      { width: 60, height: 40 });
    expect(svg.match(/<rect/g)).toHaveLength(2);
  });
});
