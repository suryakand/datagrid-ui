import type { ColumnDef, ResolvedColumn } from '../types';

const DEFAULT_WIDTH = 150;
const DEFAULT_MIN_WIDTH = 60;

/** Reads `a.b.c` out of an object, tolerating nulls along the way. */
function readPath(row: unknown, path: string): unknown {
  if (row == null) return undefined;
  if (!path.includes('.')) return (row as Record<string, unknown>)[path];

  let current: unknown = row;
  for (const segment of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Resolves a cell's raw value from its row.
 *
 * Tries, in order: {@link ColumnDef.valueGetter}, the dotted `field` path, the
 * literal flat key, then each {@link ColumnDef.fieldAliases | alias}.
 *
 * @remarks
 * The fallbacks exist because servers that flatten joined relations hand back
 * `{"customer.businessName": x}` rather than a nested object — and some change
 * the prefix when grouping is on.
 *
 * @param row - The row to read from.
 * @param column - The column describing what to read.
 * @returns The raw value, or `undefined` if nothing matched.
 *
 * @example
 * ```ts
 * resolveValue({ customer: { name: 'Acme' } }, { field: 'customer.name', header: 'C' });
 * // 'Acme'
 * ```
 */
export function resolveValue<T>(row: T, column: ColumnDef<T, never>): unknown {
  if (column.valueGetter) return column.valueGetter(row);

  const { field } = column;
  if (!field) return undefined;

  const nested = readPath(row, field);
  if (nested !== undefined) return nested;

  const flat = (row as Record<string, unknown>)?.[field];
  if (flat !== undefined) return flat;

  for (const alias of column.fieldAliases ?? []) {
    const value = readPath(row, alias) ?? (row as Record<string, unknown>)?.[alias];
    if (value !== undefined) return value;
  }

  return undefined;
}

/**
 * The display string for a cell, independent of any custom renderer.
 *
 * Uses {@link ColumnDef.valueFormatter} when present. Otherwise `null` and
 * `undefined` become `''`, `Date` becomes `YYYY-MM-DD`, booleans become
 * `Yes`/`No`, and everything else is stringified.
 *
 * @param value - The raw value, usually from {@link resolveValue}.
 * @param row - The row it came from, passed to the formatter.
 * @param column - The column being formatted.
 * @returns The display string.
 */
export function formatValue<T>(value: unknown, row: T, column: ColumnDef<T, never>): string {
  if (column.valueFormatter) return column.valueFormatter(value, row);
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/**
 * The string written to CSV and the clipboard for a cell.
 *
 * Prefers {@link ColumnDef.exportValue}, falling back to {@link formatValue} —
 * which is why a column with a markup `cellRenderer` should supply one.
 *
 * @param row - The row to export.
 * @param column - The column being exported.
 * @returns The flat string for this cell.
 */
export function exportValue<T>(row: T, column: ColumnDef<T, never>): string {
  if (column.exportValue) return column.exportValue(row);
  return formatValue(resolveValue(row, column), row, column);
}

/**
 * Plain-text header, for exports and aria labels.
 *
 * Prefers {@link ColumnDef.headerName}, then a string or numeric `header`, then
 * falls back to the column id.
 *
 * @param column - The column to label.
 * @returns The header as plain text, or `''` if nothing usable was found.
 */
export function headerText<T>(column: ColumnDef<T, never>): string {
  if (column.headerName) return column.headerName;
  if (typeof column.header === 'string') return column.header;
  if (typeof column.header === 'number') return String(column.header);
  return column.colId ?? column.field ?? '';
}

/**
 * The stable id for a column: `colId`, or `field` when `colId` was omitted.
 *
 * @param column - The column to identify.
 * @returns The column id.
 * @throws If the column has neither `colId` nor `field`.
 */
export function columnId<T, C>(column: ColumnDef<T, C>): string {
  const id = column.colId ?? column.field;
  if (!id) {
    throw new Error('@helix-x/datagrid-ui: every column needs a `colId` or a `field`.');
  }
  return id;
}

/**
 * Fills in the defaults every other module assumes are present.
 *
 * Width defaults to 150 (never below `minWidth`), `minWidth` to 60, and both
 * `sortable` and `resizable` to `true`.
 *
 * @param column - The column as authored.
 * @returns The same column with required fields resolved.
 */
export function resolveColumn<T, C>(column: ColumnDef<T, C>): ResolvedColumn<T, C> {
  const minWidth = column.minWidth ?? DEFAULT_MIN_WIDTH;
  return {
    ...column,
    colId: columnId(column),
    width: Math.max(column.width ?? DEFAULT_WIDTH, minWidth),
    minWidth,
    sortable: column.sortable ?? true,
    resizable: column.resizable ?? true,
  };
}

/**
 * Whether a specific row's cell is editable in this column.
 *
 * @param column - The column to test.
 * @param row - The row to test, for a predicate `editable`.
 * @returns `true` when the cell can be edited.
 */
export function isEditable<T, C>(column: ColumnDef<T, C>, row: T): boolean {
  if (typeof column.editable === 'function') return column.editable(row);
  return column.editable === true;
}
