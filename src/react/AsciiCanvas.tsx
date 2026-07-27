import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { drawToCanvas } from '../canvas.js';
import { useAsciiGrid } from './useAsciiGrid.js';
import type { Backdrop, DrawOptions, GlyphBlend } from '../canvas.js';
import type { RenderOptions } from '../render.js';
import type { Source } from '../grid.js';

type GlyphProps = Omit<DrawOptions,
  'fontSize' | 'background' | 'backdrop' | 'color' | 'blend' | 'pixelRatio'
  | 'fontFamily' | 'cellWidth' | 'cellHeight'>;

export interface AsciiCanvasProps extends RenderOptions, GlyphProps {
  source: Source;
  /** Glyph size in pixels. Defaults to the cell height. */
  fontSize?: number;
  /** Painted behind everything. Omit for a transparent canvas. */
  background?: string;
  /** Composited between the background and the glyphs. */
  backdrop?: Backdrop;
  /** Draw every glyph in this colour instead of its own cell colour. */
  color?: string;
  /** Composite mode for the glyph layer. */
  blend?: GlyphBlend;
  /**
   * Device pixels per source pixel. Defaults to the display's own ratio, which
   * keeps glyphs sharp on a retina screen.
   */
  pixelRatio?: number;
  fontFamily?: string;
  className?: string;
  style?: CSSProperties;
}

/** Draw a source image as ASCII art on a canvas. */
export function AsciiCanvas({
  source, fontSize, background, backdrop, color, blend, pixelRatio, fontFamily,
  cellBackground, fillBlankCells, offset, className, style, ...options
}: AsciiCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const grid = useAsciiGrid(source, options);
  const size = fontSize ?? options.cellHeight;
  const ratio = pixelRatio
    ?? (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    drawToCanvas(ctx, grid, {
      fontSize: size, background, backdrop, color, blend, fontFamily,
      cellBackground, fillBlankCells, offset, pixelRatio: ratio,
    });
  }, [grid, size, background, backdrop, color, blend, fontFamily,
      cellBackground, fillBlankCells, offset, ratio]);

  return (
    <canvas
      ref={ref}
      width={Math.round(source.width * ratio)}
      height={Math.round(source.height * ratio)}
      className={className}
      style={{ width: source.width, height: source.height, ...style }}
    />
  );
}
