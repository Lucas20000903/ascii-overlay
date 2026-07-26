import { useMemo } from 'react';
import { renderAscii } from '../render.js';
import type { RenderOptions } from '../render.js';
import type { Grid, Source } from '../grid.js';

/**
 * Cheap structural key for the options.
 *
 * Listing fields by hand stopped scaling once options grew nested objects like
 * `tone` and `grade` - an inline `{ contrast: 1 }` is a new object every render,
 * so identity comparison would rebuild the grid on every keystroke. The mask is
 * excluded and compared by identity instead: it carries a full pixel buffer and
 * is far too big to serialise each render.
 */
function optionsKey(options: RenderOptions): string {
  return JSON.stringify(options, (key, value) => (key === 'mask' ? undefined : value));
}

/**
 * Reduce a source image to a glyph grid, recomputing only when the source or a
 * render option actually changes.
 *
 * Options are compared by value, so callers can pass the object inline without
 * forcing a rebuild on every parent update.
 */
export function useAsciiGrid(source: Source, options: RenderOptions): Grid {
  const key = optionsKey(options);
  return useMemo(
    () => renderAscii(source, options),
    // `options` is deliberately absent: `key` stands in for its contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, key, options.mask],
  );
}
