import { memo } from 'react';
import type { ColumnDef, ColumnLayout, GridApi } from '../types';
import { formatValue, resolveValue } from '../core/values';
import { ALIGN_CLASS, GridCell, cellLayoutStyle } from './GridCell';
import { SELECTION_COLUMN_WIDTH } from './SelectionCell';

const NO_ERRORS: Record<string, string> = {};
const noop = () => undefined;

// Opaque, like every row background: the sticky cells paint it via bg-inherit.
const GROUP_BACKGROUND =
  'bg-gray-100 dark:bg-[color-mix(in_srgb,var(--color-white)_6%,var(--color-gray-900))]';

const CELL_BASE =
  'flex h-full items-center gap-1 border-r border-gray-200 px-2 text-xs ' +
  'text-gray-700 dark:border-gray-700 dark:text-gray-200';

export interface GroupRowProps<T, C> {
  row: T;
  groupKey: string;
  /** The group column's formatted value. */
  label: string;
  /** Header of the column grouped by, for the accessible name. */
  groupHeader: string;
  childCount: number | null;
  expanded: boolean;
  rowIndex: number;
  top: number;
  height: number;
  layout: ColumnLayout<T, C>;
  context: C;
  api: GridApi<T>;
  selectable: boolean;
  onToggle: (groupKey: string) => void;
}

/**
 * A group row. The first visible column carries the disclosure button, the
 * group's value and its count; columns with an `aggFunc` render the server's
 * aggregate through the column's own renderer; every other cell is blank.
 * Group rows are never selectable or editable.
 */
function GroupRowInner<T, C>({
  row,
  groupKey,
  label,
  groupHeader,
  childCount,
  expanded,
  rowIndex,
  top,
  height,
  layout,
  context,
  api,
  selectable,
  onToggle,
}: GroupRowProps<T, C>) {
  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 1}
      aria-expanded={expanded}
      aria-level={1}
      data-hxg-group={groupKey}
      className={`absolute left-0 flex cursor-pointer border-b border-gray-300 font-medium dark:border-gray-600 ${GROUP_BACKGROUND}`}
      style={{ top, height, width: layout.totalWidth + (selectable ? SELECTION_COLUMN_WIDTH : 0) }}
      onClick={() => onToggle(groupKey)}
    >
      {selectable && (
        <div
          className="sticky left-0 h-full border-r border-gray-200 bg-inherit dark:border-gray-700"
          style={{ width: SELECTION_COLUMN_WIDTH, minWidth: SELECTION_COLUMN_WIDTH, zIndex: 3 }}
        />
      )}

      {layout.items.map((item, index) => {
        const style = cellLayoutStyle(item);
        const pinnedBackground = item.pinned ? 'bg-inherit' : '';

        if (index === 0) {
          return (
            <div
              key={item.colId}
              role="gridcell"
              className={`${CELL_BASE} ${pinnedBackground}`}
              style={style}
              data-col-id={item.colId}
            >
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={`${expanded ? 'Collapse' : 'Expand'} ${groupHeader}: ${label}`}
                className="flex min-w-0 items-center gap-1 text-left"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggle(groupKey);
                }}
              >
                <span
                  aria-hidden
                  className={`inline-block w-3 shrink-0 text-gray-500 transition-transform dark:text-gray-400 ${
                    expanded ? 'rotate-90' : ''
                  }`}
                >
                  ▸
                </span>
                <span className="truncate" title={label}>
                  {label}
                </span>
                {childCount != null && (
                  <span className="shrink-0 font-normal text-gray-500 dark:text-gray-400">
                    ({childCount})
                  </span>
                )}
              </button>
            </div>
          );
        }

        if (item.column.aggFunc) {
          return (
            <GridCell
              key={item.colId}
              item={item}
              row={row}
              rowIndex={rowIndex}
              context={context}
              api={api}
              isRowEditing={false}
              draft={null}
              errors={NO_ERRORS}
              isFirstEditable={false}
              inheritRowBackground
              onFieldChange={noop}
              onCommit={noop}
              onCancel={noop}
            />
          );
        }

        return (
          <div
            key={item.colId}
            role="gridcell"
            className={`${CELL_BASE} ${ALIGN_CLASS[item.column.align ?? 'left']} ${pinnedBackground}`}
            style={style}
            data-col-id={item.colId}
          />
        );
      })}
    </div>
  );
}

export const GroupRow = memo(GroupRowInner) as typeof GroupRowInner;

export interface GroupStatusRowProps {
  groupKey: string;
  status: 'loading' | 'error' | 'more';
  loaded: number;
  total: number;
  error?: unknown;
  rowIndex: number;
  top: number;
  height: number;
  width: number;
  onLoadMore: (groupKey: string) => void;
}

/**
 * The line under an open group's rows: a loading note, an error with a retry,
 * or a button for the next block. Its content sticks to the left edge so it
 * stays in view when the grid is scrolled sideways.
 */
export function GroupStatusRow({
  groupKey,
  status,
  loaded,
  total,
  error,
  rowIndex,
  top,
  height,
  width,
  onLoadMore,
}: GroupStatusRowProps) {
  const button =
    'rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5';

  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 1}
      className="absolute left-0 flex border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      style={{ top, height, width }}
    >
      <div
        role="gridcell"
        className="sticky left-0 flex h-full items-center gap-2 pl-10 pr-2 text-xs text-gray-500 dark:text-gray-400"
      >
        {status === 'loading' && <span>Loading…</span>}
        {status === 'error' && (
          <>
            <span className="text-error-600 dark:text-error-400">
              {error instanceof Error ? error.message : 'Could not load these rows.'}
            </span>
            <button type="button" className={button} onClick={() => onLoadMore(groupKey)}>
              Retry
            </button>
          </>
        )}
        {status === 'more' && (
          <>
            <span>{total >= 0 ? `${loaded} of ${total} shown` : `${loaded} shown`}</span>
            <button type="button" className={button} onClick={() => onLoadMore(groupKey)}>
              Load more
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** The label a group row shows: its value through the column's formatter. */
export function groupLabel<T>(row: T, column: ColumnDef<T, never>): string {
  const formatted = formatValue(resolveValue(row, column), row, column);
  return formatted === '' ? '(blank)' : formatted;
}
