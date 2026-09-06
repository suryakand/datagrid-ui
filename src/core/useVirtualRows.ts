import { useCallback, useEffect, useRef, useState } from 'react';

/** The slice of rows currently worth rendering. */
export interface VirtualWindow {
  /** First row index to render, inclusive. Includes overscan. */
  startIndex: number;
  /** Index one past the last row to render, exclusive. */
  endIndex: number;
}

/** Options for {@link useVirtualRows}. */
export interface UseVirtualRowsOptions {
  /** How many rows exist in the current page. */
  rowCount: number;
  /** Fixed height of every row, in pixels. */
  rowHeight: number;
  /**
   * Extra rows rendered above and below the viewport, so fast scrolling does
   * not show blank space.
   * @defaultValue 6
   */
  overscan?: number;
}

/** What {@link useVirtualRows} returns. */
export interface UseVirtualRowsResult {
  /** The rows to render right now. */
  window: VirtualWindow;
  /** `rowCount * rowHeight` — the spacer height that gives the correct scrollbar. */
  totalHeight: number;
  /** Attach to the scrolling element's `onScroll`. */
  onScroll: (event: { currentTarget: HTMLElement }) => void;
  /** Call when the viewport is measured or resized. */
  setViewportHeight: (height: number) => void;
  /** Live scroll offset, readable without causing a re-render. */
  scrollTopRef: React.RefObject<number>;
}

/**
 * Fixed-height row windowing.
 *
 * @param options - Row count, row height and overscan.
 * @returns The visible window plus the handlers that maintain it.
 *
 * @remarks
 * Fixed heights are a deliberate constraint: they make the visible range O(1)
 * to compute and remove the measure-then-reflow pass that variable heights
 * force. Scroll position is tracked in a ref and only promoted to state when
 * the computed window actually changes, so scrolling within a single row
 * re-renders nothing.
 *
 * @example
 * ```tsx
 * const { window, totalHeight, onScroll, setViewportHeight } = useVirtualRows({
 *   rowCount: rows.length,
 *   rowHeight: 36,
 * });
 *
 * <div onScroll={onScroll} style={{ overflow: 'auto' }}>
 *   <div style={{ height: totalHeight }}>
 *     {rows.slice(window.startIndex, window.endIndex).map(renderRow)}
 *   </div>
 * </div>
 * ```
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
