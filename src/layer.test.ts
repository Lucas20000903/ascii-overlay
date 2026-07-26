import { describe, expect, test } from 'vitest';
import { asciiLayer, fillLayer, imageLayer, paintLayers, layersToSvg } from './layer.js';
import type { Ctx2D } from './canvas.js';
import type { Grid } from './grid.js';

interface Call { op: string; args: unknown[] }

function recorder(width = 40, height = 20) {
  const calls: Call[] = [];
  const state: string[] = [];
  const ctx = {
    canvas: { width, height },
    fillStyle: '', font: '', textBaseline: '', filter: 'none', globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    measureText: (t: string) => ({ width: t.length * 6 }),
    setTransform: () => {},
    save() { state.push(`${this.filter}|${this.globalAlpha}|${this.globalCompositeOperation}`);
             calls.push({ op: 'save', args: [] }); },
    restore() {
      const s = state.pop();
      if (s) { const [f, a, c] = s.split('|');
               this.filter = f!; this.globalAlpha = Number(a); this.globalCompositeOperation = c!; }
      calls.push({ op: 'restore', args: [] });
    },
    clearRect: (...args: unknown[]) => { calls.push({ op: 'clearRect', args }); },
    fillRect: (...args: unknown[]) => { calls.push({ op: 'fillRect', args }); },
    drawImage: (...args: unknown[]) => { calls.push({ op: 'drawImage', args }); },
    fillText(...args: unknown[]) {
      calls.push({ op: 'fillText', args, ...{} });
      (calls.at(-1) as Call & { alpha?: number }).alpha = this.globalAlpha;
    },
  };
  return { ctx: ctx as unknown as Ctx2D, raw: ctx, calls };
}

const grid: Grid = {
  cols: 2, rows: 1,
  cells: [
    { char: 'a', color: { r: 1, g: 2, b: 3 }, x: 0, y: 0, col: 0, row: 0 },
    { char: 'b', color: { r: 1, g: 2, b: 3 }, x: 6, y: 0, col: 1, row: 0 },
  ],
};
const image = { src: 'http://example.test/bg.png' } as unknown as CanvasImageSource;
const ops = (calls: Call[]) => calls.map(c => c.op);

describe('paintLayers', () => {
  test('paints layers bottom to top in order', () => {
    const { ctx, calls } = recorder();
    paintLayers(ctx, [fillLayer('#000'), imageLayer(image), asciiLayer(grid, { fontSize: 10 })]);
    expect(ops(calls).filter(o => o !== 'save' && o !== 'restore'))
      .toEqual(['clearRect', 'fillRect', 'drawImage', 'fillText']);
  });

  test('wraps a layer that needs state, and leaves a plain one alone', () => {
    const plain = recorder();
    paintLayers(plain.ctx, [fillLayer('#000')]);
    expect(ops(plain.calls)).not.toContain('save');

    const fancy = recorder();
    paintLayers(fancy.ctx, [fillLayer('#000', { opacity: 0.5 })]);
    expect(ops(fancy.calls)).toContain('save');
  });

  test('restores state so one layer cannot leak into the next', () => {
    const { ctx, raw } = recorder();
    paintLayers(ctx, [
      imageLayer(image, { filter: 'blur(4px)', opacity: 0.3 }),
      asciiLayer(grid, { fontSize: 10 }),
    ]);
    expect(raw.filter).toBe('none');
    expect(raw.globalAlpha).toBe(1);
  });

  test('applies opacity while the layer paints', () => {
    const { ctx, calls } = recorder();
    paintLayers(ctx, [asciiLayer(grid, { fontSize: 10, opacity: 0.25 })]);
    const text = calls.find(c => c.op === 'fillText') as Call & { alpha: number };
    expect(text.alpha).toBeCloseTo(0.25);
  });

  test('clears once for the whole stack, not per layer', () => {
    const { ctx, calls } = recorder();
    paintLayers(ctx, [fillLayer('#000'), fillLayer('#fff')]);
    expect(ops(calls).filter(o => o === 'clearRect')).toHaveLength(1);
  });

  test('keeps what is on the surface when clear is off', () => {
    const { ctx, calls } = recorder();
    paintLayers(ctx, [asciiLayer(grid, { fontSize: 10 })], { clear: false });
    expect(ops(calls)).not.toContain('clearRect');
  });
});

describe('layersToSvg', () => {
  const env = { width: 40, height: 20 };

  test('wraps the stack in one document', () => {
    const svg = layersToSvg([fillLayer('#000')], env);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 40 20"');
  });

  test('emits a rect for a fill layer', () => {
    expect(layersToSvg([fillLayer('#0a0')], env)).toContain('fill="#0a0"');
  });

  test('emits an image href for an image layer', () => {
    expect(layersToSvg([imageLayer(image)], env))
      .toContain('href="http://example.test/bg.png"');
  });

  test('emits the glyph runs for an ascii layer', () => {
    const svg = layersToSvg([asciiLayer(grid, { fontSize: 10, cellWidth: 6, cellHeight: 10 })], env);
    expect(svg).toContain('>ab</text>');
  });

  test('hangs a filter on the layer group', () => {
    const svg = layersToSvg([asciiLayer(grid, {
      fontSize: 10, cellWidth: 6, cellHeight: 10, filter: 'url(#glow)',
    })], env);
    expect(svg).toContain('filter="url(#glow)"');
  });

  test('carries blend and opacity onto the group', () => {
    const svg = layersToSvg([fillLayer('#000', { blend: 'screen', opacity: 0.4 })], env);
    expect(svg).toContain('mix-blend-mode:screen');
    expect(svg).toContain('opacity="0.4"');
  });

  test('makes room for defs so filters can be declared', () => {
    const svg = layersToSvg([fillLayer('#000')], { ...env, defs: '<filter id="g"/>' });
    expect(svg).toContain('<defs><filter id="g"/></defs>');
  });
});

describe('custom layers', () => {
  test('anything satisfying the contract can join the stack', () => {
    const { ctx, calls } = recorder();
    const scanlines = {
      paintCanvas(c: Ctx2D, env: { width: number; height: number }) {
        c.fillStyle = '#fff';
        for (let y = 0; y < env.height; y += 4) c.fillRect(0, y, env.width, 1);
      },
      toSvgMarkup: () => '<g class="scanlines"/>',
    };
    paintLayers(ctx, [asciiLayer(grid, { fontSize: 10 }), scanlines]);
    expect(ops(calls).filter(o => o === 'fillRect').length).toBeGreaterThan(1);
    expect(layersToSvg([scanlines], { width: 40, height: 20 }))
      .toContain('<g class="scanlines"/>');
  });
});
