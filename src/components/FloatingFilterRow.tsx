import { useEffect, useState } from 'react';
import type { ColumnLayout, FilterModelMap, HxFilterModel } from '../types';
import { buildTextFilter, describeFilter } from '../core/filterModel';
import { SELECTION_COLUMN_WIDTH } from './SelectionCell';

export interface FloatingFilterRowProps<T, C> {
  layout: ColumnLayout<T, C>;
  filterModel: FilterModelMap;
  height: number;
  selectable: boolean;
  onFilterChange: (colId: string, filter: HxFilterModel | null) => void;
}

const CELL_INPUT_CLASS =
  'h-6 w-full rounded border border-gray-300 bg-white px-1.5 text-[11px] text-gray-800 ' +
  'outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

/**
 * A quick text box under each header. Free-text columns get a `contains`
 * filter; the richer types are read-only here and open the full popover from
 * the header, since a single input cannot express a range or a value set.
 */
function FloatingCell({
  colId,
  kind,
  filter,
  onFilterChange,
}: {
  colId: string;
  kind: 'text' | 'number' | 'date' | 'set';
  filter: HxFilterModel | undefined;
  onFilterChange: (colId: string, filter: HxFilterModel | null) => void;
}) {
  const isFreeText = kind === 'text';
  const [draft, setDraft] = useState(
    filter?.filterType === 'text' ? (filter.filter ?? '') : ''
  );

  // Keep in step when the model is changed elsewhere (popover, reset, restore).
  useEffect(() => {
    if (!isFreeText) return;
    setDraft(filter?.filterType === 'text' ? (filter.filter ?? '') : '');
  }, [filter, isFreeText]);

  if (!isFreeText) {
    const summary = filter ? describeFilter(filter) : '';
    return (
      <div
        className="flex h-6 items-center truncate rounded border border-dashed border-gray-300 px-1.5 text-[11px] text-gray-500 dark:border-gray-600 dark:text-gray-400"
        title={summary}
      >
        {summary || <span className="opacity-50">--</span>}
      </div>
    );
  }

  return (
    <input
      type="search"
      className={CELL_INPUT_CLASS}
      value={draft}
      aria-label={`Filter ${colId}`}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        onFilterChange(colId, buildTextFilter('contains', next));
      }}
    />
  );
}

export function FloatingFilterRow<T, C>({
  layout,
  filterModel,
  height,
  selectable,
  onFilterChange,
}: FloatingFilterRowProps<T, C>) {
  return (
    <div
      role="row"
      className="sticky z-10 flex border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60"
      style={{
        height,
        width: layout.totalWidth + (selectable ? SELECTION_COLUMN_WIDTH : 0),
      }}
    >
      {selectable && (
        <div
          className="sticky left-0 z-[3] h-full border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
          style={{ width: SELECTION_COLUMN_WIDTH, minWidth: SELECTION_COLUMN_WIDTH }}
        />
      )}

      {layout.items.map(({ column, width, pinned, stickyOffset }) => {
        const style: React.CSSProperties = {
          width,
          minWidth: width,
          maxWidth: width,
          ...(pinned === 'left'
            ? { position: 'sticky', left: stickyOffset, zIndex: 3 }
            : pinned === 'right'
              ? { position: 'sticky', right: stickyOffset, zIndex: 3 }
              : null),
        };

        const showInput =
          column.filter && !column.filterParams?.suppressFloatingFilter;

        return (
          <div
            key={column.colId}
            className={`flex h-full items-center border-r border-gray-200 px-1 dark:border-gray-700 ${
              pinned ? 'bg-gray-50 dark:bg-gray-800' : ''
            }`}
            style={style}
          >
            {showInput && column.filter && (
              <FloatingCell
                colId={column.colId}
                kind={column.filter}
                filter={filterModel[column.colId]}
                onFilterChange={onFilterChange}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
