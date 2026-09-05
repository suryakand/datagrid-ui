import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import type {
  ColumnDef,
  ExportCsvOptions,
  FilterModelMap,
  GridApi,
  HxDataSource,
  HxFilterModel,
  RowCommitResult,
  SortModelItem,
} from '../types';
import { useColumnState } from '../core/useColumnState';
import { useEditModel } from '../core/useEditModel';
import { useGridState } from '../core/useGridState';
import { useSelectionModel, type RowId } from '../core/useSelectionModel';
import { useServerDataSource } from '../core/useServerDataSource';
import { useVirtualRows } from '../core/useVirtualRows';
import { copyToClipboard, downloadCsv, toCsv, toTsv } from '../core/exporters';
import { withFilter } from '../core/filterModel';
import { ColumnsPanel } from './ColumnsPanel';
import { FloatingFilterRow } from './FloatingFilterRow';
import { GridHeader } from './GridHeader';
import { GridOverlay } from './GridOverlay';
import { GridPagination } from './GridPagination';
import { GridRow } from './GridRow';

export interface DataGridProps<T, C = unknown> {
  columns: ColumnDef<T, C>[];
  dataSource: HxDataSource<T>;
  getRowId: (row: T) => RowId;

  /** Volatile app state handed to every cell renderer. */
  context?: C;

  /** localStorage key for column/sort/filter/page-size preferences. */
  storageKey?: string;

  rowHeight?: number;
  headerHeight?: number;
  /** Show the always-visible filter inputs under the header. */
  floatingFilter?: boolean;
  selectable?: boolean;

  defaultPageSize?: number;
  pageSizeOptions?: number[];

  /** Enables row editing. Return `{ ok:false, errors }` to keep the row open. */
  onRowCommit?: (draft: T, original: T) => Promise<RowCommitResult> | RowCommitResult;
  onSelectionChanged?: (ids: RowId[]) => void;
  /** Enables dropping files onto a row (e.g. to attach documents to it). */
  onRowFilesDropped?: (row: T, files: File[]) => void;
  onError?: (error: unknown) => void;

  /** Rendered above the header; receives the live api. */
  toolbar?: (api: GridApi<T>) => ReactNode;

  emptyMessage?: ReactNode;
  exportFileName?: string;
  className?: string;
  /** Height of the scrolling area. Defaults to `70vh`. */
  height?: number | string;

  apiRef?: Ref<GridApi<T>>;
}

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

