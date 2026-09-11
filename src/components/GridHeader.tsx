import { useCallback, useRef, useState } from 'react';
import type {
  ColumnLayout,
  ColumnLayoutItem,
  FilterModelMap,
  HxFilterModel,
  Pinned,
  SortDirection,
  SortModelItem,
} from '../types';
import { describeFilter } from '../core/filterModel';
import { FilterPopover } from './FilterPopover';
import { SELECTION_COLUMN_WIDTH, SelectionCell } from './SelectionCell';
import { useKeepInView } from './useKeepInView';

export interface GridHeaderProps<T, C> {
  layout: ColumnLayout<T, C>;
  sortModel: SortModelItem[];
  filterModel: FilterModelMap;
  headerHeight: number;
  selectable: boolean;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onSort: (colId: string, additive: boolean) => void;
  onFilterChange: (colId: string, filter: HxFilterModel | null) => void;
  onResize: (colId: string, width: number) => void;
  onMove: (colId: string, toIndex: number) => void;
  onPin: (colId: string, pinned: Pinned | undefined) => void;
}

function SortIndicator({
  direction,
  index,
  showIndex,
}: {
  direction: SortDirection | undefined;
  index: number;
  showIndex: boolean;
}) {
  if (!direction) {
    return (
      <span className="opacity-0 transition-opacity group-hover:opacity-40" aria-hidden>
        ↑
      </span>
    );
  }
  return (
    <span className="flex items-center text-brand-500 dark:text-brand-400" aria-hidden>
      {direction === 'asc' ? '↑' : '↓'}
      {showIndex && <sub className="ml-0.5 text-[9px]">{index + 1}</sub>}
    </span>
  );
}

/** The ⋮ pin menu. Nudged into view like the filter popover. */
function ColumnMenu({
  pinned,
  onPin,
  onClose,
}: {
  pinned: Pinned | undefined;
  onPin: (pinned: Pinned | undefined) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useKeepInView(ref);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-30 mt-1 w-36 rounded-md border border-gray-200 bg-white py-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
      onMouseLeave={onClose}
    >
      {(['left', 'right'] as const).map((side) => (
        <button
          key={side}
          type="button"
          className="block w-full px-3 py-1 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5"
          onClick={() => {
            onPin(pinned === side ? undefined : side);
            onClose();
          }}
        >
          {pinned === side ? `Unpin ${side}` : `Pin ${side}`}
        </button>
      ))}
    </div>
  );
}

export function GridHeader<T, C>({
  layout,
  sortModel,
  filterModel,
  headerHeight,
  selectable,
  allSelected,
  someSelected,
  onToggleAll,
  onSort,
  onFilterChange,
  onResize,
  onMove,
  onPin,
}: GridHeaderProps<T, C>) {
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [dragColId, setDragColId] = useState<string | null>(null);

  // Resizing writes straight to the DOM-free state on each pointer move; the
  // pointer capture keeps the drag alive outside the header.
  const resizeRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(
    null
  );

  const startResize = useCallback(
    (event: React.PointerEvent, item: ColumnLayoutItem<T, C>) => {
      event.preventDefault();
      event.stopPropagation();
      resizeRef.current = {
        colId: item.colId,
        startX: event.clientX,
        startWidth: item.width,
      };
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    []
  );

  const onResizeMove = useCallback(
    (event: React.PointerEvent) => {
      const active = resizeRef.current;
      if (!active) return;
      const delta = event.clientX - active.startX;
      onResize(active.colId, Math.max(40, active.startWidth + delta));
    },
    [onResize]
  );

  const endResize = useCallback((event: React.PointerEvent) => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
  }, []);

  const sortIndexOf = (colId: string) =>
    sortModel.findIndex((entry) => entry.colId === colId);

  return (
    <div
      role="row"
      className="sticky top-0 z-10 flex border-b border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800"
      style={{
        height: headerHeight,
        width: layout.totalWidth + (selectable ? SELECTION_COLUMN_WIDTH : 0),
      }}
    >
      {selectable && (
        <SelectionCell
          isHeader
          checked={allSelected}
          indeterminate={someSelected}
          onToggle={onToggleAll}
          label="Select all rows on this page"
        />
      )}

      {layout.items.map((item, index) => {
        const { column, width, pinned, stickyOffset } = item;
        const sortIndex = sortIndexOf(column.colId);
        const direction = sortIndex === -1 ? undefined : sortModel[sortIndex].sort;
        const activeFilter = filterModel[column.colId];
        const filterKind = column.filter;

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

        return (
          <div
            key={column.colId}
            role="columnheader"
            aria-sort={
              direction === 'asc'
                ? 'ascending'
                : direction === 'desc'
                  ? 'descending'
                  : 'none'
            }
            aria-colindex={index + 1}
            className={`group relative flex h-full items-center border-r border-gray-300 bg-gray-100 px-2 dark:border-gray-600 dark:bg-gray-800 ${
              dragColId === column.colId ? 'opacity-40' : ''
            } ${column.headerClassName ?? ''}`}
            style={style}
            draggable={!column.lockPosition}
            onDragStart={(event) => {
              setDragColId(column.colId);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(event) => {
              if (dragColId && dragColId !== column.colId) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragColId && dragColId !== column.colId) onMove(dragColId, index);
              setDragColId(null);
            }}
            onDragEnd={() => setDragColId(null)}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
              disabled={!column.sortable}
              onClick={(event) => column.sortable && onSort(column.colId, event.shiftKey)}
              title={column.sortable ? 'Sort (shift-click to add)' : undefined}
            >
              <span className="truncate">{column.header}</span>
              {column.sortable && (
                <SortIndicator
                  direction={direction}
                  index={sortIndex}
                  showIndex={sortModel.length > 1}
                />
              )}
            </button>

            {filterKind && (
              <button
                type="button"
                aria-label={`Filter ${column.colId}`}
                className={`ml-1 shrink-0 rounded px-1 text-[10px] leading-none ${
                  activeFilter
                    ? 'text-brand-500 dark:text-brand-400'
                    : 'text-gray-400 opacity-0 group-hover:opacity-100'
                }`}
                title={activeFilter ? describeFilter(activeFilter) : 'Filter'}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenMenu(null);
                  setOpenFilter((current) =>
                    current === column.colId ? null : column.colId
                  );
                }}
              >
                ▼
              </button>
            )}

            <button
              type="button"
              aria-label={`Options for ${column.colId}`}
              className="ml-0.5 shrink-0 rounded px-1 text-[10px] leading-none text-gray-400 opacity-0 group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                setOpenFilter(null);
                setOpenMenu((current) => (current === column.colId ? null : column.colId));
              }}
            >
              ⋮
            </button>

            {openFilter === column.colId && filterKind && (
              <FilterPopover
                kind={filterKind}
                value={activeFilter}
                setValues={column.filterParams?.values}
                onApply={(filter) => {
                  onFilterChange(column.colId, filter);
                  setOpenFilter(null);
                }}
                onClose={() => setOpenFilter(null)}
              />
            )}

            {openMenu === column.colId && (
              <ColumnMenu
                pinned={pinned}
                onPin={(side) => onPin(column.colId, side)}
                onClose={() => setOpenMenu(null)}
              />
            )}

            {column.resizable && (
              <div
                role="separator"
                aria-orientation="vertical"
                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-brand-400"
                onPointerDown={(event) => startResize(event, item)}
                onPointerMove={onResizeMove}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                onClick={(event) => event.stopPropagation()}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
