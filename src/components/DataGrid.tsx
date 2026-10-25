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
  HxColumnVO,
  HxDataSource,
  HxFilterModel,
  RowCommitResult,
  SortModelItem,
} from '../types';
import { useColumnState } from '../core/useColumnState';
import { useEditModel } from '../core/useEditModel';
import { useGridState } from '../core/useGridState';
import { useRowGrouping } from '../core/useRowGrouping';
import { useSelectionModel, type RowId } from '../core/useSelectionModel';
import { fetchAllRows, useServerDataSource } from '../core/useServerDataSource';
import { useVirtualRows } from '../core/useVirtualRows';
import { copyToClipboard, downloadCsv, toCsv, toTsv } from '../core/exporters';
import { withFilter } from '../core/filterModel';
import { headerText } from '../core/values';
import { ColumnsPanel } from './ColumnsPanel';
import { FloatingFilterRow } from './FloatingFilterRow';
import { GridHeader } from './GridHeader';
import { GridOverlay } from './GridOverlay';
import { GridPagination } from './GridPagination';
import { GridRow } from './GridRow';
import { GroupRow, GroupStatusRow, groupLabel } from './GroupRow';
import { SELECTION_COLUMN_WIDTH } from './SelectionCell';

/**
 * Props for {@link DataGrid}.
 *
 * @typeParam T - The row type.
 * @typeParam C - The {@link DataGridProps.context | context} type. Inferred
 * from `context`; defaults to `unknown`.
 */
export interface DataGridProps<T, C = unknown> {
  /**
   * The columns to render.
   *
   * @remarks
   * Define these as a module constant or memoise on `[]` — anything volatile
   * belongs in {@link DataGridProps.context} instead.
   */
  columns: ColumnDef<T, C>[];
  /**
   * Where rows come from. Memoise it; a new identity causes a refetch.
   *
   * @see {@link HxDataSource}
   */
  dataSource: HxDataSource<T>;
  /**
   * Stable identity for a row, used for selection, editing and
   * {@link GridApi.updateRows}. Must be stable across refetches.
   */
  getRowId: (row: T) => RowId;

  /**
   * Volatile app state handed to every cell renderer.
   *
   * This is the escape hatch that keeps `columns` static: put in-flight ids,
   * permission checks and event handlers here, and changing them re-renders
   * cells without rebuilding a single column definition.
   */
  context?: C;

  /**
   * `localStorage` key for column layout, sort, filters and page size.
   *
   * Omit it and nothing is persisted. Stored under `hxg:<storageKey>`.
   *
   * @see {@link PersistedGridState}
   */
  storageKey?: string;

  /**
   * Row height in pixels. Fixed for every row — that is what keeps
   * virtualization O(1).
   * @defaultValue 36
   */
  rowHeight?: number;
  /**
   * Header height in pixels.
   * @defaultValue 36
   */
  headerHeight?: number;
  /**
   * Show the always-visible filter inputs under the header. Free-text columns
   * get a search box with a × button that clears that column's filter; other
   * filter kinds show a read-only summary and are edited from the header popover.
   * @defaultValue true
   */
  floatingFilter?: boolean;
  /**
   * Show the checkbox selection column.
   * @defaultValue true
   */
  selectable?: boolean;
  /**
   * Which rows may be selected. A row it returns `false` for keeps its
   * checkbox, greyed out and inert, and is skipped by shift-ranges, by the
   * header's select-all and by {@link GridApi.selectAll}.
   *
   * An id selected while its row was selectable stays selected if the row later
   * stops being so; call {@link GridApi.clearSelection} when that matters.
   * @defaultValue every row
   */
  isRowSelectable?: (row: T) => boolean;
  /**
   * Classes for one row's background, by its data -- e.g. to tint rows by
   * status. A non-empty result replaces the striping; the editing and selected
   * colours still win, and so does hover.
   *
   * The colour must be **opaque**: the sticky selection and pinned cells paint
   * the row's background, and a translucent one lets scrolled cells show
   * through. As with `cellClassName`, the classes must be ones your Tailwind
   * build can see.
   */
  getRowClassName?: (row: T) => string;

  /**
   * Rows per page before the user changes it. A persisted preference wins.
   * @defaultValue 20
   */
  defaultPageSize?: number;
  /**
   * Page sizes offered in the pager.
   * @defaultValue [10, 20, 50, 100]
   */
  pageSizeOptions?: number[];

