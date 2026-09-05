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
 * Resolves a cell value.
 *
 * Servers that flatten joined relations hand back `{"customer.businessName": x}`
 * rather than a nested object -- and some flatten with a different prefix when
 * grouping is on. So: explicit getter, then the dotted path, then the literal
 * flat key, then any declared aliases.
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

/** The display string for a cell, independent of any custom renderer. */
export function formatValue<T>(value: unknown, row: T, column: ColumnDef<T, never>): string {
  if (column.valueFormatter) return column.valueFormatter(value, row);
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/** The string written to CSV / clipboard for a cell. */
export function exportValue<T>(row: T, column: ColumnDef<T, never>): string {
  if (column.exportValue) return column.exportValue(row);
  return formatValue(resolveValue(row, column), row, column);
}

/** Plain-text header, for exports and aria labels. */
export function headerText<T>(column: ColumnDef<T, never>): string {
  if (column.headerName) return column.headerName;
  if (typeof column.header === 'string') return column.header;
  if (typeof column.header === 'number') return String(column.header);
  return column.colId ?? column.field ?? '';
}

export function columnId<T, C>(column: ColumnDef<T, C>): string {
  const id = column.colId ?? column.field;
  if (!id) {
    throw new Error('@helix-x/datagrid-ui: every column needs a `colId` or a `field`.');
  }
  return id;
}

/** Fills in the defaults every other module assumes are present. */
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

export function isEditable<T, C>(column: ColumnDef<T, C>, row: T): boolean {
  if (typeof column.editable === 'function') return column.editable(row);
  return column.editable === true;
}
