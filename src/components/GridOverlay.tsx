import type { ReactNode } from 'react';

/** Props for {@link GridOverlay}. */
export interface GridOverlayProps {
  /** Which state to show. */
  kind: 'loading' | 'empty' | 'error';
  /** Message body. Falls back to a default per `kind`. */
  message?: ReactNode;
}

/**
 * The loading, empty and error states shown over the row area.
 *
 * Overlays rather than replaces, so the header and column widths stay put while
 * a refetch is in flight.
 *
 * @param props - Which state to show, and the message.
 */
export function GridOverlay({ kind, message }: GridOverlayProps) {
  if (kind === 'loading') {
    return (
      <div className="pointer-events-none absolute inset-0 z-[5] flex items-start justify-center bg-white/60 pt-10 dark:bg-gray-900/60">
        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-theme-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
          {message ?? 'Loading...'}
        </div>
      </div>
    );
  }

  if (kind === 'error') {
    return (
      <div className="absolute inset-0 z-[5] flex items-start justify-center bg-white/80 pt-10 dark:bg-gray-900/80">
        <div className="max-w-md rounded-md border border-error-300 bg-error-50 px-3 py-2 text-xs text-error-700 dark:border-error-700 dark:bg-error-500/10 dark:text-error-400">
          {message ?? 'Something went wrong loading this grid.'}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[5] flex items-start justify-center pt-10">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {message ?? 'No records found'}
      </p>
    </div>
  );
}
