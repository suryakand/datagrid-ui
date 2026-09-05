import { useCallback, useEffect, useRef, useState } from 'react';

export interface VirtualWindow {
  startIndex: number;
  endIndex: number;
}

export interface UseVirtualRowsOptions {
  rowCount: number;
  rowHeight: number;
  overscan?: number;
}

export interface UseVirtualRowsResult {
  window: VirtualWindow;
  totalHeight: number;
  /** Attach to the scrolling element. */
  onScroll: (event: { currentTarget: HTMLElement }) => void;
  /** Call when the viewport is measured or resized. */
  setViewportHeight: (height: number) => void;
  scrollTopRef: React.RefObject<number>;
}

/**
 * Fixed-height row windowing.
 *
 * Fixed heights are a deliberate constraint: they make the visible range O(1)
 * to compute and remove the measure-then-reflow pass that variable heights
 * force. Scroll position is tracked in a ref and only promoted to state when
 * the computed window actually changes, so scrolling within a row does not
 * re-render anything.
 */
export function useVirtualRows({
  rowCount,
  rowHeight,
  overscan = 6,
}: UseVirtualRowsOptions): UseVirtualRowsResult {
  const [viewportHeight, setViewportHeightState] = useState(0);
  const [window, setWindow] = useState<VirtualWindow>({ startIndex: 0, endIndex: 0 });

  const scrollTopRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const compute = useCallback(
    (scrollTop: number, height: number) => {
      if (height <= 0 || rowCount === 0) {
        return { startIndex: 0, endIndex: 0 };
      }
      const first = Math.floor(scrollTop / rowHeight);
      const visible = Math.ceil(height / rowHeight);
      return {
        startIndex: Math.max(0, first - overscan),
        endIndex: Math.min(rowCount, first + visible + overscan),
      };
    },
    [rowCount, rowHeight, overscan]
  );

  const apply = useCallback(
    (scrollTop: number, height: number) => {
      const next = compute(scrollTop, height);
      setWindow((current) =>
        current.startIndex === next.startIndex && current.endIndex === next.endIndex
          ? current
          : next
      );
    },
    [compute]
  );

  const onScroll = useCallback(
    (event: { currentTarget: HTMLElement }) => {
      scrollTopRef.current = event.currentTarget.scrollTop;
      if (frameRef.current != null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        apply(scrollTopRef.current, viewportHeight);
      });
    },
    [apply, viewportHeight]
  );

  const setViewportHeight = useCallback((height: number) => {
    setViewportHeightState((current) => (current === height ? current : height));
  }, []);

  // Row count, row height and viewport size all move the window without a
  // scroll event, so recompute when any of them change.
  useEffect(() => {
    apply(scrollTopRef.current, viewportHeight);
  }, [apply, viewportHeight]);

  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    },
    []
  );

  return {
    window,
    totalHeight: rowCount * rowHeight,
    onScroll,
    setViewportHeight,
    scrollTopRef,
  };
}
