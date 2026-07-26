import { toDrawList } from './paint.js';
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
  fontFamily?: string;
}

/**
 * Draw a glyph grid onto a 2D canvas context.
 *
 * Layers, bottom to top: background, backdrop image, glyphs. The backdrop's
 * blur and opacity are wrapped in save/restore so they cannot bleed into the
 * glyphs - a blurred backdrop with sharp text is the whole point.
 */
export function drawToCanvas(ctx: Ctx2D, grid: Grid, options: DrawOptions): void {
  const ratio = options.pixelRatio ?? 1;
  // Everything below works in source pixels; the transform maps them onto the
  // larger backing store.
  if (ratio !== 1) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = ctx.canvas.width / ratio;
  const height = ctx.canvas.height / ratio;

  if (options.background === undefined) {
    ctx.clearRect(0, 0, width, height);
  } else {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, width, height);
  }

  const backdrop = options.backdrop;
  if (backdrop) {
    ctx.save();
    if (backdrop.blur) ctx.filter = `blur(${backdrop.blur}px)`;
    if (backdrop.opacity !== undefined) ctx.globalAlpha = backdrop.opacity;
    ctx.drawImage(backdrop.image, 0, 0, width, height);
    ctx.restore();
  }

  ctx.font = `${options.fontSize}px ${options.fontFamily ?? 'monospace'}`;
  ctx.textBaseline = 'top';

  const blend = options.blend ?? 'normal';
  if (blend !== 'normal') {
    ctx.save();
    ctx.globalCompositeOperation = blend;
  }

  for (const item of toDrawList(grid, { color: options.color })) {
    ctx.fillStyle = item.color;
    ctx.fillText(item.char, item.x, item.y);
  }

  if (blend !== 'normal') ctx.restore();

  if (ratio !== 1) ctx.setTransform(1, 0, 0, 1, 0, 0);
}
