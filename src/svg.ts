import { toRuns } from './runs.js';
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

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const escapeXml = (s: string) => s.replace(/[&<>]/g, c => ESCAPES[c]!);

/**
 * Serialise a glyph grid as standalone SVG.
 *
 * Glyphs stay vector, so the art is sharp at any zoom - a canvas is fixed to
 * whatever pixel ratio it was drawn at. Each run is pinned with `textLength`
 * so the columns line up even if the viewer's monospace face advances
 * differently from the one the grid was measured against.
 */
export function gridToSvg(grid: Grid, options: SvgOptions): string {
  const { fontSize, cellWidth, cellHeight, background, color, fontFamily } = options;
  const width = grid.cols * cellWidth;
  const height = grid.rows * cellHeight;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}">`,
  ];

  if (background !== undefined) {
    parts.push(`<rect width="100%" height="100%" fill="${background}"/>`);
  }

  parts.push(
    `<g font-family="${fontFamily ?? 'monospace'}" font-size="${fontSize}" ` +
    `dominant-baseline="text-before-edge" xml:space="preserve">`,
  );

  for (const run of toRuns(grid, { color })) {
    parts.push(
      `<text x="${run.x}" y="${run.y}" fill="${run.color}" ` +
      `textLength="${run.cells * cellWidth}" lengthAdjust="spacing">` +
      `${escapeXml(run.text)}</text>`,
    );
  }

  parts.push('</g>', '</svg>');
  return parts.join('\n');
}
