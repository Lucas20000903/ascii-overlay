import { describe, expect, test } from 'vitest';
import { toDrawList } from './paint.js';
import type { Grid } from './grid.js';

const grid = (chars: string[]): Grid => ({
  cols: chars.length,
  rows: 1,
  cells: chars.map((char, i) => ({
    char, color: { r: 10, g: 20, b: 30 }, x: i * 8, y: 0, col: i, row: 0,
  })),
});

describe('toDrawList', () => {
  test('emits one entry per visible glyph', () => {
    expect(toDrawList(grid(['a', 'b']))).toHaveLength(2);
  });

  test('skips space cells', () => {
    expect(toDrawList(grid(['a', ' ', 'b'])).map(d => d.char)).toEqual(['a', 'b']);
  });

  test('skips blank braille cells', () => {
    expect(toDrawList(grid(['⠁', '⠀'])).map(d => d.char)).toEqual(['⠁']);
  });

  test('carries the cell position through', () => {
    const [first, second] = toDrawList(grid(['a', 'b']));
    expect(first!.x).toBe(0);
    expect(second!.x).toBe(8);
  });

  test('renders the cell colour as a css value', () => {
    expect(toDrawList(grid(['a']))[0]!.color).toBe('rgb(10,20,30)');
  });

  test('overrides every colour when one is given', () => {
    expect(toDrawList(grid(['a', 'b']), { color: '#fff' }).map(d => d.color))
      .toEqual(['#fff', '#fff']);
  });
});
