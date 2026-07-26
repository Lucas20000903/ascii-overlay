import type { Grid } from './grid.js';

/** Glyphs that occupy a cell without marking it. */
const BLANK = new Set([' ', '⠀']);

export interface DrawItem {
  char: string;
  /** Top-left of the cell, in source pixels. */
  x: number;
  y: number;
  /** CSS colour to draw the glyph in. */
  color: string;
}

export interface PaintOptions {
  /** Draw every glyph in this colour instead of the cell's own colour. */
  color?: string;
}

/**
 * Flatten a grid into the glyphs that actually need drawing.
 *
 * Blank cells are dropped: they cost a draw call and change nothing.
 */
export function toDrawList(grid: Grid, options: PaintOptions = {}): DrawItem[] {
  const items: DrawItem[] = [];
  for (const cell of grid.cells) {
    if (BLANK.has(cell.char)) continue;
    items.push({
      char: cell.char,
      x: cell.x,
      y: cell.y,
      color: options.color ?? `rgb(${cell.color.r},${cell.color.g},${cell.color.b})`,
    });
  }
  return items;
}
