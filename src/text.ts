import type { Grid } from './grid.js';

/** Render a glyph grid as plain text, one line per row. */
export function gridToText(grid: Grid): string {
  const lines: string[] = [];
  for (let row = 0; row < grid.rows; row++) {
    let line = '';
    for (let col = 0; col < grid.cols; col++) {
      line += grid.cells[row * grid.cols + col]?.char ?? ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}
