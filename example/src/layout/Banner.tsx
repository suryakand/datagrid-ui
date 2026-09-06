import type { ReactNode } from 'react';

export function Banner({
  children,
  onDismiss,
}: {
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-25 px-3 py-1.5 text-xs text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
      {children}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-auto rounded px-1.5 hover:bg-black/5 dark:hover:bg-white/10"
        >
          ✕
        </button>
      )}
    </div>
  );
}
