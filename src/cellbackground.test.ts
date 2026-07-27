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
    setTransform: () => {}, save: () => {}, restore: () => {},
    clearRect: () => {},
    fillRect(...args: unknown[]) { calls.push({ op: 'fillRect', args, fill: this.fillStyle as string }); },
    drawImage: () => {},
    fillText(...args: unknown[]) { calls.push({ op: 'fillText', args, fill: this.fillStyle as string }); },
  };
  return { ctx: ctx as unknown as Ctx2D, calls };
}

const cell = (char: string, col: number, row: number, rgb: [number, number, number]): Cell => ({
  char, color: { r: rgb[0], g: rgb[1], b: rgb[2] }, x: col * 6, y: row * 10, col, row,
});
const RED: [number, number, number] = [200, 0, 0];
const BLUE: [number, number, number] = [0, 0, 200];

const row = (chars: string, colours: [number, number, number][]): Grid => ({
  cols: chars.length, rows: 1,
  cells: [...chars].map((c, i) => cell(c, i, 0, colours[i]!)),
});

const opts = { fontSize: 10, cellWidth: 6, cellHeight: 10 };
const rects = (calls: Call[]) => calls.filter(c => c.op === 'fillRect');

describe('cellBackground', () => {
  test('paints nothing extra when it is not asked for', () => {
    const { ctx, calls } = recorder();
    paintLayers(ctx, [asciiLayer(row('ab', [RED, RED]), opts)], { clear: false });
    expect(rects(calls)).toHaveLength(0);
  });

  test('fills the cells behind the glyphs', () => {
    const { ctx, calls } = recorder();
    paintLayers(ctx, [asciiLayer(row('ab', [RED, RED]),
      { ...opts, cellBackground: '#222' })], { clear: false });
    expect(rects(calls)).toHaveLength(1);
    expect(rects(calls)[0]!.fill).toBe('#222');
  });

  test('covers the whole cell footprint', () => {
    const { ctx, calls } = recorder();
    paintLayers(ctx, [asciiLayer(row('ab', [RED, RED]),
      { ...opts, cellBackground: '#222' })], { clear: false });
    expect(rects(calls)[0]!.args).toEqual([0, 0, 12, 10]);
  });

  test('fills blank cells too, the way a terminal does', () => {
    const { ctx, calls } = recorder();
    paintLayers(ctx, [asciiLayer(row('a b', [RED, RED, RED]),
      { ...opts, cellBackground: '#222' })], { clear: false });
    expect(rects(calls)[0]!.args).toEqual([0, 0, 18, 10]);
  });

  test('paints the background before the glyphs', () => {
    const { ctx, calls } = recorder();
    paintLayers(ctx, [asciiLayer(row('ab', [RED, RED]),
      { ...opts, cellBackground: '#222' })], { clear: false });
    expect(calls.findIndex(c => c.op === 'fillRect'))
      .toBeLessThan(calls.findIndex(c => c.op === 'fillText'));
  });

  test('takes a colour per cell when given a function', () => {
    const { ctx, calls } = recorder();
    paintLayers(ctx, [asciiLayer(row('ab', [RED, BLUE]), {
      ...opts,
      cellBackground: c => `rgb(${c.color.r},${c.color.g},${c.color.b})`,
    })], { clear: false });
    expect(rects(calls).map(r => r.fill)).toEqual(['rgb(200,0,0)', 'rgb(0,0,200)']);
  });

  test('starts a new run on a new row', () => {
    const grid: Grid = {
      cols: 1, rows: 2,
      cells: [cell('a', 0, 0, RED), cell('b', 0, 1, RED)],
    };
    const { ctx, calls } = recorder();
    paintLayers(ctx, [asciiLayer(grid, { ...opts, cellBackground: '#222' })], { clear: false });
    expect(rects(calls)).toHaveLength(2);
    expect(rects(calls)[1]!.args).toEqual([0, 10, 6, 10]);
  });

  test('emits rects ahead of the text in svg', () => {
    const svg = layersToSvg(
      [asciiLayer(row('ab', [RED, RED]), { ...opts, cellBackground: '#222' })],
      { width: 60, height: 40 });
    expect(svg).toContain('fill="#222"');
    expect(svg.indexOf('<rect')).toBeLessThan(svg.indexOf('<text'));
  });
});
