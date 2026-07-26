import { asciiLayer, fillLayer, imageLayer, paintLayers } from './layer.js';
import type { Layer } from './layer.js';
import type { Grid } from './grid.js';

/**
 * The slice of `CanvasRenderingContext2D` this module needs.
 *
 * Declared structurally so the renderer stays testable without a DOM and works
 * against an `OffscreenCanvas` context too.
 */
export interface Ctx2D {
  canvas: { width: number; height: number };
  /** Widened to match the real context; this module only ever sets a string. */
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textBaseline: string;
  filter: string;
  globalAlpha: number;
  globalCompositeOperation: string;
  save(): void;
  restore(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  measureText(text: string): { width: number };
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: CanvasImageSource, x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
}

export interface Backdrop {
  /** Usually the original image, or a canvas holding it. Scaled to fill. */
  image: CanvasImageSource;
  /** Gaussian blur radius in pixels. */
  blur?: number;
  /** 0..1. Defaults to fully opaque. */
  opacity?: number;
}

/** How the glyph layer composites onto what is already on the canvas. */
export type GlyphBlend =
  | 'normal' | 'screen' | 'overlay' | 'color-dodge' | 'lighter';

export interface DrawOptions {
  /** Glyph size in pixels; also the monospace font size. */
  fontSize: number;
  /** Painted behind everything. Omit to leave the canvas transparent. */
  background?: string;
  /** Composited between the background and the glyphs. */
  backdrop?: Backdrop;
  /** Draw every glyph in this colour instead of its cell colour. */
  color?: string;
  /** Composite mode for the glyph layer. Defaults to `normal`. */
  blend?: GlyphBlend;
  /**
   * Device pixels per source pixel. Give the canvas a backing store this many
   * times larger than its css size and pass the same number here to draw
   * sharply on a high-density display. Defaults to 1.
   */
  pixelRatio?: number;
  /**
   * Wipe the surface first. Turn it off to stack layers onto one canvas -
   * each call then composites over what is already there.
   */
  clear?: boolean;
  fontFamily?: string;
}

/**
 * Draw a glyph grid onto a 2D canvas context.
 *
 * A convenience wrapper over the layer compositor: background, backdrop and
 * glyphs are just a three-layer stack. Reach for `paintLayers` directly when
 * you need more than that.
 */
export function drawToCanvas(ctx: Ctx2D, grid: Grid, options: DrawOptions): void {
  const layers: Layer[] = [];

  if (options.background !== undefined) layers.push(fillLayer(options.background));

  const backdrop = options.backdrop;
  if (backdrop) {
    layers.push(imageLayer(backdrop.image, {
      filter: backdrop.blur ? `blur(${backdrop.blur}px)` : undefined,
      opacity: backdrop.opacity,
    }));
  }

  layers.push(asciiLayer(grid, {
    fontSize: options.fontSize,
    color: options.color,
    fontFamily: options.fontFamily,
    blend: options.blend,
  }));

  paintLayers(ctx, layers, {
    pixelRatio: options.pixelRatio,
    // an opaque background already covers the surface, so skip the wipe
    clear: options.clear ?? options.background === undefined,
  });
}
