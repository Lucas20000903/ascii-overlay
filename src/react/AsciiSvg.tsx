import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { asciiLayer } from '../layer.js';
import { useAsciiGrid } from './useAsciiGrid.js';
import type { AsciiLayerOptions } from '../layer.js';
import type { RenderOptions } from '../render.js';
import type { Source } from '../grid.js';

type GlyphProps = Omit<AsciiLayerOptions,
  'fontSize' | 'color' | 'fontFamily' | 'cellWidth' | 'cellHeight'
  | 'blend' | 'opacity' | 'filter'>;

export interface AsciiSvgProps extends RenderOptions, GlyphProps {
  source: Source;
  /** Glyph size in pixels. Defaults to the cell height. */
  fontSize?: number;
  /** Painted behind the glyphs. Omit for a transparent svg. */
  background?: string;
  /** Draw every glyph in this colour instead of its cell colour. */
  color?: string;
  fontFamily?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Draw a source image as ASCII art in SVG.
 *
 * Glyphs stay vector, so the art is sharp however far it is scaled - unlike
 * `AsciiCanvas`, which is fixed to the pixel ratio it was drawn at.
 *
 * The glyph markup comes from `asciiLayer`, the same code the layer compositor
 * uses. Rendering it here as React elements instead would be a second
 * implementation to keep in step, and the first time they drifted the component
 * quietly lost every option the layer had gained.
 */
export function AsciiSvg({
  source, fontSize, background, color, fontFamily,
  cellBackground, fillBlankCells, offset, className, style, ...options
}: AsciiSvgProps) {
  const grid = useAsciiGrid(source, options);

  const width = grid.cols * options.cellWidth;
  const height = grid.rows * options.cellHeight;

  const markup = useMemo(() => asciiLayer(grid, {
    fontSize: fontSize ?? options.cellHeight,
    color,
    fontFamily,
    cellWidth: options.cellWidth,
    cellHeight: options.cellHeight,
    cellBackground,
    fillBlankCells,
    offset,
  }).toSvgMarkup({ width, height }),
  [grid, fontSize, color, fontFamily, options.cellWidth, options.cellHeight,
   cellBackground, fillBlankCells, offset, width, height]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      style={style}
    >
      {background !== undefined && (
        <rect width="100%" height="100%" fill={background} />
      )}
      <g dangerouslySetInnerHTML={{ __html: markup }} />
    </svg>
  );
}