  /**
   * Enables row editing. Called when the user commits a row.
   *
   * Return `{ ok: false, errors }` to keep the row open and paint each message
   * onto the cell whose column id it is keyed by.
   *
   * @param draft - The edited copy.
   * @param original - The row as it was before editing.
   * @see {@link RowCommitResult}
   */
  onRowCommit?: (draft: T, original: T) => Promise<RowCommitResult> | RowCommitResult;
  /**
   * Called whenever the selection changes.
   * @param ids - Every selected row id, including rows on other pages.
   */
  onSelectionChanged?: (ids: RowId[]) => void;
  /** Enables dropping files onto a row (e.g. to attach documents to it). */
  onRowFilesDropped?: (row: T, files: File[]) => void;
  /**
   * Called when a fetch or a commit throws. Aborted requests are not reported.
   */
  onError?: (error: unknown) => void;

  /**
   * Rendered into the toolbar strip above the header, left of the built-in
   * Columns and Export CSV buttons. The built-in Export CSV exports the
   * selection when there is one, otherwise every matching row, up to 1000;
   * see {@link GridApi.exportCsv}.
   *
   * @param api - The live imperative API.
   */
  toolbar?: (api: GridApi<T>) => ReactNode;

  /**
   * Shown when a query returns no rows.
   * @defaultValue 'No rows'
   */
  emptyMessage?: ReactNode;
  /**
   * Base file name for CSV export, without the extension.
   * @defaultValue 'export'
   */
  exportFileName?: string;
  /** Extra classes on the grid's outer frame. */
  className?: string;
  /**
   * Height of the whole grid. Any CSS length; a number is treated as pixels.
   * @defaultValue '70vh'
   */
  height?: number | string;

  /**
   * Receives the imperative {@link GridApi}. Accepts a ref object or a
   * callback ref.
   */
  apiRef?: Ref<GridApi<T>>;

  /**
   * The column id to group by, `null` for none — the controlled form. Leave it
   * `undefined` to let the grid own the grouping (see
   * {@link DataGridProps.defaultRowGroupColId}).
   *
   * Grouping is single-level and done by the server: the grid asks for group
   * rows, then for one group's rows as it is opened. See {@link HxRowsRequest}
   * for both requests. A column id that is unknown or lacks
   * {@link ColumnDef.enableRowGroup} is treated as `null`. Controlled grouping
   * is not persisted.
   */
  rowGroupColId?: string | null;
  /**
   * The grouping before the user changes it, when uncontrolled. A grouping
   * persisted under {@link DataGridProps.storageKey} wins, including a
   * persisted "ungrouped".
   * @defaultValue null
   */
  defaultRowGroupColId?: string | null;
  /**
   * Called when the user groups or ungroups, from the header menu, the
   * "Grouped by" chip, or {@link GridApi.setRowGroup}.
   * @param colId - The new grouping column, or `null`.
   */
  onRowGroupColIdChange?: (colId: string | null) => void;
  /**
   * Reads how many rows a group row stands for, shown beside its value.
   * Return `null` to show no count.
   * @defaultValue the group row's numeric `childCount` field
   */
  getGroupChildCount?: (groupRow: T) => number | null | undefined;
  /**
   * Rows fetched each time a group is opened or its "Load more" is used.
   * @defaultValue 100
   */
  groupChildBlockSize?: number;
}

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

