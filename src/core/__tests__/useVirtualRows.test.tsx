import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useVirtualRows } from '../useVirtualRows';

interface Props {
  rowCount: number;
  rowHeight: number;
  overscan?: number;
}

function render(initial: Props) {
  return renderHook((props: Props) => useVirtualRows(props), { initialProps: initial });
}

/** Fakes a scroll event without needing a real scrolling element. */
function scrollEvent(scrollTop: number) {
  return { currentTarget: { scrollTop } as HTMLElement };
}

describe('total height', () => {
  it('is rowCount * rowHeight, which is what sizes the scrollbar', () => {
    const { result } = render({ rowCount: 1000, rowHeight: 36 });
    expect(result.current.totalHeight).toBe(36000);
  });

  it('is zero for an empty page', () => {
    const { result } = render({ rowCount: 0, rowHeight: 36 });
    expect(result.current.totalHeight).toBe(0);
  });

  it('tracks a changing row count', () => {
    const { result, rerender } = render({ rowCount: 10, rowHeight: 20 });
    rerender({ rowCount: 25, rowHeight: 20 });
    expect(result.current.totalHeight).toBe(500);
  });
});

describe('the window before measurement', () => {
  it('is empty until a viewport height arrives', () => {
    const { result } = render({ rowCount: 1000, rowHeight: 36 });
    expect(result.current.window).toEqual({ startIndex: 0, endIndex: 0 });
  });

  it('stays empty when the page has no rows, however tall the viewport', () => {
    const { result } = render({ rowCount: 0, rowHeight: 36 });
    act(() => result.current.setViewportHeight(400));
    expect(result.current.window).toEqual({ startIndex: 0, endIndex: 0 });
  });
});

describe('the window at rest', () => {
  it('covers the visible rows plus the overscan below', () => {
    const { result } = render({ rowCount: 1000, rowHeight: 36 });
    act(() => result.current.setViewportHeight(360));

    // 10 visible rows, default overscan of 6, clamped at the top.
    expect(result.current.window).toEqual({ startIndex: 0, endIndex: 16 });
  });

  it('honours a custom overscan', () => {
    const { result } = render({ rowCount: 1000, rowHeight: 36, overscan: 0 });
    act(() => result.current.setViewportHeight(360));
    expect(result.current.window).toEqual({ startIndex: 0, endIndex: 10 });
  });

  it('clamps the end at the row count', () => {
    const { result } = render({ rowCount: 5, rowHeight: 36 });
    act(() => result.current.setViewportHeight(360));
    expect(result.current.window).toEqual({ startIndex: 0, endIndex: 5 });
  });

  it('rounds a partly visible last row up', () => {
    const { result } = render({ rowCount: 1000, rowHeight: 36, overscan: 0 });
    act(() => result.current.setViewportHeight(370));
    // ceil(370 / 36) = 11
    expect(result.current.window.endIndex).toBe(11);
  });

  it('recomputes when the viewport grows', () => {
    const { result } = render({ rowCount: 1000, rowHeight: 36, overscan: 0 });
    act(() => result.current.setViewportHeight(360));
    act(() => result.current.setViewportHeight(720));
    expect(result.current.window).toEqual({ startIndex: 0, endIndex: 20 });
  });

  it('recomputes when the row count shrinks under the current window', () => {
    const { result, rerender } = render({ rowCount: 1000, rowHeight: 36, overscan: 0 });
    act(() => result.current.setViewportHeight(360));
    rerender({ rowCount: 4, rowHeight: 36, overscan: 0 });
    expect(result.current.window.endIndex).toBe(4);
  });

  it('recomputes when the row height changes', () => {
    const { result, rerender } = render({ rowCount: 1000, rowHeight: 36, overscan: 0 });
    act(() => result.current.setViewportHeight(360));
    rerender({ rowCount: 1000, rowHeight: 20, overscan: 0 });
    expect(result.current.window.endIndex).toBe(18);
  });

  it('ignores a repeated setViewportHeight with the same value', () => {
    const { result } = render({ rowCount: 100, rowHeight: 36 });
    act(() => result.current.setViewportHeight(360));
    const before = result.current.window;
    act(() => result.current.setViewportHeight(360));
    expect(result.current.window).toBe(before);
  });
});

