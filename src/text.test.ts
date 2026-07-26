import { describe, expect, test } from 'vitest';
import { gridToText } from './text.js';
import type { Grid } from './grid.js';

const grid = (rows: string[]): Grid => {
  const cols = rows[0]!.length;
  return {
    cols,
    rows: rows.length,
    cells: rows.flatMap((line, row) =>
      [...line].map((char, col) => ({
        char, color: { r: 0, g: 0, b: 0 }, x: col, y: row, col, row,
      }))),
  };
};

describe('gridToText', () => {
  test('joins a single row into a line', () => {
    expect(gridToText(grid(['abc']))).toBe('abc');
  });

  test('separates rows with newlines', () => {
    expect(gridToText(grid(['ab', 'cd']))).toBe('ab\ncd');
  });

  test('keeps blank cells so columns stay aligned', () => {
    expect(gridToText(grid(['a b', 'cd '])).split('\n')).toEqual(['a b', 'cd ']);
  });

  test('returns an empty string for an empty grid', () => {
    expect(gridToText({ cols: 0, rows: 0, cells: [] })).toBe('');
  });
});
