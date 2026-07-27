import { describe, expect, test } from 'vitest';
import { asciiLayer, layersToSvg, paintLayers } from './layer.js';
import type { Ctx2D } from './canvas.js';
import type { Cell, Grid } from './grid.js';

interface Call { op: string; args: unknown[] }

function recorder() {
  const calls: Call[] = [];
  const ctx = {
    canvas: { width: 60, height: 40 },
    fillStyle: '', font: '', textBaseline: '', filter: 'none', globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    measureText: (t: string) => ({ width: t.length * 6 }),
    setTransform: () => {}, save: () => {}, restore: () => {}, clearRect: () => {},
    fillRect: (...args: unknown[]) => { calls.push({ op: 'fillRect', args }); },
    drawImage: () => {},
    fillText: (...args: unknown[]) => { calls.push({ op: 'fillText', args }); },
  };
  return { ctx: ctx as unknown as Ctx2D, calls };
}

const row = (chars: string): Grid => ({
  cols: chars.length, rows: 1,
  cells: [...chars].map((char, i) => ({
    char, color: { r: 9, g: 9, b: 9 }, x: i * 6, y: 0, col: i, row: 0,
  })),
});

const opts = { fontSize: 10, cellWidth: 6, cellHeight: 10 };
const texts = (calls: Call[]) => calls.filter(c => c.op === 'fillText').map(c => c.args);
const paint = (grid: Grid, extra: object) => {
  const { ctx, calls } = recorder();
  paintLayers(ctx, [asciiLayer(grid, { ...opts, ...extra })], { clear: false });
  return calls;
};

describe('glyph offset', () => {
  test('batches a run when nothing displaces it', () => {
    expect(texts(paint(row('abc'), {}))).toEqual([['abc', 0, 0]]);
  });

  test('shifts each glyph from its cell', () => {
    expect(texts(paint(row('ab'), { offset: () => ({ x: 1, y: -2 }) })))
      .toEqual([['a', 1, -2], ['b', 7, -2]]);
  });

  test('gives up batching, since every glyph needs its own place', () => {
    expect(texts(paint(row('abc'), { offset: () => ({ x: 0, y: 0 }) })))
      .toHaveLength(3);
  });

  test('hands the cell to the offset function', () => {
    const seen: number[] = [];
    paint(row('abc'), {
      offset: (c: Cell) => { seen.push(c.col); return { x: c.col, y: 0 }; },
    });
    expect(seen).toEqual([0, 1, 2]);
  });

  test('leaves the cell background on the grid', () => {
    // the glyph wobbles, the cell it sits in does not
    const calls = paint(row('ab'), {
      cellBackground: '#222', offset: () => ({ x: 3, y: 3 }),
    });
    expect(calls.find(c => c.op === 'fillRect')!.args).toEqual([0, 0, 12, 10]);
  });

  test('displaces glyphs in svg as well', () => {
    const svg = layersToSvg([asciiLayer(row('ab'), { ...opts, offset: () => ({ x: 2, y: 1 }) })],
      { width: 60, height: 40 });
    expect(svg.match(/<text/g)).toHaveLength(2);
    expect(svg).toContain('x="2" y="1"');
    expect(svg).toContain('x="8" y="1"');
  });

  test('keeps runs in svg when there is no offset', () => {
    const svg = layersToSvg([asciiLayer(row('ab'), opts)], { width: 60, height: 40 });
    expect(svg.match(/<text/g)).toHaveLength(1);
  });
});
