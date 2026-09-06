/**
 * A dependency-free React data grid: virtualized rows, server-side paging,
 * sorting and filtering, inline row editing, multi-select, CSV and clipboard
 * export, and persisted column preferences.
 *
 * React is the only runtime requirement. Styling is plain Tailwind utility
 * classes — there is no stylesheet to import and no theme engine to configure.
 *
 * ## Installation
 *
 * ```bash
 * npm install @helix-x/datagrid-ui
 * ```
 *
 * Tailwind skips `node_modules` when detecting content, so point it at the
 * shipped bundle explicitly or the grid renders unstyled:
 *
 * ```css
 * @import "tailwindcss";
 * @source "../node_modules/@helix-x/datagrid-ui/dist/index.js";
 * ```
 *
 * ## Getting started
 *
 * ```tsx
 * import { DataGrid, type ColumnDef } from '@helix-x/datagrid-ui';
 *
 * const columns: ColumnDef<Person>[] = [
 *   { field: 'name',  header: 'Name',  flex: 1, filter: 'text' },
 *   { field: 'email', header: 'Email', flex: 1 },
 * ];
 *
 * export function People() {
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
 *       storageKey="people"
 *     />
 *   );
 * }
 * ```
 *
 * ## Where to look next
 *
 * - {@link DataGrid} and {@link DataGridProps} — the component and every option.
 * - {@link ColumnDef} — the main thing you write.
 * - {@link HxDataSource} — the server contract, wire-compatible with ag-grid's
 *   server-side row model.
 * - {@link GridApi} — the imperative handle, for refreshing, exporting and
 *   patching rows in place.
 *
 * ## Not in this version
 *
 * Row grouping, pivoting, tree data, master/detail, variable row heights, and
 * `.xlsx` output — CSV is written with a BOM, which Excel opens natively.
 *
 * @packageDocumentation
 */

export { DataGrid } from './components/DataGrid';
export type { DataGridProps } from './components/DataGrid';

export { GridPagination } from './components/GridPagination';
export type { GridPaginationProps } from './components/GridPagination';
export { GridOverlay } from './components/GridOverlay';
export type { GridOverlayProps } from './components/GridOverlay';
export { ColumnsPanel } from './components/ColumnsPanel';
export type { ColumnsPanelProps } from './components/ColumnsPanel';
export { FilterPopover } from './components/FilterPopover';
export type { FilterPopoverProps } from './components/FilterPopover';
export {
  TextEditor,
  NumberEditor,
  DateEditor,
  SelectEditor,
  CheckboxEditor,
} from './components/editors/BuiltinEditors';
export { BUILTIN_EDITORS } from './components/editors/registry';

export { useGridState } from './core/useGridState';
export type { UseGridStateResult } from './core/useGridState';
export { useSelectionModel } from './core/useSelectionModel';
export type { RowId, UseSelectionModelResult } from './core/useSelectionModel';
export { useServerDataSource } from './core/useServerDataSource';
export type {
  UseServerDataSourceOptions,
  UseServerDataSourceResult,
} from './core/useServerDataSource';
export { useVirtualRows } from './core/useVirtualRows';
export type {
  UseVirtualRowsOptions,
  UseVirtualRowsResult,
  VirtualWindow,
} from './core/useVirtualRows';
export { useColumnState } from './core/useColumnState';
export type { ColumnStateValue, UseColumnStateResult } from './core/useColumnState';
export { useEditModel } from './core/useEditModel';
export type { EditState, UseEditModelResult } from './core/useEditModel';

export {
  resolveValue,
  formatValue,
  exportValue,
  headerText,
  columnId,
  resolveColumn,
  isEditable,
} from './core/values';

export {
  buildTextFilter,
  buildNumberFilter,
  buildDateFilter,
  buildSetFilter,
  withFilter,
  describeFilter,
  isUnaryFilter,
  isRangeFilter,
  defaultFilterType,
  TEXT_FILTER_TYPES,
  NUMBER_FILTER_TYPES,
  DATE_FILTER_TYPES,
  FILTER_TYPE_LABELS,
} from './core/filterModel';

export { toCsv, toTsv, toDelimited, downloadCsv, copyToClipboard } from './core/exporters';

export { GRID_STATE_VERSION } from './types';
export type {
  ColumnDef,
  ResolvedColumn,
  ColumnLayout,
  ColumnLayoutItem,
  CellRendererParams,
  EditorParams,
  EditorComponent,
  BuiltinEditor,
  SelectOption,
  Pinned,
  FilterKind,
  HxFilterModel,
  FilterModelMap,
  TextFilterModel,
  NumberFilterModel,
  DateFilterModel,
  SetFilterModel,
  TextFilterType,
  NumberFilterType,
  DateFilterType,
  SortDirection,
  SortModelItem,
  HxRowsRequest,
  HxRowsResponse,
  HxDataSource,
  RowCommitResult,
  PersistedGridState,
  GridApi,
  ExportCsvOptions,
} from './types';