describe('scrolling', () => {
  it('moves the window after the animation frame runs', async () => {
    const { result } = render({ rowCount: 1000, rowHeight: 36, overscan: 6 });
    act(() => result.current.setViewportHeight(360));

    act(() => result.current.onScroll(scrollEvent(3600)));

    // first = 100, so 94 .. 100 + 10 + 6
    await waitFor(() =>
      expect(result.current.window).toEqual({ startIndex: 94, endIndex: 116 })
    );
  });

  it('tracks the live offset in a ref without waiting for the frame', () => {
    const { result } = render({ rowCount: 1000, rowHeight: 36 });
    act(() => result.current.setViewportHeight(360));
    act(() => result.current.onScroll(scrollEvent(1234)));
    expect(result.current.scrollTopRef.current).toBe(1234);
  });

  it('coalesces a burst of scroll events into a single frame', async () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
    const { result } = render({ rowCount: 1000, rowHeight: 36 });
    act(() => result.current.setViewportHeight(360));
    raf.mockClear();

    act(() => {
      result.current.onScroll(scrollEvent(100));
      result.current.onScroll(scrollEvent(200));
      result.current.onScroll(scrollEvent(3600));
    });

    expect(raf).toHaveBeenCalledTimes(1);
    // The last offset is the one that lands.
    await waitFor(() => expect(result.current.window.startIndex).toBe(94));
  });

  it('keeps the same window object when scrolling within a single row', async () => {
    // The whole point of promoting scroll to state only when the window moves:
    // a consumer memoised on `window` does no work for a sub-row scroll.
    const { result } = render({ rowCount: 1000, rowHeight: 36, overscan: 6 });
    act(() => result.current.setViewportHeight(360));
    const before = result.current.window;

    act(() => result.current.onScroll(scrollEvent(10)));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(result.current.window).toBe(before);
    expect(result.current.window).toEqual({ startIndex: 0, endIndex: 16 });
  });

  it('clamps the start index at zero when scrolled to the top', async () => {
    const { result } = render({ rowCount: 1000, rowHeight: 36, overscan: 6 });
    act(() => result.current.setViewportHeight(360));
    act(() => result.current.onScroll(scrollEvent(3600)));
    await waitFor(() => expect(result.current.window.startIndex).toBe(94));

    act(() => result.current.onScroll(scrollEvent(0)));
    await waitFor(() => expect(result.current.window.startIndex).toBe(0));
  });

  it('clamps the end index at the row count when scrolled to the bottom', async () => {
    const { result } = render({ rowCount: 100, rowHeight: 36, overscan: 6 });
    act(() => result.current.setViewportHeight(360));

    act(() => result.current.onScroll(scrollEvent(100 * 36)));

    await waitFor(() => expect(result.current.window.endIndex).toBe(100));
  });

  it('keeps the window from a previous scroll when the viewport is remeasured', async () => {
    const { result } = render({ rowCount: 1000, rowHeight: 36, overscan: 0 });
    act(() => result.current.setViewportHeight(360));
    act(() => result.current.onScroll(scrollEvent(3600)));
    await waitFor(() => expect(result.current.window.startIndex).toBe(100));

    act(() => result.current.setViewportHeight(720));
    expect(result.current.window).toEqual({ startIndex: 100, endIndex: 120 });
  });
});

describe('cleanup', () => {
  it('cancels a pending animation frame on unmount', () => {
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const { result, unmount } = render({ rowCount: 1000, rowHeight: 36 });
    act(() => result.current.setViewportHeight(360));
    act(() => result.current.onScroll(scrollEvent(3600)));

    unmount();

    expect(cancel).toHaveBeenCalled();
  });
});
