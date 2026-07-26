// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAsciiGrid } from './useAsciiGrid.js';
import { rectMask } from '../mask.js';
import type { Source } from '../grid.js';

const solid = (w: number, h: number, v: number): Source => {
  const data = new Uint8ClampedArray(w * h * 4);
  data.fill(v);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { width: w, height: h, data };
};

describe('useAsciiGrid', () => {
  test('reduces the source to a glyph grid', () => {
    const { result } = renderHook(() =>
      useAsciiGrid(solid(4, 4, 255), { mode: 'characters', cellWidth: 2, cellHeight: 2 }));
    expect(result.current.cols).toBe(2);
    expect(result.current.rows).toBe(2);
  });

  test('reuses the grid when a fresh options object holds the same values', () => {
    const source = solid(4, 4, 255);
    const { result, rerender } = renderHook(
      ({ size }: { size: number }) =>
        useAsciiGrid(source, { mode: 'characters', cellWidth: size, cellHeight: size }),
      { initialProps: { size: 2 } },
    );
    const first = result.current;
    rerender({ size: 2 });
    expect(result.current).toBe(first);
  });

  test('passes a mask through to the renderer', () => {
    const { result } = renderHook(() =>
      useAsciiGrid(solid(4, 1, 255), {
        mode: 'characters', cellWidth: 1, cellHeight: 1, ramp: ' @',
        mask: rectMask(4, 1, { x: 0, y: 0, width: 2, height: 1 }),
      }));
    expect(result.current.cells.map(c => c.char).join('')).toBe('@@  ');
  });

  test('passes tone through to the renderer', () => {
    const { result } = renderHook(() =>
      useAsciiGrid(solid(1, 1, 0), {
        mode: 'characters', cellWidth: 1, cellHeight: 1, ramp: ' @',
        tone: { brightness: 1 },
      }));
    expect(result.current.cells[0]!.char).toBe('@');
  });

  test('recomputes when a nested option changes', () => {
    // 128 is the contrast pivot, so pick a value the curve actually moves.
    const source = solid(1, 1, 190);
    const { result, rerender } = renderHook(
      ({ contrast }: { contrast: number }) =>
        useAsciiGrid(source, {
          mode: 'characters', cellWidth: 1, cellHeight: 1, ramp: ' .:-=+*#%@',
          tone: { contrast },
        }),
      { initialProps: { contrast: 1 } },
    );
    const first = result.current;
    rerender({ contrast: 3 });
    expect(result.current).not.toBe(first);
    expect(result.current.cells[0]!.char).not.toBe(first.cells[0]!.char);
  });

  test('reuses the grid when nested options hold the same values', () => {
    const source = solid(4, 4, 200);
    const { result, rerender } = renderHook(
      ({ c }: { c: number }) =>
        useAsciiGrid(source, {
          mode: 'characters', cellWidth: 2, cellHeight: 2,
          tone: { contrast: c }, grade: { preset: 'sepia' },
        }),
      { initialProps: { c: 1.5 } },
    );
    const first = result.current;
    rerender({ c: 1.5 });
    expect(result.current).toBe(first);
  });

  test('recomputes when an option changes', () => {
    const source = solid(4, 4, 255);
    const { result, rerender } = renderHook(
      ({ size }: { size: number }) =>
        useAsciiGrid(source, { mode: 'characters', cellWidth: size, cellHeight: size }),
      { initialProps: { size: 2 } },
    );
    const first = result.current;
    rerender({ size: 4 });
    expect(result.current).not.toBe(first);
    expect(result.current.cols).toBe(1);
  });
});
