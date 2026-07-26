import type { CSSProperties } from 'react';
import { gridToText } from '../text.js';
import { useAsciiGrid } from './useAsciiGrid.js';
import type { RenderOptions } from '../render.js';
import type { Source } from '../grid.js';

export interface AsciiTextProps extends RenderOptions {
  source: Source;
  className?: string;
  style?: CSSProperties;
}

/**
 * Render a source image as selectable, copyable text.
 *
 * Wrapped in a `<pre>` so the monospace grid and its blank cells survive.
 */
export function AsciiText({ source, className, style, ...options }: AsciiTextProps) {
  const grid = useAsciiGrid(source, options);
  return (
    <pre className={className} style={{ margin: 0, ...style }}>
      {gridToText(grid)}
    </pre>
  );
}
