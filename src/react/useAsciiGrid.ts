import { useMemo } from 'react';
import { renderAscii } from '../render.js';
import type { RenderOptions } from '../render.js';
import type { Grid, Source } from '../grid.js';

/**
 * Cheap structural key for the options.
 *
 * Listing fields by hand stopped scaling once options grew nested objects like
 * `tone` and `grade` - an inline `{ contrast: 1 }` is a new object every render,
 * so identity comparison would rebuild the grid on every keystroke.
 *
 * Two things are excluded and compared by identity instead. The mask carries a
 * full pixel buffer, far too big to serialise each render. Functions vanish
 * from `JSON.stringify` entirely, so a key cannot see them at all.
 */
function optionsKey(options: RenderOptions): string {
  return JSON.stringify(options, (key, value) => (key === 'mask' ? undefined : value));
}

/**
 * Reduce a source image to a glyph grid, recomputing only when the source or a
 * render option actually changes.
 *
 * Plain options are compared by value, so they can be passed inline. Callbacks
 * are compared by identity: memoise them, or accept a rebuild per render.
 */
export function useAsciiGrid(source: Source, options: RenderOptions): Grid {
  const key = optionsKey(options);
  return useMemo(
    () => renderAscii(source, options),
    // `options` is deliberately absent: `key` stands in for the parts of it
    // that serialise, and the rest are listed alongside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, key, options.mask, options.sampleOffset],
  );
}
