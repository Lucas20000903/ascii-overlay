// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVideoSource } from './useVideoSource.js';

interface FakeVideo { videoWidth: number; videoHeight: number; readyState: number }

let contextArgs: unknown[] = [];
let drawn: unknown[][] = [];

function stubCanvas() {
  contextArgs = [];
  drawn = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement, ...args: unknown[]) {
      contextArgs.push(args);
      return {
        drawImage: (...a: unknown[]) => { drawn.push(a); },
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          width: w, height: h, data: new Uint8ClampedArray(w * h * 4),
        }),
      } as unknown as CanvasRenderingContext2D;
    });
}

const ref = (v: FakeVideo | null) =>
  ({ current: v as unknown as HTMLVideoElement | null });

const HAVE_CURRENT_DATA = 2;

beforeEach(() => { vi.useFakeTimers(); stubCanvas(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const tick = async (ms: number) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
};

describe('useVideoSource', () => {
  test('has nothing before a frame arrives', () => {
    const { result } = renderHook(() => useVideoSource(ref(null)));
    expect(result.current).toBeNull();
  });

  test('waits for the video to have data', async () => {
    const video = { videoWidth: 320, videoHeight: 180, readyState: 0 };
    const { result } = renderHook(() => useVideoSource(ref(video)));
    await tick(200);
    expect(result.current).toBeNull();
  });

  test('samples a frame once the video has data', async () => {
    const video = { videoWidth: 320, videoHeight: 180, readyState: HAVE_CURRENT_DATA };
    const { result } = renderHook(() => useVideoSource(ref(video)));
    await tick(100);
    expect(result.current).not.toBeNull();
    expect(result.current!.width).toBe(320);
    expect(result.current!.height).toBe(180);
  });

  test('asks for a context tuned for frequent reads', async () => {
    // without this flag getImageData roughly doubles in cost
    const video = { videoWidth: 320, videoHeight: 180, readyState: HAVE_CURRENT_DATA };
    renderHook(() => useVideoSource(ref(video)));
    await tick(100);
    expect(contextArgs[0]).toEqual(['2d', { willReadFrequently: true }]);
  });

  test('scales a large frame down to the cap', async () => {
    const video = { videoWidth: 1920, videoHeight: 1080, readyState: HAVE_CURRENT_DATA };
    const { result } = renderHook(() => useVideoSource(ref(video), { maxWidth: 640 }));
    await tick(100);
    expect(result.current!.width).toBe(640);
    expect(result.current!.height).toBe(360);
  });

  test('leaves a small frame alone', async () => {
    const video = { videoWidth: 320, videoHeight: 180, readyState: HAVE_CURRENT_DATA };
    const { result } = renderHook(() => useVideoSource(ref(video), { maxWidth: 640 }));
    await tick(100);
    expect(result.current!.width).toBe(320);
  });

  test('does not sample while paused', async () => {
    const video = { videoWidth: 320, videoHeight: 180, readyState: HAVE_CURRENT_DATA };
    const { result } = renderHook(() => useVideoSource(ref(video), { playing: false }));
    await tick(200);
    expect(result.current).toBeNull();
  });

  test('stops sampling after unmount', async () => {
    const video = { videoWidth: 320, videoHeight: 180, readyState: HAVE_CURRENT_DATA };
    const { unmount } = renderHook(() => useVideoSource(ref(video)));
    await tick(100);
    const seen = drawn.length;
    unmount();
    await tick(200);
    expect(drawn.length).toBe(seen);
  });
});
