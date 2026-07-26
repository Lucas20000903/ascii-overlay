import { describe, expect, test } from 'vitest';
import { gridToSvg } from './svg.js';
import type { Cell, Grid } from './grid.js';

const cell = (char: string, col: number, row: number, rgb: [number, number, number]): Cell => ({
  char, color: { r: rgb[0], g: rgb[1], b: rgb[2] },
  x: col * 6, y: row * 8, col, row,
});
const WHITE: [number, number, number] = [255, 255, 255];

const grid: Grid = {
  cols: 2, rows: 1,
  cells: [cell('a', 0, 0, WHITE), cell('b', 1, 0, WHITE)],
};

const opts = { fontSize: 8, cellWidth: 6, cellHeight: 8 };

describe('gridToSvg', () => {
  test('wraps the art in an svg root sized to the grid', () => {
    const svg = gridToSvg(grid, opts);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 12 8"');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  test('declares the svg namespace so the string can stand alone', () => {
    expect(gridToSvg(grid, opts)).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  test('paints a background rect when one is asked for', () => {
    expect(gridToSvg(grid, { ...opts, background: '#000' }))
      .toContain('<rect width="100%" height="100%" fill="#000"');
  });

  test('leaves the background out otherwise', () => {
    expect(gridToSvg(grid, opts)).not.toContain('<rect');
  });

  test('emits one text element per run', () => {
    const svg = gridToSvg(grid, opts);
    expect(svg.match(/<text/g)).toHaveLength(1);
    expect(svg).toContain('>ab</text>');
  });

  test('pins each run to the width of the cells it covers', () => {
    expect(gridToSvg(grid, opts)).toContain('textLength="12"');
  });

  test('escapes characters that would break the markup', () => {
    const tricky: Grid = {
      cols: 3, rows: 1,
      cells: [cell('&', 0, 0, WHITE), cell('<', 1, 0, WHITE), cell('>', 2, 0, WHITE)],
    };
    const svg = gridToSvg(tricky, opts);
    expect(svg).toContain('&amp;&lt;&gt;');
    expect(svg).not.toContain('>&<');
  });

  test('asks for a monospace face by default', () => {
    expect(gridToSvg(grid, opts)).toContain('font-family="monospace"');
  });

  test('honours a custom font family', () => {
    expect(gridToSvg(grid, { ...opts, fontFamily: 'Menlo' })).toContain('font-family="Menlo"');
  });

  test('anchors glyphs from the top edge, matching the canvas renderer', () => {
    expect(gridToSvg(grid, opts)).toContain('dominant-baseline="text-before-edge"');
  });
});
