// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AsciiCanvas } from './AsciiCanvas.js';
import type { Source } from '../grid.js';

const blackThenWhite: Source = {
  width: 2, height: 1,
  data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]),
};

let drawn: [string, number, number][] = [];
let images: unknown[] = [];
let blendAtDraw: string[] = [];

beforeEach(() => {
  drawn = [];
  images = [];
  blendAtDraw = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement) {
      return {
        canvas: this,
        fillStyle: '', font: '', textBaseline: '', filter: 'none', globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        save: () => {},
        setTransform: () => {},
        restore: () => {},
        clearRect: () => {},
        fillRect: () => {},
        drawImage: (img: unknown) => { images.push(img); },
        fillText(this: { globalCompositeOperation: string }, t: string, x: number, y: number) {
          blendAtDraw.push(this.globalCompositeOperation);
          drawn.push([t, x, y]);
        },
      } as unknown as CanvasRenderingContext2D;
    });
});

afterEach(() => { vi.restoreAllMocks(); });

describe('AsciiCanvas', () => {
  test('sizes the canvas to the source', () => {
    const { container } = render(
      <AsciiCanvas source={blackThenWhite} mode="characters" cellWidth={1} cellHeight={1} />);
    const canvas = container.querySelector('canvas')!;
    expect(canvas.width).toBe(2);
    expect(canvas.height).toBe(1);
  });

  test('draws the visible glyphs at their cell positions', () => {
    render(<AsciiCanvas source={blackThenWhite} mode="characters"
      cellWidth={1} cellHeight={1} ramp=" @" />);
    expect(drawn).toEqual([['@', 1, 0]]);
  });

  test('composites a backdrop image under the glyphs', () => {
    const image = { fake: 'image' } as unknown as CanvasImageSource;
    render(<AsciiCanvas source={blackThenWhite} mode="characters"
      cellWidth={1} cellHeight={1} ramp=" @" backdrop={{ image, blur: 4, opacity: 0.6 }} />);
    expect(images).toEqual([image]);
    expect(drawn).toEqual([['@', 1, 0]]);
  });

  test('repaints when the backdrop changes', () => {
    const first = { id: 1 } as unknown as CanvasImageSource;
    const second = { id: 2 } as unknown as CanvasImageSource;
    const { rerender } = render(<AsciiCanvas source={blackThenWhite} mode="characters"
      cellWidth={1} cellHeight={1} backdrop={{ image: first }} />);
    images = [];
    rerender(<AsciiCanvas source={blackThenWhite} mode="characters"
      cellWidth={1} cellHeight={1} backdrop={{ image: second }} />);
    expect(images).toEqual([second]);
  });

  test('composites the glyph layer with the requested blend', () => {
    render(<AsciiCanvas source={blackThenWhite} mode="characters"
      cellWidth={1} cellHeight={1} ramp=" @" blend="screen" />);
    expect(blendAtDraw).toEqual(['screen']);
  });

  test('sizes the backing store by the device pixel ratio', () => {
    const original = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    const { container } = render(
      <AsciiCanvas source={blackThenWhite} mode="characters" cellWidth={1} cellHeight={1} />);
    const canvas = container.querySelector('canvas')!;
    expect(canvas.width).toBe(4);   // 2px source at 2x
    expect(canvas.height).toBe(2);
    Object.defineProperty(window, 'devicePixelRatio', { value: original, configurable: true });
  });

  test('keeps the css size at the source dimensions', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    const { container } = render(
      <AsciiCanvas source={blackThenWhite} mode="characters" cellWidth={1} cellHeight={1} />);
    const canvas = container.querySelector('canvas')!;
    expect(canvas.style.width).toBe('2px');
    expect(canvas.style.height).toBe('1px');
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  });

  test('lets the caller pin the pixel ratio', () => {
    const { container } = render(
      <AsciiCanvas source={blackThenWhite} mode="characters"
        cellWidth={1} cellHeight={1} pixelRatio={3} />);
    expect(container.querySelector('canvas')!.width).toBe(6);
  });

  test('repaints when a render option changes', () => {
    const { rerender } = render(
      <AsciiCanvas source={blackThenWhite} mode="characters"
        cellWidth={1} cellHeight={1} ramp=" @" />);
    drawn = [];
    rerender(<AsciiCanvas source={blackThenWhite} mode="characters"
      cellWidth={1} cellHeight={1} ramp=" #" />);
    expect(drawn).toEqual([['#', 1, 0]]);
  });
});
