// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AsciiCanvas } from './react/AsciiCanvas.js';
import { AsciiSvg } from './react/AsciiSvg.js';
import { gridToSvg } from './svg.js';
import { renderAscii } from './render.js';
import type { Source } from './grid.js';

/** 8x1: black half then white half, so 4px cells give two columns. */
const source: Source = (() => {
  const data = new Uint8ClampedArray(8 * 4);
  for (let x = 0; x < 8; x++) {
    const v = x < 4 ? 0 : 255;
    data[x * 4] = v; data[x * 4 + 1] = v; data[x * 4 + 2] = v; data[x * 4 + 3] = 255;
  }
  return { width: 8, height: 1, data };
})();

const base = { mode: 'characters', cellWidth: 4, cellHeight: 8, ramp: ' @' } as const;

let rects: unknown[][] = [];
let texts: unknown[][] = [];

beforeEach(() => {
  rects = []; texts = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement) {
      return {
        canvas: this,
        fillStyle: '', font: '', textBaseline: '', filter: 'none', globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        measureText: () => ({ width: 0 }),
        setTransform: () => {}, save: () => {}, restore: () => {}, clearRect: () => {},
        fillRect: (...a: unknown[]) => { rects.push(a); },
        drawImage: () => {},
        fillText: (...a: unknown[]) => { texts.push(a); },
      } as unknown as CanvasRenderingContext2D;
    });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('AsciiCanvas reaches the whole ascii layer', () => {
  test('fills cell backgrounds', () => {
    render(<AsciiCanvas source={source} {...base} cellBackground="#222" />);
    expect(rects.some(a => a[2] === 8)).toBe(true); // two 4px cells merged
  });

  test('leaves holes when told to', () => {
    render(<AsciiCanvas source={source} {...base}
      cellBackground="#222" fillBlankCells={false} />);
    // only the bright cell has a glyph, so only it is filled
    expect(rects.filter(a => a[2] === 4)).toHaveLength(1);
  });

  test('displaces glyphs', () => {
    render(<AsciiCanvas source={source} {...base} offset={() => ({ x: 3, y: 2 })} />);
    expect(texts).toEqual([['@', 7, 2]]);
  });
});

describe('AsciiSvg reaches the whole ascii layer', () => {
  test('fills cell backgrounds', () => {
    const { container } = render(<AsciiSvg source={source} {...base} cellBackground="#222" />);
    expect(container.querySelector('rect[fill="#222"]')).not.toBeNull();
  });

  test('displaces glyphs', () => {
    const { container } = render(
      <AsciiSvg source={source} {...base} offset={() => ({ x: 3, y: 2 })} />);
    const text = container.querySelector('text')!;
    expect(text.getAttribute('x')).toBe('7');
    expect(text.getAttribute('y')).toBe('2');
  });
});

describe('gridToSvg reaches the whole ascii layer', () => {
  const grid = renderAscii(source, base);

  test('fills cell backgrounds', () => {
    const svg = gridToSvg(grid, { fontSize: 8, cellWidth: 4, cellHeight: 8, cellBackground: '#222' });
    expect(svg).toContain('fill="#222"');
  });

  test('displaces glyphs', () => {
    const svg = gridToSvg(grid, {
      fontSize: 8, cellWidth: 4, cellHeight: 8, offset: () => ({ x: 3, y: 2 }),
    });
    expect(svg).toContain('x="7" y="2"');
  });
});