export function DataGrid<T, C = unknown>({
  columns,
  dataSource,
  getRowId,
  context,
  storageKey,
  rowHeight = 36,
  headerHeight = 36,
  floatingFilter = true,
  selectable = true,
  defaultPageSize = 20,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  onRowCommit,
  onSelectionChanged,
  onRowFilesDropped,
  onError,
  toolbar,
  emptyMessage,
  exportFileName = 'export',
  className = '',
  height = '70vh',
  apiRef,
}: DataGridProps<T, C>) {
  const persisted = useGridState(storageKey);

  const [sortModel, setSortModel] = useState<SortModelItem[]>(
    () => persisted.initial?.sort ?? []
  );
  const [filterModel, setFilterModel] = useState<FilterModelMap>(
    () => persisted.initial?.filters ?? {}
  );
  const [pageSize, setPageSize] = useState(
    () => persisted.initial?.pagination.pageSize ?? defaultPageSize
  );
  const [page, setPage] = useState(0);
  const [showColumnsPanel, setShowColumnsPanel] = useState(false);

  /* ---------------------------------------------------------------------- */
  /* Measurement                                                            */
  /* ---------------------------------------------------------------------- */

  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const floatingFilterHeight = floatingFilter ? 28 : 0;

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setViewportWidth(rect.width);
      setViewportHeightRef.current(
        Math.max(0, rect.height - headerHeight - floatingFilterHeight)
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [headerHeight, floatingFilterHeight]);

  /* ---------------------------------------------------------------------- */
  /* Columns                                                                */
  /* ---------------------------------------------------------------------- */

  const columnState = useColumnState<T, C>(
    columns,
    persisted.initial?.columns,
    persisted.saveColumns,
    viewportWidth - (selectable ? 40 : 0)
  );

  /* ---------------------------------------------------------------------- */
  /* Data                                                                   */
  /* ---------------------------------------------------------------------- */

  const { rows, totalRows, isLoading, error, refresh, patchRows } = useServerDataSource<T>(
    { dataSource, pageSize, page, sortModel, filterModel, onError }
  );

  // A page that no longer exists (filter narrowed the result set) would show an
  // empty grid forever, so walk back to the last real page.
  useEffect(() => {
    if (isLoading || totalRows === 0) return;
    const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [totalRows, pageSize, page, isLoading]);

  const virtual = useVirtualRows({ rowCount: rows.length, rowHeight });

  // Held in a ref so the ResizeObserver effect does not depend on the hook's
  // identity and re-subscribe on every render.
  const setViewportHeightRef = useRef(virtual.setViewportHeight);
  setViewportHeightRef.current = virtual.setViewportHeight;

  /* ---------------------------------------------------------------------- */
  /* Selection and editing                                                  */
  /* ---------------------------------------------------------------------- */

  const selection = useSelectionModel<T>(rows, getRowId, onSelectionChanged);

  const noopCommit = useCallback((): RowCommitResult => ({ ok: true }), []);
  const editing = useEditModel<T>(onRowCommit ?? noopCommit);

  /* ---------------------------------------------------------------------- */
  /* Query mutations                                                        */
  /* ---------------------------------------------------------------------- */

  // Any change to the query resets to the first page: staying on page 7 of a
  // freshly filtered result is never what the user meant.
  const applySort = useCallback(
    (next: SortModelItem[]) => {
      setSortModel(next);
      persisted.saveSort(next);
      setPage(0);
    },
    [persisted]
  );

  const applyFilters = useCallback(
    (next: FilterModelMap) => {
      setFilterModel(next);
      persisted.saveFilters(next);
      setPage(0);
    },
    [persisted]
  );

  const onSort = useCallback(
    (colId: string, additive: boolean) => {
      const existing = sortModel.find((entry) => entry.colId === colId);
      const others = sortModel.filter((entry) => entry.colId !== colId);

      // asc -> desc -> off
      const next: SortModelItem[] = !existing
        ? [...(additive ? sortModel : []), { colId, sort: 'asc' }]
        : existing.sort === 'asc'
          ? [...(additive ? others : []), { colId, sort: 'desc' }]
          : additive
            ? others
            : [];

      applySort(next);
    },
    [sortModel, applySort]
  );

  const onFilterChange = useCallback(
    (colId: string, filter: HxFilterModel | null) => {
      applyFilters(withFilter(filterModel, colId, filter));
    },
    [filterModel, applyFilters]
  );

  const onPageSizeChange = useCallback(
    (next: number) => {
      setPageSize(next);
      persisted.savePageSize(next);
      setPage(0);
    },
    [persisted]
  );

  /* ---------------------------------------------------------------------- */
  /* Imperative API                                                         */
  /* ---------------------------------------------------------------------- */

  // Latest-value refs keep the api object stable, so passing it into memoised
  // cells never invalidates them.
  const latest = useRef({
    rows,
    selection,
    columnState,
    filterModel,
    sortModel,
    editing,
    getRowId,
  });
  latest.current = {
    rows,
    selection,
    columnState,
    filterModel,
    sortModel,
    editing,
    getRowId,
  };

  const api = useMemo<GridApi<T>>(
    () => ({
      refresh: (options) => refresh(options),
      getDisplayedRows: () => latest.current.rows,
      getSelectedRows: () => latest.current.selection.getSelectedRows(),
      getSelectedIds: () => [...latest.current.selection.selectedIds],
      clearSelection: () => latest.current.selection.clear(),
      selectAll: () => latest.current.selection.selectAllVisible(),
      exportCsv: (options?: ExportCsvOptions) => {
        const source = options?.onlySelected
          ? latest.current.selection.getSelectedRows()
          : latest.current.rows;
        const csv = toCsv(
          source,
          latest.current.columnState.visibleColumns as never,
          options?.separator ?? ','
        );
        downloadCsv(csv, options?.fileName ?? exportFileName);
      },
      copySelectionToClipboard: async () => {
        const selected = latest.current.selection.getSelectedRows();
        const source = selected.length > 0 ? selected : latest.current.rows;
        await copyToClipboard(
          toTsv(source, latest.current.columnState.visibleColumns as never)
        );
      },
      getFilterModel: () => latest.current.filterModel,
      setFilterModel: applyFilters,
      getSortModel: () => latest.current.sortModel,
      setSortModel: applySort,
      resetColumns: () => {
        latest.current.columnState.reset();
        persisted.clear();
      },
      updateRows: (updated) => patchRows(updated, latest.current.getRowId),
      startEditing: (rowId) => {
        const row = latest.current.rows.find(
          (candidate) => latest.current.getRowId(candidate) === rowId
        );
        if (row) latest.current.editing.start(rowId, row);
      },
      stopEditing: () => latest.current.editing.cancel(),
    }),
    [refresh, applyFilters, applySort, patchRows, persisted, exportFileName]
  );

  useImperativeHandle(apiRef, () => api, [api]);

  /* ---------------------------------------------------------------------- */
  /* Row interaction                                                        */
  /* ---------------------------------------------------------------------- */

  const onRowDoubleClick = useCallback(
    (rowId: RowId, row: T) => {
      if (onRowCommit) editing.start(rowId, row);
    },
    [onRowCommit, editing]
  );

  // Clicking away from a row being edited abandons it rather than trapping the
  // user in edit mode. Keyed on the row id so the listener is attached once per
  // edit session, not once per render.
  const editingRowId = editing.edit?.rowId ?? null;
  const cancelEditRef = useRef(editing.cancel);
  cancelEditRef.current = editing.cancel;

  useEffect(() => {
    if (editingRowId == null) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-hxg-editing-row="true"]')) cancelEditRef.current();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [editingRowId]);

  const emptyContext = useMemo(() => ({}) as C, []);
  const cellContext = context ?? emptyContext;

  const { startIndex, endIndex } = virtual.window;
  const visibleRows = rows.slice(startIndex, endIndex);

  const showEmpty = !isLoading && !error && rows.length === 0;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800/60">
          {toolbar?.(api)}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5"
              onClick={() => setShowColumnsPanel((current) => !current)}
            >
              Columns
            </button>
            <button
              type="button"
              className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5"
              onClick={() => api.exportCsv()}
            >
              Export CSV
            </button>
          </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {showColumnsPanel && (
          <ColumnsPanel
            columns={columnState.allColumns}
            isHidden={columnState.isHidden}
            onToggle={columnState.setHidden}
            onMove={columnState.moveColumn}
            onPin={columnState.setPinned}
            onReset={() => {
              columnState.reset();
              persisted.clear();
            }}
            onClose={() => setShowColumnsPanel(false)}
          />
        )}

        <div
          ref={viewportRef}
          role="grid"
          aria-rowcount={totalRows}
          aria-colcount={columnState.layout.items.length}
          aria-busy={isLoading}
          className="relative min-w-0 flex-1 overflow-auto"
          style={{ height }}
          onScroll={virtual.onScroll}
        >
          <GridHeader
            layout={columnState.layout}
            sortModel={sortModel}
            filterModel={filterModel}
            headerHeight={headerHeight}
            selectable={selectable}
            allSelected={selection.allVisibleSelected}
            someSelected={selection.someVisibleSelected}
            onToggleAll={selection.toggleAllVisible}
            onSort={onSort}
            onFilterChange={onFilterChange}
            onResize={columnState.setWidth}
            onMove={columnState.moveColumn}
            onPin={columnState.setPinned}
          />

          {floatingFilter && (
            <div style={{ top: headerHeight, position: 'sticky', zIndex: 9 }}>
              <FloatingFilterRow
                layout={columnState.layout}
                filterModel={filterModel}
                height={floatingFilterHeight}
                selectable={selectable}
                onFilterChange={onFilterChange}
              />
            </div>
          )}

          {/* Spacer carries the full scroll height; rows are positioned into it. */}
          <div
            className="relative"
            style={{
              height: virtual.totalHeight,
              width: columnState.layout.totalWidth + (selectable ? 40 : 0),
            }}
          >
            {visibleRows.map((row, offset) => {
              const rowIndex = startIndex + offset;
              const rowId = getRowId(row);
              const isRowEditing = editing.edit?.rowId === rowId;

              return (
                <div
                  key={rowId}
                  data-hxg-editing-row={isRowEditing ? 'true' : undefined}
                >
                  <GridRow
                    row={row}
                    rowId={rowId}
                    rowIndex={rowIndex}
                    top={rowIndex * rowHeight}
                    height={rowHeight}
                    layout={columnState.layout}
                    context={cellContext}
                    api={api}
                    selectable={selectable}
                    isSelected={selection.isSelected(rowId)}
                    isRowEditing={isRowEditing}
                    draft={isRowEditing ? (editing.edit?.draft ?? null) : null}
                    errors={isRowEditing ? (editing.edit?.errors ?? {}) : {}}
                    isSaving={isRowEditing && editing.edit?.isSaving === true}
                    onToggleSelect={selection.toggleRow}
                    onFieldChange={editing.setField}
                    onCommit={editing.commit}
                    onCancel={editing.cancel}
                    onRowDoubleClick={onRowDoubleClick}
                    onFilesDropped={onRowFilesDropped}
                  />
                </div>
              );
            })}
          </div>

          {isLoading && <GridOverlay kind="loading" />}
          {error != null && (
            <GridOverlay
              kind="error"
              message={error instanceof Error ? error.message : String(error)}
            />
          )}
          {showEmpty && <GridOverlay kind="empty" message={emptyMessage} />}
        </div>
      </div>

      {editing.edit && (
        <div className="flex items-center justify-end gap-2 border-t border-brand-200 bg-brand-25 px-2 py-1.5 dark:border-brand-500/30 dark:bg-brand-500/10">
          <span className="mr-auto text-xs text-gray-600 dark:text-gray-300">
            {editing.edit.errors.__row__ ??
              'Editing row — Enter to save, Escape to cancel.'}
          </span>
          <button
            type="button"
            className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200"
            onClick={editing.cancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-brand-500 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            disabled={editing.edit.isSaving}
            onClick={editing.commit}
          >
            {editing.edit.isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      <GridPagination
        page={page}
        pageSize={pageSize}
        totalRows={totalRows}
        pageSizeOptions={pageSizeOptions}
        isLoading={isLoading}
        onPageChange={setPage}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
