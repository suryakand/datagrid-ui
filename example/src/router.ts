import { useEffect, useState } from 'react';

/**
 * Hash routing, hand-rolled.
 *
 * A router dependency would be the largest thing in this example's
 * package.json and would teach nothing about the grid, so the six lines it
 * would have saved are written out instead.
 */
export function useHashRoute(fallback: string): string {
  const read = () => window.location.hash.replace(/^#\/?/, '') || fallback;
  const [route, setRoute] = useState(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback]);

  return route;
}

export function navigate(id: string) {
  window.location.hash = `/${id}`;
}
