import type { ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/* Filter models                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The wire shapes below intentionally mirror what ag-grid's server-side row
 * model posts, because most existing backends that speak "grid" already parse
 * them. Keeping them identical is what lets a screen swap grids without a
 * backend change.
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

export type DateFilterType =
  | 'equals'
  | 'notEqual'
  | 'before'
  | 'after'
  | 'inRange'
  | 'blank'
  | 'notBlank';

export interface TextFilterModel {
  filterType: 'text';
  type: TextFilterType;
  filter?: string;
}

export interface NumberFilterModel {
  filterType: 'number';
  type: NumberFilterType;
  filter?: number;
  filterTo?: number;
}

export interface DateFilterModel {
  filterType: 'date';
  type: DateFilterType;
  /** `YYYY-MM-DD` */
  dateFrom?: string;
  dateTo?: string;
}

export interface SetFilterModel {
  filterType: 'set';
  values: string[];
}

export type HxFilterModel =
  | TextFilterModel
  | NumberFilterModel
  | DateFilterModel
  | SetFilterModel;

export type FilterModelMap = Record<string, HxFilterModel>;

export type FilterKind = 'text' | 'number' | 'date' | 'set';

/* -------------------------------------------------------------------------- */
/* Sorting                                                                    */
/* -------------------------------------------------------------------------- */

export type SortDirection = 'asc' | 'desc';

export interface SortModelItem {
  colId: string;
  sort: SortDirection;
}

/* -------------------------------------------------------------------------- */
/* Data source                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Structurally compatible with ag-grid's `IServerSideGetRowsRequest`, so an
 * endpoint written for that model accepts this verbatim. The grouping/pivot
 * fields are always sent empty — this grid does not implement them — but they
 * are present so servers that destructure them do not fall over.
 */
export interface HxRowsRequest {
  startRow: number;
  endRow: number;
  sortModel: SortModelItem[];
  filterModel: FilterModelMap;
  rowGroupCols: never[];
  valueCols: never[];
  pivotCols: never[];
  pivotMode: false;
  groupKeys: never[];
}

export interface HxRowsResponse<T> {
  rows: T[];
  /** Total row count across all pages, or -1 when unknown. */
  lastRow: number;
}

export interface HxDataSource<T> {
  getRows(request: HxRowsRequest, signal: AbortSignal): Promise<HxRowsResponse<T>>;
}

/* -------------------------------------------------------------------------- */
/* Columns                                                                    */
/* -------------------------------------------------------------------------- */

export type Pinned = 'left' | 'right';

export interface CellRendererParams<T, C = unknown> {
  row: T;
  rowIndex: number;
  value: unknown;
  formatted: string;
  column: ColumnDef<T, C>;
  /**
   * Arbitrary app state handed to every renderer. Put volatile things here
   * (in-flight ids, permission checks, handlers) so column definitions can stay
   * memoised on `[]` and never rebuild.
   */
  context: C;
  api: GridApi<T>;
}

export interface EditorParams<T, C = unknown> {
  value: unknown;
  row: T;
  column: ColumnDef<T, C>;
  context: C;
  /** Writes into the row draft. Never hits the network. */
  onChange: (value: unknown) => void;
  /** Commit the whole row. */
  onCommit: () => void;
  onCancel: () => void;
  error?: string;
  autoFocus?: boolean;
}

export type EditorComponent<T, C = unknown> = (
  params: EditorParams<T, C>
) => ReactNode;

export type BuiltinEditor = 'text' | 'number' | 'select' | 'date' | 'checkbox';

export interface SelectOption {
  label: string;
  value: unknown;
}

export interface ColumnDef<T, C = unknown> {
  /** Stable identity. Falls back to `field` when omitted. */
  colId?: string;
  /** Dotted path into the row. Also used as the server-side filter/sort key. */
  field?: string;
  header: ReactNode;
  /** Plain-text header, used for exports when `header` is a node. */
  headerName?: string;

  width?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Share of the leftover horizontal space. */
  flex?: number;