/**
 * A virtualized, server-driven data grid.
 *
 * Paging, sorting and filtering are all resolved by your
 * {@link HxDataSource | data source} — the grid holds one page at a time and
 * never filters or sorts locally. Rows are windowed at a fixed height, so the
 * DOM stays small regardless of the result set.
 *
 * @typeParam T - The row type.
 * @typeParam C - The context type, inferred from the `context` prop.
 *
 * @example Minimal usage
 * ```tsx
 * const columns: ColumnDef<Person>[] = [
 *   { field: 'name',  header: 'Name', flex: 1, filter: 'text' },
 *   { field: 'email', header: 'Email', flex: 1 },
 * ];
 *
 * function People() {
 *   const dataSource = useMemo(
 *     () => ({ getRows: (request, signal) => api.list(request, signal) }),
 *     []
 *   );
 *
 *   return (
 *     <DataGrid
 *       columns={columns}
 *       dataSource={dataSource}
 *       getRowId={(row) => row.id}
 *     />
 *   );
 * }
 * ```
 *
 * @example With editing, persistence and the imperative API
 * ```tsx
 * const apiRef = useRef<GridApi<Person>>(null);
 *
 * <DataGrid
 *   columns={columns}
 *   dataSource={dataSource}
 *   getRowId={(row) => row.id}
 *   storageKey="people"
 *   apiRef={apiRef}
 *   onRowCommit={async (draft) => {
 *     const result = await api.save(draft);
 *     return result.ok ? { ok: true } : { ok: false, errors: result.errors };
 *   }}
 *   toolbar={(api) => (
 *     <button onClick={() => api.refresh({ purge: true })}>Refresh</button>
 *   )}
 * />
 * ```
 *
 * @remarks
 * Styling is plain Tailwind utility classes — there is no stylesheet to import.
 * Tailwind skips `node_modules` when detecting content, so point it at the
 * shipped bundle explicitly:
 *
 * ```css
 * @import "tailwindcss";
 * @source "../node_modules/@helix-x/datagrid-ui/dist/index.js";
 * ```
 *
 * @see {@link DataGridProps} for every option.
 * @see {@link GridApi} for what `apiRef` and `toolbar` receive.
 */
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
  isRowSelectable,
  getRowClassName,
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
  rowGroupColId: controlledRowGroup,
  defaultRowGroupColId = null,
  onRowGroupColIdChange,
  getGroupChildCount,
  groupChildBlockSize,
}: DataGridProps<T, C>) {
  const persisted = useGridState(storageKey);

  const [ownRowGroup, setOwnRowGroup] = useState<string | null>(() =>
    persisted.initial?.rowGroup !== undefined
      ? persisted.initial.rowGroup
      : defaultRowGroupColId
  );

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
  const [isExporting, setIsExporting] = useState(false);
  // One export at a time: a new one cancels whatever is still fetching.
  const exportAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => exportAbortRef.current?.abort(), []);

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
  /* Grouping                                                               */
  /* ---------------------------------------------------------------------- */

  const requestedRowGroup =
    controlledRowGroup !== undefined ? controlledRowGroup : ownRowGroup;
  // A stale persisted id, or a column that does not allow it, means no grouping.
  const groupColumn = useMemo(
    () =>
      requestedRowGroup == null
        ? null
        : (columnState.allColumns.find(
            (column) => column.colId === requestedRowGroup && column.enableRowGroup
          ) ?? null),
    [requestedRowGroup, columnState.allColumns]
  );
  const rowGroupColId = groupColumn?.colId ?? null;

  const rowGroupCols = useMemo<HxColumnVO[]>(
    () =>
      groupColumn
        ? [
            {
              id: groupColumn.colId,
              displayName: headerText(groupColumn as never),
              field: groupColumn.field,
            },
          ]
        : [],
    [groupColumn]
  );
  const visibleColumns = columnState.visibleColumns;
  const valueCols = useMemo<HxColumnVO[]>(
    () =>
      groupColumn
        ? visibleColumns
            .filter((column) => column.aggFunc)
            .map((column) => ({
              id: column.colId,
              displayName: headerText(column as never),
              field: column.field,
              aggFunc: column.aggFunc,
            }))
        : [],
    [groupColumn, visibleColumns]
  );

  /* ---------------------------------------------------------------------- */
  /* Data                                                                   */
  /* ---------------------------------------------------------------------- */

  const {
    rows: loadedRows,
    totalRows,
    isLoading,
    isStale,
    error,
    refresh,
    patchRows,
  } = useServerDataSource<T>({
    dataSource,
    pageSize,
    page,
    sortModel,
    filterModel,
    rowGroupCols,
    valueCols,
    onError,
  });

  // Rows fetched ungrouped must never be drawn as group rows, or the reverse:
  // until the first response for a new grouping lands, show nothing.
  const loadedGroupRef = useRef(rowGroupColId);
  if (!isStale) loadedGroupRef.current = rowGroupColId;
  const rows = loadedGroupRef.current === rowGroupColId ? loadedRows : [];

  const grouping = useRowGrouping<T>({
    dataSource,
    rows,
    groupColumn: groupColumn as never,
    rowGroupCols,
    valueCols,
    sortModel,
    filterModel,
    blockSize: groupChildBlockSize,
    getGroupChildCount,
    onError,
  });
  const { displayRows, leafRows } = grouping;

  // A page that no longer exists (filter narrowed the result set) would show an
  // empty grid forever, so walk back to the last real page.
  useEffect(() => {
    if (isLoading) return;
    // With an unknown total, an empty page past the first means we stepped
    // off the end: go back one.
    if (totalRows < 0) {
      if (rows.length === 0 && page > 0) setPage(page - 1);
      return;
    }
    if (totalRows === 0) return;
    const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [totalRows, rows.length, pageSize, page, isLoading]);

  const virtual = useVirtualRows({ rowCount: displayRows.length, rowHeight });

  // Held in a ref so the ResizeObserver effect does not depend on the hook's
  // identity and re-subscribe on every render.
  const setViewportHeightRef = useRef(virtual.setViewportHeight);
  setViewportHeightRef.current = virtual.setViewportHeight;

  /* ---------------------------------------------------------------------- */
  /* Selection and editing                                                  */
  /* ---------------------------------------------------------------------- */

  const selection = useSelectionModel<T>(
    leafRows,
    getRowId,
    onSelectionChanged,
    isRowSelectable
  );

  const noopCommit = useCallback((): RowCommitResult => ({ ok: true }), []);
  // The server's canonical copy from a successful commit replaces the row in
  // place, through the same path as api.updateRows.
  const patchGroupRows = grouping.patchRows;
  const patchAllRows = useCallback(
    (updated: T[], getId: (row: T) => RowId) => {
      patchRows(updated, getId);
      patchGroupRows(updated, getId);
    },
    [patchRows, patchGroupRows]
  );
  const onRowSaved = useCallback(
    (row: T) => patchAllRows([row], latest.current.getRowId),
    [patchAllRows]
  );
  const editing = useEditModel<T>(onRowCommit ?? noopCommit, onRowSaved);

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

  // The header only sees visible columns, laid out in pinned bands, so its
  // positions are not indices into the full order. Resolve the drop target's
  // own position instead.
  const { moveColumn } = columnState;
  const columnOrder = columnState.state.order;
  const onHeaderMove = useCallback(
    (colId: string, targetColId: string) => {
      const toIndex = columnOrder.indexOf(targetColId);
      if (toIndex !== -1) moveColumn(colId, toIndex);
    },
    [columnOrder, moveColumn]
  );

  const onFilterChange = useCallback(
    (colId: string, filter: HxFilterModel | null) => {
      applyFilters(withFilter(filterModel, colId, filter));
    },
    [filterModel, applyFilters]
  );

  const applyRowGroup = useCallback(
    (next: string | null) => {
      const column =
        next == null
          ? null
          : latest.current.columnState.allColumns.find((c) => c.colId === next);
      if (next != null && !column?.enableRowGroup) return;
      if (controlledRowGroup === undefined) {
        setOwnRowGroup(next);
        persisted.saveRowGroup(next);
      }
      setPage(0);
      onRowGroupColIdChange?.(next);
    },
    [controlledRowGroup, persisted, onRowGroupColIdChange]
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
    rows: leafRows,
    rowGroupColId,
    selection,
    columnState,
    filterModel,
    sortModel,
    editing,
    getRowId,
    dataSource,
    onError,
  });
  latest.current = {
    rows: leafRows,
    rowGroupColId,
    selection,
    columnState,
    filterModel,
    sortModel,
    editing,
    getRowId,
    dataSource,
    onError,
  };

  const resetGroups = grouping.reset;
  const api = useMemo<GridApi<T>>(
    () => ({
      refresh: (options) => {
        resetGroups();
        refresh(options);
      },
      getDisplayedRows: () => latest.current.rows,
      getSelectedRows: () => latest.current.selection.getSelectedRows(),
      getSelectedIds: () => [...latest.current.selection.selectedIds],
      clearSelection: () => latest.current.selection.clear(),
      selectAll: () => latest.current.selection.selectAllVisible(),
      exportCsv: async (options?: ExportCsvOptions) => {
        const scope = options?.scope ?? (options?.onlySelected ? 'selected' : 'all');
        // Snapshot now, so the file matches what was on screen when asked.
        const { sortModel, filterModel, selection, getRowId, columnState } =
          latest.current;
        const columns = columnState.visibleColumns;

        let source: T[];
        if (scope === 'page') {
          source = latest.current.rows;
        } else {
          exportAbortRef.current?.abort();
          const controller = new AbortController();
          exportAbortRef.current = controller;
          const selectedIds = new Set(selection.selectedIds);
          try {
            const fetched = await fetchAllRows(latest.current.dataSource, {
              sortModel,
              filterModel,
              maxRows: options?.maxRows,
              chunkSize: options?.chunkSize,
              signal: controller.signal,
            });
            source =
              scope === 'selected'
                ? fetched.filter((row) => selectedIds.has(getRowId(row)))
                : fetched;
          } finally {
            if (exportAbortRef.current === controller) exportAbortRef.current = null;
          }
        }

        const csv = toCsv(source, columns as never, options?.separator ?? ',');
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
      updateRows: (updated) => patchAllRows(updated, latest.current.getRowId),
      startEditing: (rowId) => {
        const row = latest.current.rows.find(
          (candidate) => latest.current.getRowId(candidate) === rowId
        );
        if (row) latest.current.editing.start(rowId, row);
      },
      stopEditing: () => latest.current.editing.cancel(),
      getRowGroup: () => latest.current.rowGroupColId,
      setRowGroup: applyRowGroup,
    }),
    [
      refresh,
      resetGroups,
      applyFilters,
      applySort,
      applyRowGroup,
      patchAllRows,
      persisted,
      exportFileName,
    ]
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
  const visibleRows = displayRows.slice(startIndex, endIndex);
  const rowWidth = columnState.layout.totalWidth + (selectable ? SELECTION_COLUMN_WIDTH : 0);

  // The built-in button: the selection when there is one, else every
  // matching row. Failures go to onError rather than out of a click handler.
  const onExportClick = useCallback(async () => {
    setIsExporting(true);
    try {
      await api.exportCsv({
        scope: latest.current.selection.selectedIds.size > 0 ? 'selected' : 'all',
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        latest.current.onError?.(error);
      }
    } finally {
      setIsExporting(false);
    }
  }, [api]);

  const showEmpty = !isLoading && !error && rows.length === 0;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800/60">
          {toolbar?.(api)}
          {groupColumn && (
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-25 py-0.5 pl-2 pr-1 text-xs text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
              Grouped by <strong className="font-semibold">{headerText(groupColumn as never)}</strong>
              <button
                type="button"
                aria-label="Remove grouping"
                className="rounded-full px-1 leading-none hover:bg-brand-100 dark:hover:bg-brand-500/20"
                onClick={() => applyRowGroup(null)}
              >
                ×
              </button>
            </span>
          )}
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
              className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:cursor-wait disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5"
              disabled={isExporting}
              onClick={onExportClick}
            >
              {isExporting ? 'Exporting…' : 'Export CSV'}
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
            selectAllDisabled={selection.noneSelectable}
            onToggleAll={selection.toggleAllVisible}
            onSort={onSort}
            onFilterChange={onFilterChange}
            onResize={columnState.setWidth}
            onMove={onHeaderMove}
            onPin={columnState.setPinned}
            rowGroupColId={rowGroupColId}
            onRowGroup={applyRowGroup}
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
              width: rowWidth,
            }}
          >
            {visibleRows.map((line, offset) => {
              const rowIndex = startIndex + offset;

              if (line.kind === 'group') {
                return (
                  <GroupRow
                    key={`hxg-group:${line.groupKey}`}
                    row={line.row}
                    groupKey={line.groupKey}
                    label={groupLabel(line.row, groupColumn as never)}
                    groupHeader={headerText(groupColumn as never)}
                    childCount={line.childCount}
                    expanded={line.expanded}
                    rowIndex={rowIndex}
                    top={rowIndex * rowHeight}
                    height={rowHeight}
                    layout={columnState.layout}
                    context={cellContext}
                    api={api}
                    selectable={selectable}
                    onToggle={grouping.toggleGroup}
                  />
                );
              }

              if (line.kind === 'status') {
                return (
                  <GroupStatusRow
                    key={`hxg-status:${line.groupKey}`}
                    groupKey={line.groupKey}
                    status={line.status}
                    loaded={line.loaded}
                    total={line.total}
                    error={line.error}
                    rowIndex={rowIndex}
                    top={rowIndex * rowHeight}
                    height={rowHeight}
                    width={rowWidth}
                    onLoadMore={grouping.loadMore}
                  />
                );
              }

              const { row } = line;
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
                    selectionIndex={line.leafIndex}
                    top={rowIndex * rowHeight}
                    height={rowHeight}
                    layout={columnState.layout}
                    context={cellContext}
                    api={api}
                    selectable={selectable}
                    isSelected={selection.isSelected(rowId)}
                    isSelectable={isRowSelectable ? isRowSelectable(row) : true}
                    rowClassName={getRowClassName?.(row)}
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
        pageRowCount={rows.length}
        pageSizeOptions={pageSizeOptions}
        isLoading={isLoading}
        onPageChange={setPage}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
