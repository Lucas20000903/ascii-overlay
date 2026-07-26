import type { Grid } from './grid.js';

/** Glyphs that occupy a cell without marking it. */
const BLANK = new Set([' ', '⠀']);

/** A horizontal stretch of same-coloured glyphs, drawable as one text node. */
export interface Run {
  text: string;
  /** Top-left of the first cell, in source pixels. */
  x: number;
  y: number;
  color: string;
  /** How many cells the run spans, so its width can be pinned. */
  cells: number;
}

export interface RunOptions {
  /** Draw every glyph in this colour, which merges runs across colour changes. */
  color?: string;
}

/**
 * Group a grid into contiguous same-coloured stretches.
 *
 * One text node per stretch instead of one per glyph keeps an SVG of a
 * 136x64 grid in the hundreds of elements rather than the thousands. A run
 * breaks on a colour change, a blank cell or the end of a row.
 */
export function toRuns(grid: Grid, options: RunOptions = {}): Run[] {
  const runs: Run[] = [];
  let current: Run | null = null;
  let lastCol = -1;

  for (const cell of grid.cells) {
    if (BLANK.has(cell.char)) {
      current = null;
      continue;
    }

    const color = options.color
      ?? `rgb(${cell.color.r},${cell.color.g},${cell.color.b})`;
    const continues = current !== null
      && current.y === cell.y
      && current.color === color
      && cell.col === lastCol + 1;

    if (continues) {
      current!.text += cell.char;
      current!.cells += 1;
    } else {
      current = { text: cell.char, x: cell.x, y: cell.y, color, cells: 1 };
      runs.push(current);
    }
    lastCol = cell.col;
  }

  return runs;
}
