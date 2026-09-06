import { useMemo, useState } from 'react';
import type { Pinned, ResolvedColumn } from '../types';
import { headerText } from '../core/values';

/**
 * Props for {@link ColumnsPanel}.
 *
 * @typeParam T - The row type.
 * @typeParam C - The context type.
 */
export interface ColumnsPanelProps<T, C> {
  /** Every column, including hidden ones. */
  columns: ResolvedColumn<T, C>[];
  /** Whether a column is currently hidden. */
  isHidden: (colId: string) => boolean;
  /** Show or hide one column. */
  onToggle: (colId: string, hidden: boolean) => void;
  /** Move a column to a new index. */
  onMove: (colId: string, toIndex: number) => void;
  /** Pin a column, or `undefined` to unpin. */
  onPin: (colId: string, pinned: Pinned | undefined) => void;
  /** Discard the user's layout. */
  onReset: () => void;
  /** Dismiss the panel. */
  onClose: () => void;
}

/**
 * The side panel for showing, hiding, reordering and pinning columns, with the
 * "reset my preferences" escape hatch.
 *
 * {@link DataGrid} renders this from its toolbar; exported for custom surfaces.
 */
export function ColumnsPanel<T, C>({
  columns,
  isHidden,
  onToggle,
  onMove,
  onPin,
  onReset,
  onClose,
}: ColumnsPanelProps<T, C>) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return columns;
    return columns.filter((column) =>
      headerText(column as never).toLowerCase().includes(needle)
    );
  }, [columns, search]);

  const visibleCount = columns.filter((c) => !isHidden(c.colId)).length;

  return (
    <div className="flex h-full w-60 shrink-0 flex-col gap-2 border-r border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
          Columns
        </h3>
        <button
          type="button"
          aria-label="Close columns panel"
          className="rounded px-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <input
        type="search"
        className="h-7 w-full rounded border border-gray-300 bg-white px-2 text-xs text-gray-800 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        placeholder="Search columns..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        {visibleCount} of {columns.length} shown
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.map((column) => {
          const hidden = isHidden(column.colId);
          const index = columns.findIndex((c) => c.colId === column.colId);

          return (
            <div
              key={column.colId}
              className="group flex items-center gap-1 rounded px-1 py-1 hover:bg-gray-100 dark:hover:bg-white/5"
              draggable
              onDragStart={(event) =>
                event.dataTransfer.setData('text/plain', column.colId)
              }
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const dragged = event.dataTransfer.getData('text/plain');
                if (dragged && dragged !== column.colId) onMove(dragged, index);
              }}
            >
              <span className="cursor-grab text-[10px] text-gray-400" aria-hidden>
                ⠿
              </span>

              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-brand-500"
                  checked={!hidden}
                  onChange={() => onToggle(column.colId, !hidden)}
                />
                <span className="truncate">{headerText(column as never)}</span>
              </label>

              <button
                type="button"
                className={`shrink-0 rounded px-1 text-[10px] ${
                  column.pinned
                    ? 'text-brand-500 dark:text-brand-400'
                    : 'text-gray-400 opacity-0 group-hover:opacity-100'
                }`}
                title={column.pinned ? `Unpin (${column.pinned})` : 'Pin left'}
                onClick={() =>
                  onPin(column.colId, column.pinned ? undefined : 'left')
                }
              >
                📌
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="rounded border border-error-300 px-2 py-1 text-xs font-medium text-error-600 hover:bg-error-50 dark:border-error-700 dark:text-error-400 dark:hover:bg-error-500/10"
        onClick={onReset}
      >
        Reset to defaults
      </button>
    </div>
  );
}
