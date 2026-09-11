import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

/** Gap, in px, kept between a nudged popup and the edge that would clip it. */
const EDGE_GAP = 4;

/** Computed `overflow-x` values that clip descendants. */
const CLIPS = /^(hidden|clip|auto|scroll)$/;

/**
 * The horizontal band, in viewport px, in which `element` can actually be seen:
 * the window, narrowed by every ancestor whose overflow clips it.
 */
function visibleBand(element: HTMLElement): { left: number; right: number } {
  let left = 0;
  let right = document.documentElement.clientWidth || window.innerWidth;
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (!CLIPS.test(getComputedStyle(node).overflowX)) continue;
    const inner = node.getBoundingClientRect().left + node.clientLeft;
    left = Math.max(left, inner);
    right = Math.min(right, inner + node.clientWidth);
  }
  return { left, right };
}

/**
 * Keeps an absolutely positioned popup inside the area that can show it.
 *
 * Header popups hang off the right edge of their column, so under a narrow
 * column they reach past the left edge of the grid's scroll viewport and are
 * clipped. This measures the popup once it has mounted, and again whenever
 * anything scrolls or the window resizes, and slides it sideways just far
 * enough to fit. When it cannot fit at all, its left edge wins, since that is
 * where its fields start.
 *
 * The shift is written straight to the element's inline `transform`, which the
 * hook therefore owns: do not also set `transform` through the `style` prop.
 * Going through React state instead would leave a window, until the next
 * commit, in which the DOM does not yet show the shift a measurement assumes,
 * and a second measurement in that window (a StrictMode effect replay, two
 * scroll events) would double it.
 *
 * @param ref - The popup element. It must be mounted when the owning component
 *   mounts; the hook does not watch for it to appear later.
 */
export function useKeepInView(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    // What the DOM currently shows, so a measurement can undo it.
    let shift = 0;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      // Not laid out (hidden, or no layout engine): nothing to fit.
      if (rect.width === 0) return;

      const naturalLeft = rect.left - shift;
      const band = visibleBand(element);
      let next = 0;
      const overflowRight = naturalLeft + rect.width - (band.right - EDGE_GAP);
      if (overflowRight > 0) next = -overflowRight;
      const overflowLeft = band.left + EDGE_GAP - (naturalLeft + next);
      if (overflowLeft > 0) next += overflowLeft;

      if (next === shift) return;
      shift = next;
      element.style.transform = next === 0 ? '' : `translateX(${next}px)`;
    };

    measure();
    // Capture phase: scroll events do not bubble, and the one that matters is
    // the grid viewport's, not the window's.
    document.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      document.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      element.style.transform = '';
    };
  }, [ref]);
}
