import { asciiLayer, layersToSvg, fillLayer } from './layer.js';
import type { Grid } from './grid.js';

export interface SvgOptions {
  fontSize: number;
  cellWidth: number;
  cellHeight: number;
  /** Painted behind the glyphs. Omit to leave the svg transparent. */
  background?: string;
  /** Draw every glyph in this colour instead of its cell colour. */
  color?: string;
  fontFamily?: string;
}

/**
 * Serialise a glyph grid as standalone SVG.
 *
 * A convenience wrapper over the layer compositor. Glyphs stay vector, so the
 * art is sharp at any zoom - a canvas is fixed to whatever pixel ratio it was
 * drawn at. Each run is pinned with `textLength` so columns line up even if the
 * viewer's monospace face advances differently from the measured one.
 */
export function gridToSvg(grid: Grid, options: SvgOptions): string {
  const { fontSize, cellWidth, cellHeight, background, color, fontFamily } = options;
  return layersToSvg(
    [
      ...(background === undefined ? [] : [fillLayer(background)]),
      asciiLayer(grid, { fontSize, color, fontFamily, cellWidth, cellHeight }),
    ],
    { width: grid.cols * cellWidth, height: grid.rows * cellHeight },
  );
}
