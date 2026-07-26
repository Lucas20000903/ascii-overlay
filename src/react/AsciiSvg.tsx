import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { toRuns } from '../runs.js';
import { useAsciiGrid } from './useAsciiGrid.js';
import type { RenderOptions } from '../render.js';
import type { Source } from '../grid.js';

export interface AsciiSvgProps extends RenderOptions {
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
 * `AsciiCanvas`, which is fixed to the pixel ratio it was drawn at. The cost is
 * a text node per colour run rather than a single bitmap.
 */
export function AsciiSvg({
  source, fontSize, background, color, fontFamily, className, style, ...options
}: AsciiSvgProps) {
  const grid = useAsciiGrid(source, options);
  const runs = useMemo(() => toRuns(grid, { color }), [grid, color]);

  const width = grid.cols * options.cellWidth;
  const height = grid.rows * options.cellHeight;

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
      <g
        fontFamily={fontFamily ?? 'monospace'}
        fontSize={fontSize ?? options.cellHeight}
        dominantBaseline="text-before-edge"
        xmlSpace="preserve"
      >
        {runs.map((run, i) => (
          <text
            key={`${run.y}-${run.x}-${i}`}
            x={run.x}
            y={run.y}
            fill={run.color}
            textLength={run.cells * options.cellWidth}
            lengthAdjust="spacing"
          >
            {run.text}
          </text>
        ))}
      </g>
    </svg>
  );
}
