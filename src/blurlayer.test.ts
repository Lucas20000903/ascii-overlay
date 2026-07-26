import { describe, expect, test } from 'vitest';
import { imageLayer, layersToSvg, paintLayers } from './layer.js';
import type { Ctx2D } from './canvas.js';

interface Call { op: string; args: unknown[] }

function recorder(width = 100, height = 50) {
  const calls: Call[] = [];
  const seen: string[] = [];
  const ctx = {
    canvas: { width, height },
    fillStyle: '', font: '', textBaseline: '', filter: 'none', globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    measureText: () => ({ width: 0 }),
    setTransform: () => {}, save: () => {}, restore: () => { ctx.filter = 'none'; },
    clearRect: () => {}, fillRect: () => {},
    drawImage(...args: unknown[]) { seen.push(this.filter); calls.push({ op: 'drawImage', args }); },
    fillText: () => {},
  };
  return { ctx: ctx as unknown as Ctx2D, calls, filterAtDraw: seen };
}

const image = { src: 'x.png' } as unknown as CanvasImageSource;
const rect = (calls: Call[]) => calls.find(c => c.op === 'drawImage')!.args.slice(1);

describe('imageLayer blur', () => {
  test('draws edge to edge when there is no blur', () => {
    const { ctx, calls } = recorder();
    paintLayers(ctx, [imageLayer(image)]);
    expect(rect(calls)).toEqual([0, 0, 100, 50]);
  });

  test('sets a gaussian blur filter', () => {
    const { ctx, filterAtDraw } = recorder();
    paintLayers(ctx, [imageLayer(image, { blur: 8 })]);
    expect(filterAtDraw[0]).toContain('blur(8px)');
  });

  test('overdraws so the kernel has real pixels at the edges', () => {
    // without the bleed the blur averages in transparency and the border goes dark
    const { ctx, calls } = recorder();
    paintLayers(ctx, [imageLayer(image, { blur: 10 })]);
    const [x, y, w, h] = rect(calls) as number[];
    expect(x).toBeLessThan(0);
    expect(y).toBeLessThan(0);
    expect(w).toBeGreaterThan(100);
    expect(h).toBeGreaterThan(50);
    // the bleed is centred, so the image stays put
    expect(w! + 2 * x!).toBe(100);
    expect(h! + 2 * y!).toBe(50);
  });

  test('scales the bleed with the radius', () => {
    const small = recorder();
    paintLayers(small.ctx, [imageLayer(image, { blur: 4 })]);
    const large = recorder();
    paintLayers(large.ctx, [imageLayer(image, { blur: 20 })]);
    expect((rect(large.calls)[2] as number)).toBeGreaterThan(rect(small.calls)[2] as number);
  });

  test('keeps an explicit filter alongside the blur', () => {
    const { ctx, filterAtDraw } = recorder();
    paintLayers(ctx, [imageLayer(image, { blur: 6, filter: 'saturate(1.4)' })]);
    expect(filterAtDraw[0]).toContain('saturate(1.4)');
    expect(filterAtDraw[0]).toContain('blur(6px)');
  });

  test('ignores a zero radius', () => {
    const { ctx, calls, filterAtDraw } = recorder();
    paintLayers(ctx, [imageLayer(image, { blur: 0 })]);
    expect(rect(calls)).toEqual([0, 0, 100, 50]);
    expect(filterAtDraw[0]).toBe('none');
  });

  test('carries the blur into svg output', () => {
    const svg = layersToSvg([imageLayer(image, { blur: 8 })], { width: 100, height: 50 });
    expect(svg).toContain('blur(8px)');
  });
});
