import { describe, expect, test } from 'vitest';
import { measureCell } from './metrics.js';
import type { TextMeasureCtx } from './metrics.js';

/** Stand-in for a canvas context, reporting the metrics we tell it to. */
function ctxWith(metrics: Record<string, {
  width: number; ascent?: number; descent?: number;
}>): TextMeasureCtx & { font: string } {
  return {
    font: '',
    measureText(text: string) {
      const m = metrics[text] ?? { width: 0 };
      return {
        width: m.width,
        actualBoundingBoxAscent: m.ascent,
        actualBoundingBoxDescent: m.descent,
      };
    },
  };
}

describe('measureCell', () => {
  test('sets the font before measuring', () => {
    const ctx = ctxWith({ M: { width: 6.62, ascent: 8, descent: 0 } });
    measureCell(ctx, 11);
    expect(ctx.font).toBe('11px monospace');
  });

  test('honours a custom font family', () => {
    const ctx = ctxWith({ M: { width: 7, ascent: 8, descent: 0 } });
    measureCell(ctx, 11, { fontFamily: 'Menlo, monospace' });
    expect(ctx.font).toBe('11px Menlo, monospace');
  });

  test('takes the advance width as the cell width', () => {
    const ctx = ctxWith({ M: { width: 6.62, ascent: 8, descent: 0 } });
    expect(measureCell(ctx, 11).cellWidth).toBeCloseTo(6.62, 4);
  });

  test('takes the glyph ink height as the cell height', () => {
    const ctx = ctxWith({ M: { width: 6.62, ascent: 6.5, descent: 1.5 } });
    expect(measureCell(ctx, 11).cellHeight).toBeCloseTo(8, 4);
  });

  test('measures whichever sample glyph is asked for', () => {
    const ctx = ctxWith({
      M: { width: 6.62, ascent: 8, descent: 0 },
      '█': { width: 6.62, ascent: 8.46, descent: 2.75 },
    });
    expect(measureCell(ctx, 11, { sample: '█' }).cellHeight).toBeCloseTo(11.21, 4);
  });

  test('falls back to the font size when ink metrics are missing', () => {
    const ctx = ctxWith({ M: { width: 6.62 } });
    expect(measureCell(ctx, 11).cellHeight).toBe(11);
  });

  test('falls back to the font size when the ink box is empty', () => {
    const ctx = ctxWith({ M: { width: 6.62, ascent: 0, descent: 0 } });
    expect(measureCell(ctx, 11).cellHeight).toBe(11);
  });

  test('averages ink across a ramp when one is given', () => {
    const ctx = ctxWith({
      M: { width: 6.62, ascent: 8, descent: 0 },
      '.': { width: 6.62, ascent: 1, descent: 0 },
      '+': { width: 6.62, ascent: 4.2, descent: 1.4 },
      '@': { width: 6.62, ascent: 7.4, descent: 2 },
    });
    // mean of 1, 5.6 and 9.4
    expect(measureCell(ctx, 11, { ramp: ' .+@' }).cellHeight).toBeCloseTo(5.3333, 3);
  });

  test('ignores blanks when averaging a ramp', () => {
    const ctx = ctxWith({
      M: { width: 6.62, ascent: 8, descent: 0 },
      '@': { width: 6.62, ascent: 6, descent: 0 },
    });
    expect(measureCell(ctx, 11, { ramp: '   @' }).cellHeight).toBeCloseTo(6, 4);
  });

  test('still takes the cell width from the advance when given a ramp', () => {
    const ctx = ctxWith({
      M: { width: 6.62, ascent: 8, descent: 0 },
      '@': { width: 6.62, ascent: 6, descent: 0 },
    });
    expect(measureCell(ctx, 11, { ramp: ' @' }).cellWidth).toBeCloseTo(6.62, 4);
  });

  test('lineHeight tightens or loosens the rows', () => {
    const ctx = ctxWith({ M: { width: 6.62, ascent: 8, descent: 0 } });
    expect(measureCell(ctx, 11, { lineHeight: 0.75 }).cellHeight).toBeCloseTo(6, 4);
    expect(measureCell(ctx, 11, { lineHeight: 1.25 }).cellHeight).toBeCloseTo(10, 4);
  });

  test('lineHeight applies to a ramp measurement too', () => {
    const ctx = ctxWith({
      M: { width: 6.62, ascent: 8, descent: 0 },
      '@': { width: 6.62, ascent: 6, descent: 0 },
    });
    expect(measureCell(ctx, 11, { ramp: ' @', lineHeight: 0.5 }).cellHeight).toBeCloseTo(3, 4);
  });

  test('falls back to the font size for a ramp with no ink', () => {
    const ctx = ctxWith({ M: { width: 6.62, ascent: 8, descent: 0 } });
    expect(measureCell(ctx, 11, { ramp: '   ' }).cellHeight).toBe(11);
  });

  test('rejects a non-positive font size', () => {
    const ctx = ctxWith({ M: { width: 6.62, ascent: 8, descent: 0 } });
    expect(() => measureCell(ctx, 0)).toThrow(/font size/i);
  });
});
