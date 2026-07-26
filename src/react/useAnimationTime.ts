import { useEffect, useRef, useState } from 'react';

export interface AnimationTimeOptions {
  /** Defaults to true. Pausing holds the current time rather than resetting it. */
  playing?: boolean;
  /** Multiplies elapsed wall-clock seconds. Defaults to 1. */
  speed?: number;
}

/**
 * Elapsed animation time in seconds, driven by `requestAnimationFrame`.
 *
 * Pausing keeps the clock where it is, so resuming continues rather than
 * jumping - the paused span is subtracted, not counted.
 */
export function useAnimationTime(options: AnimationTimeOptions = {}): number {
  const { playing = true, speed = 1 } = options;
  const [time, setTime] = useState(0);
  const elapsed = useRef(0);

  useEffect(() => {
    if (!playing) return;

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      elapsed.current += ((now - last) / 1000) * speed;
      last = now;
      setTime(elapsed.current);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  return time;
}