  pinned?: Pinned;
  hide?: boolean;
  sortable?: boolean;
  resizable?: boolean;
  /** Prevent the user dragging this column out of position. */
  lockPosition?: boolean;

  filter?: FilterKind | false;
  filterParams?: {
    /** Static values, or a loader for a set filter whose options come from an API. */
    values?: string[] | (() => Promise<string[]>);
    /** Hide the always-visible filter input under the header for this column. */
    suppressFloatingFilter?: boolean;
  };

  /** Alternative flat keys to try when the server flattens nested fields. */
  fieldAliases?: string[];

  valueGetter?: (row: T) => unknown;
  valueFormatter?: (value: unknown, row: T) => string;
  cellRenderer?: (params: CellRendererParams<T, C>) => ReactNode;

  editable?: boolean | ((row: T) => boolean);
  editor?: BuiltinEditor | EditorComponent<T, C>;
  editorParams?: {
    options?: SelectOption[];
    placeholder?: string;
  };

  exportValue?: (row: T) => string;
  suppressExport?: boolean;

  cellClassName?: string | ((row: T) => string);
  headerClassName?: string;
  /** Horizontal alignment of the cell content. */
  align?: 'left' | 'center' | 'right';
}

/** A column with every default resolved. Internal, but exported for renderers. */
export interface ResolvedColumn<T, C = unknown> extends ColumnDef<T, C> {
  colId: string;
  width: number;
  minWidth: number;
  sortable: boolean;
  resizable: boolean;
}

/** Geometry for one visible column, computed once per layout change. */
export interface ColumnLayoutItem<T, C = unknown> {
  column: ResolvedColumn<T, C>;
  colId: string;
  width: number;
  /** Offset from the left edge of the full (unscrolled) column strip. */
  left: number;
  pinned?: Pinned;
  /** `left`/`right` offset to use for `position: sticky` on pinned columns. */
  stickyOffset: number;
}

export interface ColumnLayout<T, C = unknown> {
  items: ColumnLayoutItem<T, C>[];
  totalWidth: number;
  leftPinnedWidth: number;
  rightPinnedWidth: number;
}

/* -------------------------------------------------------------------------- */
/* Editing                                                                    */
/* -------------------------------------------------------------------------- */

export type RowCommitResult =
  | { ok: true; row?: unknown }
  | { ok: false; errors: Record<string, string>; message?: string };

/* -------------------------------------------------------------------------- */
/* Persisted state                                                            */
/* -------------------------------------------------------------------------- */

export const GRID_STATE_VERSION = 1;

export interface PersistedGridState {
  v: number;
  columns: {
    order: string[];
    hidden: string[];
    widths: Record<string, number>;
    pinned: Record<string, Pinned>;
  };
  sort: SortModelItem[];
  filters: FilterModelMap;
  pagination: { pageSize: number };
}

/* -------------------------------------------------------------------------- */
/* Imperative API                                                             */
/* -------------------------------------------------------------------------- */

export interface ExportCsvOptions {
  onlySelected?: boolean;
  fileName?: string;
  /** Field separator. Defaults to `,`. */
  separator?: string;
}

export interface GridApi<T> {
  /** Re-fetch. `purge` drops every cached block first. */
  refresh(options?: { purge?: boolean }): void;
  getDisplayedRows(): T[];
  getSelectedRows(): T[];
  getSelectedIds(): Array<string | number>;
  clearSelection(): void;
  selectAll(): void;
  exportCsv(options?: ExportCsvOptions): void;
  copySelectionToClipboard(): Promise<void>;
  getFilterModel(): FilterModelMap;
  setFilterModel(model: FilterModelMap): void;
  getSortModel(): SortModelItem[];
  setSortModel(model: SortModelItem[]): void;
  resetColumns(): void;
  /** Patch rows already on screen without a round trip. */
  updateRows(rows: T[]): void;
  startEditing(rowId: string | number): void;
  stopEditing(): void;
}
