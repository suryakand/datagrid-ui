/**
 * Every public type in `@helix-x/datagrid-ui`.
 *
 * The filter, sort and row-request shapes deliberately mirror what ag-grid's
 * server-side row model posts, so a backend written for that model accepts this
 * grid's requests unchanged.
 */

import type { ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/* Filter models                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Comparison operators available on a `text` column filter.
 *
 * `blank` and `notBlank` take no operand — see {@link isUnaryFilter}.
 *
 * @see {@link TEXT_FILTER_TYPES} for the same list as a runtime array.
 */
export type TextFilterType =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEqual'
  | 'startsWith'
  | 'endsWith'
  | 'blank'
  | 'notBlank';

/**
 * Comparison operators available on a `number` column filter.
 *
 * `inRange` uses both `filter` and `filterTo`; `blank` and `notBlank` take no
 * operand at all.
 *
 * @see {@link NUMBER_FILTER_TYPES} for the same list as a runtime array.
 */
export type NumberFilterType =
  | 'equals'
  | 'notEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'inRange'
  | 'blank'
  | 'notBlank';

/**
 * Comparison operators available on a `date` column filter.
 *
 * `inRange` uses both `dateFrom` and `dateTo`; `blank` and `notBlank` take no
 * operand.
 *
 * @see {@link DATE_FILTER_TYPES} for the same list as a runtime array.
 */
export type DateFilterType =
  | 'equals'
  | 'notEqual'
  | 'before'
  | 'after'
  | 'inRange'
  | 'blank'
  | 'notBlank';

/**
 * A text filter as sent to the server.
 *
 * @example
 * ```ts
 * const model: TextFilterModel = {
 *   filterType: 'text',
 *   type: 'contains',
 *   filter: 'acme',
 * };
 * ```
 */
export interface TextFilterModel {
  /** Discriminant. Always `'text'`. */
  filterType: 'text';
  /** The comparison to apply. */
  type: TextFilterType;
  /** The search term. Absent for `blank` and `notBlank`. */
  filter?: string;
}

/**
 * A numeric filter as sent to the server.
 *
 * @example Between two values
 * ```ts
 * const model: NumberFilterModel = {
 *   filterType: 'number',
 *   type: 'inRange',
 *   filter: 10,
 *   filterTo: 100,
 * };
 * ```
 */
export interface NumberFilterModel {
  /** Discriminant. Always `'number'`. */
  filterType: 'number';
  /** The comparison to apply. */
  type: NumberFilterType;
  /** The operand, or the lower bound when `type` is `'inRange'`. */
  filter?: number;
  /** The upper bound. Only meaningful when `type` is `'inRange'`. */
  filterTo?: number;
}

/**
 * A date filter as sent to the server.
 *
 * Dates are calendar days, not instants — compare on the day, or a same-day
 * timestamp will never match its own date.
 *
 * @example
 * ```ts
 * const model: DateFilterModel = {
 *   filterType: 'date',
 *   type: 'after',
 *   dateFrom: '2026-01-01',
 * };
 * ```
 */
export interface DateFilterModel {
  /** Discriminant. Always `'date'`. */
  filterType: 'date';
  /** The comparison to apply. */
  type: DateFilterType;
  /** Lower bound, formatted `YYYY-MM-DD`. */
  dateFrom?: string;
  /** Upper bound, formatted `YYYY-MM-DD`. Only used by `'inRange'`. */
  dateTo?: string;
}

/**
 * A set (multi-select) filter as sent to the server.
 *
 * An empty `values` array means "no constraint" — that is how the grid clears
 * a set filter. {@link buildSetFilter} returns `null` rather than an empty set.
 *
 * @example
 * ```ts
 * const model: SetFilterModel = {
 *   filterType: 'set',
 *   values: ['ACTIVE', 'PENDING'],
 * };
 * ```
 */
export interface SetFilterModel {
  /** Discriminant. Always `'set'`. */
  filterType: 'set';
  /** The selected values. Compared as strings. */
  values: string[];
}

/**
 * Any one column filter. Discriminate on `filterType`.
 *
 * @example
 * ```ts
 * function describe(filter: HxFilterModel) {
 *   switch (filter.filterType) {
 *     case 'text':   return filter.filter;
 *     case 'number': return filter.filter;
 *     case 'date':   return filter.dateFrom;
 *     case 'set':    return filter.values.join(', ');
 *   }
 * }
 * ```
 */
export type HxFilterModel =
  | TextFilterModel
  | NumberFilterModel
  | DateFilterModel
  | SetFilterModel;

/**
 * Every active filter, keyed by {@link ColumnDef.colId | column id}.
 *
 * A column with no entry is unfiltered. Use {@link withFilter} to add or remove
 * one immutably.
 */
export type FilterModelMap = Record<string, HxFilterModel>;

/**
 * Which filter UI a column offers, set via {@link ColumnDef.filter}.
 *
 * Pass `false` on the column instead to disable filtering entirely.
 */
export type FilterKind = 'text' | 'number' | 'date' | 'set';

/* -------------------------------------------------------------------------- */
/* Sorting                                                                    */
/* -------------------------------------------------------------------------- */

/** Sort direction for one column. */
export type SortDirection = 'asc' | 'desc';

/**
 * One entry in the sort model.
 *
 * The model is an ordered array: the first entry is the primary sort, and later
 * entries break ties in the ones before them.
 *
 * @example Sort by status, then by newest first
 * ```ts
 * const sortModel: SortModelItem[] = [
 *   { colId: 'status',    sort: 'asc'  },
 *   { colId: 'createdAt', sort: 'desc' },
 * ];
 * ```
 */
export interface SortModelItem {
  /** The {@link ColumnDef.colId | column id} to sort on. */
  colId: string;
  /** Direction to sort in. */
  sort: SortDirection;
}

/* -------------------------------------------------------------------------- */
/* Data source                                                                */
/* -------------------------------------------------------------------------- */

/**
 * What the grid asks the server for: one page, with the active sort and
 * filters.
 *
 * Structurally compatible with ag-grid's `IServerSideGetRowsRequest`, so an
 * endpoint written for that model accepts this verbatim. The grouping and pivot
 * fields are always sent empty — this grid does not implement them — but they
 * are present so servers that destructure them do not fall over.
 *
 * @example Handling the request on the server
 * ```ts
 * app.post('/api/rows', (req, res) => {
 *   const { startRow, endRow, sortModel, filterModel } = req.body;
 *   const filtered = applyFilters(allRows, filterModel);
 *   const sorted   = applySort(filtered, sortModel);
 *   res.json({ rows: sorted.slice(startRow, endRow), lastRow: filtered.length });
 * });
 * ```
 */
export interface HxRowsRequest {
  /** Zero-based index of the first row wanted, inclusive. */
  startRow: number;
  /** Index one past the last row wanted, exclusive. */
  endRow: number;
  /** Active sorts, primary first. Empty when unsorted. */
  sortModel: SortModelItem[];
  /** Active filters, keyed by column id. Empty when unfiltered. */
  filterModel: FilterModelMap;
  /** Always empty. Present only for ag-grid wire compatibility. */
  rowGroupCols: never[];
  /** Always empty. Present only for ag-grid wire compatibility. */
  valueCols: never[];
  /** Always empty. Present only for ag-grid wire compatibility. */
  pivotCols: never[];
  /** Always `false`. Present only for ag-grid wire compatibility. */
  pivotMode: false;
  /** Always empty. Present only for ag-grid wire compatibility. */
  groupKeys: never[];
}

/**
 * What the server returns for one {@link HxRowsRequest}.
 *
 * @typeParam T - The row type.
 */
export interface HxRowsResponse<T> {
  /** The rows for the requested page only, not the whole result set. */
  rows: T[];
  /**
   * Total row count across **all** pages — not `rows.length`. This is what
   * drives the pager. Return `-1` when the total is genuinely unknown.
   */
  lastRow: number;
}

/**
 * The grid's one required dependency: something that turns a request into rows.
 *
 * @typeParam T - The row type.
 *
 * @example
 * ```tsx
 * const dataSource: HxDataSource<Person> = {
 *   getRows: async (request, signal) => {
 *     const response = await fetch('/api/people', {
 *       method: 'POST',
 *       headers: { 'content-type': 'application/json' },
 *       body: JSON.stringify(request),
 *       signal,
 *     });
 *     return response.json();
 *   },
 * };
 * ```
 *
 * @remarks
 * Memoise the object (or define it outside the component). A new identity on
 * every render causes a refetch.
 */
export interface HxDataSource<T> {
  /**
   * Fetch one page of rows.
   *
   * @param request - The page, sort and filters being asked for.
   * @param signal - Aborts when the grid supersedes this request. Pass it to
   * `fetch` so a slow response for an old sort can never overwrite a newer one.
   * @returns The page of rows plus the total row count.
   */
  getRows(request: HxRowsRequest, signal: AbortSignal): Promise<HxRowsResponse<T>>;
}

/* -------------------------------------------------------------------------- */
/* Columns                                                                    */
/* -------------------------------------------------------------------------- */

/** Which edge a pinned column sticks to. */
export type Pinned = 'left' | 'right';

/**
 * What {@link ColumnDef.cellRenderer} receives.
 *
 * @typeParam T - The row type.
 * @typeParam C - The {@link DataGridProps.context | context} type.
 */
export interface CellRendererParams<T, C = unknown> {
  /** The whole row, for cells that need more than their own field. */
  row: T;
  /** Index within the currently loaded page, not the full result set. */
  rowIndex: number;
  /** The raw value, after {@link ColumnDef.valueGetter}. */
  value: unknown;
  /** The display string, after {@link ColumnDef.valueFormatter}. */
  formatted: string;
  /** The column being rendered. */
  column: ColumnDef<T, C>;
  /**
   * Arbitrary app state handed to every renderer. Put volatile things here
   * (in-flight ids, permission checks, handlers) so column definitions can stay
   * memoised on `[]` and never rebuild.
   */
  context: C;
  /** The live imperative API, for renderers that act on the grid. */
  api: GridApi<T>;
}

/**
 * What a cell editor receives — both the built-ins and your own.
 *
 * @typeParam T - The row type.
 * @typeParam C - The {@link DataGridProps.context | context} type.
 */
export interface EditorParams<T, C = unknown> {
  /** Current draft value for this cell. */
  value: unknown;
  /** The row being edited, as a draft copy. */
  row: T;
  /** The column being edited. */
  column: ColumnDef<T, C>;
  /** The grid's {@link DataGridProps.context | context}. */
  context: C;
  /** Writes into the row draft. Never hits the network. */
  onChange: (value: unknown) => void;
  /** Commit the whole row, invoking {@link DataGridProps.onRowCommit}. */
  onCommit: () => void;
  /** Abandon the edit and restore the original row. */
  onCancel: () => void;
  /** Server-supplied message for this field, if the last commit was rejected. */
  error?: string;
  /** True for the first editable cell in the row. */
  autoFocus?: boolean;
}

/**
 * A custom cell editor.
 *
 * @typeParam T - The row type.
 * @typeParam C - The context type.
 *
 * @example A trimming text editor
 * ```tsx
 * const TrimmedEditor: EditorComponent<Person> = ({ value, onChange, onCommit, onCancel }) => (
 *   <input
 *     autoFocus
 *     value={String(value ?? '')}
 *     onChange={(e) => onChange(e.target.value.trim())}
 *     onKeyDown={(e) => {
 *       if (e.key === 'Enter') onCommit();
 *       if (e.key === 'Escape') onCancel();
 *     }}
 *   />
 * );
 * ```
 */
export type EditorComponent<T, C = unknown> = (
  params: EditorParams<T, C>
) => ReactNode;

/**
 * Names of the editors that ship with the grid.
 *
 * @see {@link BUILTIN_EDITORS} for the components these map to.
 */
export type BuiltinEditor = 'text' | 'number' | 'select' | 'date' | 'checkbox';

/** One choice offered by the `select` editor. */
export interface SelectOption {
  /** Shown to the user. */
  label: string;
  /** Written into the row draft. */
  value: unknown;
}

/**
 * One column. This is the main thing you write when using the grid.
 *
 * @typeParam T - The row type.
 * @typeParam C - The {@link DataGridProps.context | context} type.
 *
 * @example A representative set of columns
 * ```tsx
 * const columns: ColumnDef<Person>[] = [
 *   { field: 'id',   header: 'ID', width: 90, filter: 'number' },
 *   { field: 'name', header: 'Name', flex: 1, filter: 'text', editable: true },
 *   {
 *     field: 'status',
 *     header: 'Status',
 *     filter: 'set',
 *     filterParams: { values: () => fetch('/api/statuses').then((r) => r.json()) },
 *     editable: true,
 *     editor: 'select',
 *     editorParams: { options: [{ label: 'Active', value: 'ACTIVE' }] },
 *   },
 *   {
 *     colId: 'fullName',
 *     header: 'Full name',
 *     sortable: false,
 *     valueGetter: (row) => `${row.first} ${row.last}`,
 *   },
 * ];
 * ```
 *
 * @remarks
 * Define columns as a module constant or memoise on `[]`. Anything volatile
 * belongs in {@link DataGridProps.context} instead, which reaches every
 * renderer without rebuilding a single definition.
 */
export interface ColumnDef<T, C = unknown> {
  /**
   * Stable identity, used as the key in the sort and filter models and in
   * persisted layout. Falls back to {@link ColumnDef.field | field} when
   * omitted; one of the two is required.
   */
  colId?: string;
  /**
   * Dotted path into the row (`'customer.name'`), and the key sent to the
   * server for sorting and filtering.
   *
   * Omit it for purely derived columns and supply `colId` plus
   * {@link ColumnDef.valueGetter | valueGetter} instead.
   */
  field?: string;
  /** Header content. Any node — an icon, a tooltip wrapper, anything. */
  header: ReactNode;
  /**
   * Plain-text header for exports and aria labels. Required in practice
   * whenever `header` is a node rather than a string.
   */
  headerName?: string;

  /**
   * Starting width in pixels.
   * @defaultValue 150
   */
  width?: number;
  /**
   * Floor for both `flex` and user resizing.
   * @defaultValue 60
   */
  minWidth?: number;
  /** Ceiling for user resizing. */
  maxWidth?: number;
  /**
   * Share of the leftover horizontal space, like `flex-grow`. A column with
   * `flex: 2` takes twice the slack of one with `flex: 1`.
   */
  flex?: number;

  /** Stick this column to an edge while the rest scroll horizontally. */
  pinned?: Pinned;
  /** Start hidden. The user can still reveal it from the columns panel. */
  hide?: boolean;
  /**
   * Allow click-to-sort on the header.
   * @defaultValue true
   */
  sortable?: boolean;
  /**
   * Allow drag-to-resize.
   * @defaultValue true
   */
  resizable?: boolean;
  /** Prevent the user dragging this column out of position. */
  lockPosition?: boolean;

  /**
   * Which filter UI to offer, or `false` for none.
   *
   * @defaultValue undefined (no filter)
   */
  filter?: FilterKind | false;
  /** Extra options for the filter named by {@link ColumnDef.filter}. */
  filterParams?: {
    /**
     * Options for a `set` filter: a static list, or a function called the first
     * time the popover opens so the list can come from an API.
     */
    values?: string[] | (() => Promise<string[]>);
    /** Hide the always-visible filter input under the header for this column. */
    suppressFloatingFilter?: boolean;
  };

  /**
   * Alternative flat keys to try when the server flattens nested fields — some
   * backends return `{"customer.name": x}` rather than a nested object, and
   * change the prefix when grouping is on.
   */
  fieldAliases?: string[];

  /**
   * Compute the cell value instead of reading `field`. Takes precedence over
   * every other lookup.
   */
  valueGetter?: (row: T) => unknown;
  /**
   * Turn the raw value into its display string. Also used for exports unless
   * {@link ColumnDef.exportValue} is given.
   */
  valueFormatter?: (value: unknown, row: T) => string;
  /**
   * Render the cell as markup. Presentation only — sorting and filtering still
   * use `field`, so a decorated cell keeps behaving like a plain one.
   */
  cellRenderer?: (params: CellRendererParams<T, C>) => ReactNode;

  /** Whether the cell can be edited, optionally per row. */
  editable?: boolean | ((row: T) => boolean);
  /**
   * Which editor to use: a {@link BuiltinEditor} name or your own component.
   * @defaultValue 'text'
   */
  editor?: BuiltinEditor | EditorComponent<T, C>;
  /** Extra options for the editor named by {@link ColumnDef.editor}. */
  editorParams?: {
    /** Choices for the `select` editor. */
    options?: SelectOption[];
    /** Placeholder for the `text` and `number` editors. */
    placeholder?: string;
  };

  /**
   * The flat string written to CSV and the clipboard. Supply this whenever
   * {@link ColumnDef.cellRenderer} produces markup.
   */
  exportValue?: (row: T) => string;
  /** Leave this column out of CSV and clipboard output entirely. */
  suppressExport?: boolean;

  /** Extra classes on every cell, optionally per row. */
  cellClassName?: string | ((row: T) => string);
  /** Extra classes on the header cell. */
  headerClassName?: string;
  /**
   * Horizontal alignment of the cell content.
   * @defaultValue 'left'
   */
  align?: 'left' | 'center' | 'right';
}

/**
 * A {@link ColumnDef} with every optional default filled in.
 *
 * Produced by {@link resolveColumn}. Mostly internal, but exported because the
 * exporter helpers and the columns panel take it.
 *
 * @typeParam T - The row type.
 * @typeParam C - The context type.
 */
export interface ResolvedColumn<T, C = unknown> extends ColumnDef<T, C> {
  /** Always present — `colId`, or `field` when `colId` was omitted. */
  colId: string;
  /** Resolved width, never below `minWidth`. */
  width: number;
  /** Resolved minimum width. */
  minWidth: number;
  /** Resolved sortability. */
  sortable: boolean;
  /** Resolved resizability. */
  resizable: boolean;
}

/**
 * Geometry for one visible column, computed once per layout change.
 *
 * @typeParam T - The row type.
 * @typeParam C - The context type.
 */
export interface ColumnLayoutItem<T, C = unknown> {
  /** The column this geometry belongs to. */
  column: ResolvedColumn<T, C>;
  /** Convenience copy of `column.colId`. */
  colId: string;
  /** Final pixel width, after `flex` distribution and user resizing. */
  width: number;
  /** Offset from the left edge of the full (unscrolled) column strip. */
  left: number;
  /** Which edge this column is pinned to, if any. */
  pinned?: Pinned;
  /** `left`/`right` offset to use for `position: sticky` on pinned columns. */
  stickyOffset: number;
}

/**
 * The measured layout of every visible column.
 *
 * @typeParam T - The row type.
 * @typeParam C - The context type.
 */
export interface ColumnLayout<T, C = unknown> {
  /** Visible columns in display order, each with its geometry. */
  items: ColumnLayoutItem<T, C>[];
  /** Combined width of all visible columns. */
  totalWidth: number;
  /** Combined width of the left-pinned columns. */
  leftPinnedWidth: number;
  /** Combined width of the right-pinned columns. */
  rightPinnedWidth: number;
}

/* -------------------------------------------------------------------------- */
/* Editing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The outcome of {@link DataGridProps.onRowCommit}.
 *
 * Returning `ok: false` keeps the row in edit mode and paints each message onto
 * the cell whose column id it is keyed by — which is how server-side validation
 * reaches the user without being mirrored in the client.
 *
 * @example
 * ```ts
 * async function onRowCommit(draft: Person): Promise<RowCommitResult> {
 *   const response = await fetch(`/api/people/${draft.id}`, {
 *     method: 'PATCH',
 *     body: JSON.stringify(draft),
 *   });
 *   if (response.status === 422) {
 *     const { errors, message } = await response.json();
 *     return { ok: false, errors, message };
 *   }
 *   return { ok: true, row: await response.json() };
 * }
 * ```
 */
export type RowCommitResult =
  | {
      /** Discriminant: the row was saved. */
      ok: true;
      /**
       * The server's canonical copy, which replaces the row in place. Useful
       * when the server fills in derived fields.
       */
      row?: unknown;
    }
  | {
      /** Discriminant: the row was rejected and stays open. */
      ok: false;
      /** Messages keyed by column id, painted onto the offending cells. */
      errors: Record<string, string>;
      /** A single message for the whole row. */
      message?: string;
    };

/* -------------------------------------------------------------------------- */
/* Persisted state                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Schema version for {@link PersistedGridState}.
 *
 * Saved state carrying a different version is discarded rather than migrated:
 * the layout is a convenience, and a bad restore is worse than starting from
 * the column defaults.
 */
export const GRID_STATE_VERSION = 1;

/**
 * What the grid writes to `localStorage` under
 * {@link DataGridProps.storageKey}.
 *
 * Stored under the key `hxg:<storageKey>`.
 */
export interface PersistedGridState {
  /** Schema version. Compared against {@link GRID_STATE_VERSION} on read. */
  v: number;
  /** Column layout the user arranged. */
  columns: {
    /** Column ids in display order. */
    order: string[];
    /** Ids of columns the user hid. */
    hidden: string[];
    /** User-resized widths, by column id. */
    widths: Record<string, number>;
    /** User-pinned columns, by column id. */
    pinned: Record<string, Pinned>;
  };
  /** The sort model at the time of saving. */
  sort: SortModelItem[];
  /** The filter model at the time of saving. */
  filters: FilterModelMap;
  /** Paging preferences. */
  pagination: {
    /** Rows per page the user chose. */
    pageSize: number;
  };
}

/* -------------------------------------------------------------------------- */
/* Imperative API                                                             */
/* -------------------------------------------------------------------------- */

/** Options for {@link GridApi.exportCsv}. */
export interface ExportCsvOptions {
  /**
   * Export only the selected rows rather than the whole loaded page.
   * @defaultValue false
   */
  onlySelected?: boolean;
  /**
   * File name, with or without the `.csv` suffix.
   * @defaultValue the grid's `exportFileName` prop
   */
  fileName?: string;
  /**
   * Field separator.
   * @defaultValue ','
   */
  separator?: string;
}

/**
 * The imperative handle onto a live grid.
 *
 * Reach it either through {@link DataGridProps.apiRef} or as
 * {@link DataGridProps.toolbar}'s argument.
 *
 * @typeParam T - The row type.
 *
 * @example
 * ```tsx
 * const apiRef = useRef<GridApi<Person>>(null);
 *
 * <DataGrid
 *   apiRef={apiRef}
 *   toolbar={(api) => (
 *     <button onClick={() => api.exportCsv({ onlySelected: true })}>
 *       Export selection
 *     </button>
 *   )}
 *   {...rest}
 * />
 * ```
 */
export interface GridApi<T> {
  /**
   * Re-fetch the current page.
   *
   * @param options - `purge: true` drops every cached block first, so nothing
   * stale can survive; otherwise cached neighbouring pages are kept.
   */
  refresh(options?: { purge?: boolean }): void;
  /** The rows currently loaded for this page, in display order. */
  getDisplayedRows(): T[];
  /** The selected rows that are on the current page. */
  getSelectedRows(): T[];
  /** Ids of every selected row, including those on other pages. */
  getSelectedIds(): Array<string | number>;
  /** Deselect everything. */
  clearSelection(): void;
  /** Select every row on the current page. */
  selectAll(): void;
  /** Download the rows as CSV, honouring each column's `exportValue`. */
  exportCsv(options?: ExportCsvOptions): void;
  /** Copy the selection to the clipboard as TSV, which spreadsheets expect. */
  copySelectionToClipboard(): Promise<void>;
  /** The active filters. */
  getFilterModel(): FilterModelMap;
  /** Replace every filter at once, triggering one refetch. */
  setFilterModel(model: FilterModelMap): void;
  /** The active sorts, primary first. */
  getSortModel(): SortModelItem[];
  /** Replace the sort model, triggering one refetch. */
  setSortModel(model: SortModelItem[]): void;
  /** Discard the user's column layout and return to the definitions' defaults. */
  resetColumns(): void;
  /**
   * Patch rows already on screen, matched by `getRowId`, without a round trip.
   *
   * Ids that are not on the current page are ignored, so a live feed can push
   * everything it has without the client filtering first. Scroll position,
   * selection, sort and any open editor are all preserved.
   *
   * @param rows - Whole replacement rows, not partials.
   */
  updateRows(rows: T[]): void;
  /**
   * Open the row editor programmatically.
   * @param rowId - The id, as returned by `getRowId`.
   */
  startEditing(rowId: string | number): void;
  /** Close the editor, abandoning any uncommitted draft. */
  stopEditing(): void;
}
