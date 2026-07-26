import { describe, expect, test } from 'vitest';
import { toRuns } from './runs.js';
import type { Cell, Grid } from './grid.js';

const cell = (char: string, col: number, row: number, rgb: [number, number, number]): Cell => ({
  char, color: { r: rgb[0], g: rgb[1], b: rgb[2] },
  x: col * 10, y: row * 20, col, row,
});

const grid = (cells: Cell[], cols: number, rows: number): Grid => ({ cols, rows, cells });

const RED: [number, number, number] = [255, 0, 0];
const BLUE: [number, number, number] = [0, 0, 255];

describe('toRuns', () => {
  test('joins adjacent cells of the same colour into one run', () => {
    const runs = toRuns(grid([cell('a', 0, 0, RED), cell('b', 1, 0, RED)], 2, 1));
    expect(runs).toHaveLength(1);
    expect(runs[0]!.text).toBe('ab');
    expect(runs[0]!.cells).toBe(2);
  });

  test('splits where the colour changes', () => {
    const runs = toRuns(grid([cell('a', 0, 0, RED), cell('b', 1, 0, BLUE)], 2, 1));
    expect(runs.map(r => r.text)).toEqual(['a', 'b']);
  });

  test('splits where a blank interrupts', () => {
    const runs = toRuns(grid(
      [cell('a', 0, 0, RED), cell(' ', 1, 0, RED), cell('b', 2, 0, RED)], 3, 1));
    expect(runs.map(r => r.text)).toEqual(['a', 'b']);
  });

  test('splits at a row boundary', () => {
    const runs = toRuns(grid([cell('a', 0, 0, RED), cell('b', 0, 1, RED)], 1, 2));
    expect(runs).toHaveLength(2);
    expect(runs[1]!.y).toBe(20);
  });

  test('records where the run starts', () => {
    const runs = toRuns(grid([cell(' ', 0, 0, RED), cell('b', 1, 0, RED)], 2, 1));
    expect(runs[0]!.x).toBe(10);
    expect(runs[0]!.y).toBe(0);
  });

  test('renders the cell colour as css', () => {
    const runs = toRuns(grid([cell('a', 0, 0, RED)], 1, 1));
    expect(runs[0]!.color).toBe('rgb(255,0,0)');
  });

  test('merges everything into one run under a colour override', () => {
    const runs = toRuns(grid([cell('a', 0, 0, RED), cell('b', 1, 0, BLUE)], 2, 1),
      { color: '#fff' });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.color).toBe('#fff');
  });

  test('drops blank braille cells', () => {
    const runs = toRuns(grid([cell('⠀', 0, 0, RED), cell('⠁', 1, 0, RED)], 2, 1));
    expect(runs.map(r => r.text)).toEqual(['⠁']);
  });

  test('returns nothing for an empty grid', () => {
    expect(toRuns({ cols: 0, rows: 0, cells: [] })).toEqual([]);
  });
});
