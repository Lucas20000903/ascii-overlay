import { asciiLayer, layersToSvg, fillLayer } from './layer.js';
import type { AsciiLayerOptions } from './layer.js';
import type { Grid } from './grid.js';

export interface SvgOptions
  extends Omit<AsciiLayerOptions, 'blend' | 'opacity' | 'filter'> {
  cellWidth: number;
  cellHeight: number;
  /** Painted behind the glyphs. Omit to leave the svg transparent. */
  background?: string;
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
  const { background, ...glyph } = options;
  return layersToSvg(
    [
      ...(background === undefined ? [] : [fillLayer(background)]),
      asciiLayer(grid, glyph),
    ],
    {
      width: grid.cols * options.cellWidth,
      height: grid.rows * options.cellHeight,
    },
  );
}
