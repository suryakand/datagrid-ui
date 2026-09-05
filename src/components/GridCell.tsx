import { memo } from 'react';
import type { ColumnLayoutItem, GridApi } from '../types';
import { formatValue, isEditable, resolveValue } from '../core/values';
import { BUILTIN_EDITORS } from './editors/registry';

export interface GridCellProps<T, C> {
  item: ColumnLayoutItem<T, C>;
  row: T;
  rowIndex: number;
  context: C;
  api: GridApi<T>;
  isRowEditing: boolean;
  draft: T | null;
  errors: Record<string, string>;
  isFirstEditable: boolean;
  onFieldChange: (field: string, value: unknown) => void;
  onCommit: () => void;
  onCancel: () => void;
}

const ALIGN_CLASS = {
  left: 'justify-start text-left',
  center: 'justify-center text-center',
  right: 'justify-end text-right',
} as const;

function GridCellInner<T, C>({
  item,
  row,
  rowIndex,
  context,
  api,
  isRowEditing,
  draft,
  errors,
  isFirstEditable,
  onFieldChange,
  onCommit,
  onCancel,
}: GridCellProps<T, C>) {
  const { column, width, pinned, stickyOffset } = item;

  const style: React.CSSProperties = {
    width,
    minWidth: width,
    maxWidth: width,
    ...(pinned === 'left'
      ? { position: 'sticky', left: stickyOffset, zIndex: 2 }
      : pinned === 'right'
        ? { position: 'sticky', right: stickyOffset, zIndex: 2 }
        : null),
  };

  const custom =
    typeof column.cellClassName === 'function'
      ? column.cellClassName(row)
      : column.cellClassName;

  const base =
    'flex h-full items-center gap-1 border-r border-gray-200 px-2 text-xs ' +
    'text-gray-700 dark:border-gray-700 dark:text-gray-200 ' +
    (pinned ? 'bg-white dark:bg-gray-900 ' : '');

  const alignment = ALIGN_CLASS[column.align ?? 'left'];

  // While the row is in edit mode, editable columns swap their renderer for the
  // editor and read from the draft rather than the persisted row.
  const editing = isRowEditing && draft != null && isEditable(column, row);

  if (editing) {
    const field = column.field ?? column.colId;
    const error = errors[field];
    const editorValue = resolveValue(draft, column as never);

    const Editor =
      typeof column.editor === 'function'
        ? column.editor
        : BUILTIN_EDITORS[column.editor ?? 'text'];

    return (
      <div
        role="gridcell"
        className={`${base} ${alignment} ${custom ?? ''}`}
        style={style}
        data-col-id={column.colId}
      >
        <Editor
          value={editorValue}
          row={draft}
          column={column}
          context={context}
          error={error}
          autoFocus={isFirstEditable}
          onChange={(value: unknown) => onFieldChange(field, value)}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      </div>
    );
  }

  const value = resolveValue(row, column as never);
  const formatted = formatValue(value, row, column as never);

  const content = column.cellRenderer
    ? column.cellRenderer({
        row,
        rowIndex,
        value,
        formatted,
        column,
        context,
        api,
      })
    : formatted;

  return (
    <div
      role="gridcell"
      className={`${base} ${alignment} ${custom ?? ''}`}
      style={style}
      data-col-id={column.colId}
      title={column.cellRenderer ? undefined : formatted || undefined}
    >
      {column.cellRenderer ? (
        content
      ) : (
        <span className="truncate">{formatted}</span>
      )}
    </div>
  );
}

/**
 * Memoised on the props that actually change what is painted. Volatile app
 * state reaches renderers through `context`, so a new context object re-renders
 * cells without any column definition being rebuilt.
 */
export const GridCell = memo(GridCellInner) as typeof GridCellInner;
