// @vitest-environment jsdom
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AsciiCanvas } from './react/AsciiCanvas.js';
import type { Source } from './grid.js';

const source: Source = {
  width: 2, height: 1,
  data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]),
};
const base = { mode: 'characters', cellWidth: 1, cellHeight: 1, ramp: ' @' } as const;

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement) {
      return {
        canvas: this, fillStyle: '', font: '', textBaseline: '',
        filter: 'none', globalAlpha: 1, globalCompositeOperation: 'source-over',
        measureText: () => ({ width: 0 }),
        setTransform: () => {}, save: () => {}, restore: () => {},
        clearRect: () => {}, fillRect: () => {}, drawImage: () => {}, fillText: () => {},
      } as unknown as CanvasRenderingContext2D;
    });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('AsciiCanvas ref', () => {
  test('hands back the canvas element', () => {
    const ref = createRef<HTMLCanvasElement>();
    render(<AsciiCanvas ref={ref} source={source} {...base} />);
    expect(ref.current).toBeInstanceOf(HTMLCanvasElement);
  });

  test('hands back the element that was actually drawn on', () => {
    // exporting a png needs the real backing store, not a lookalike
    const ref = createRef<HTMLCanvasElement>();
    const { container } = render(<AsciiCanvas ref={ref} source={source} {...base} />);
    expect(ref.current).toBe(container.querySelector('canvas'));
  });

  test('still paints when a ref is attached', () => {
    const ref = createRef<HTMLCanvasElement>();
    render(<AsciiCanvas ref={ref} source={source} {...base} pixelRatio={2} />);
    expect(ref.current!.width).toBe(4);
  });
});
