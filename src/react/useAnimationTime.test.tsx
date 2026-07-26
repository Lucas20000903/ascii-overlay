// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAnimationTime } from './useAnimationTime.js';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const advance = async (ms: number) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
};

describe('useAnimationTime', () => {
  test('starts at zero', () => {
    const { result } = renderHook(() => useAnimationTime());
    expect(result.current).toBe(0);
  });

  test('advances roughly in seconds while playing', async () => {
    const { result } = renderHook(() => useAnimationTime());
    await advance(500);
    expect(result.current).toBeGreaterThan(0.3);
    expect(result.current).toBeLessThan(0.7);
  });

  test('stays put when paused', async () => {
    const { result } = renderHook(() => useAnimationTime({ playing: false }));
    await advance(500);
    expect(result.current).toBe(0);
  });

  test('scales elapsed time by speed', async () => {
    const { result } = renderHook(() => useAnimationTime({ speed: 4 }));
    await advance(500);
    expect(result.current).toBeGreaterThan(1.2);
  });

  test('stops advancing once unmounted', async () => {
    const { result, unmount } = renderHook(() => useAnimationTime());
    await advance(300);
    const atUnmount = result.current;
    unmount();
    await advance(300);
    expect(result.current).toBe(atUnmount);
  });
});
