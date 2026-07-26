import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Source } from '../grid.js';

/** `HTMLMediaElement.HAVE_CURRENT_DATA` - the first state with a frame to read. */
const HAVE_CURRENT_DATA = 2;

export interface VideoSourceOptions {
  /** Defaults to true. */
  playing?: boolean;
  /**
   * Cap on the sampled width; taller frames scale to keep their aspect.
   *
   * Cost scales with pixel count, and cells average many pixels anyway, so
   * sampling a 1080p frame at full size buys detail nothing can show.
   */
  maxWidth?: number;
}

/**
 * Sample frames from a `<video>` into a renderable source.
 *
 * The scratch context is created with `willReadFrequently`, without which
 * `getImageData` roughly doubles in cost - the readback, not the ascii work, is
 * what usually blows a video frame budget.
 */
export function useVideoSource(
  video: RefObject<HTMLVideoElement | null>,
  options: VideoSourceOptions = {},
): Source | null {
  const { playing = true, maxWidth } = options;
  const [source, setSource] = useState<Source | null>(null);
  const scratch = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;

    const sample = () => {
      frame = requestAnimationFrame(sample);
      const el = video.current;
      if (!el || el.readyState < HAVE_CURRENT_DATA) return;
      if (el.videoWidth === 0 || el.videoHeight === 0) return;

      const scale = maxWidth === undefined || el.videoWidth <= maxWidth
        ? 1
        : maxWidth / el.videoWidth;
      const width = Math.round(el.videoWidth * scale);
      const height = Math.round(el.videoHeight * scale);

      scratch.current ??= document.createElement('canvas');
      const canvas = scratch.current;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(el, 0, 0, width, height);
      setSource(ctx.getImageData(0, 0, width, height));
    };

    frame = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(frame);
  }, [video, playing, maxWidth]);

  return source;
}
