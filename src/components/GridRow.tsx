import { memo, useState } from 'react';
import type { ColumnLayout, GridApi } from '../types';
import { isEditable } from '../core/values';
import type { RowId } from '../core/useSelectionModel';
import { GridCell } from './GridCell';
import { SelectionCell } from './SelectionCell';

export interface GridRowProps<T, C> {
  row: T;
  rowId: RowId;
  rowIndex: number;
  top: number;
  height: number;
  layout: ColumnLayout<T, C>;
  context: C;
  api: GridApi<T>;
  selectable: boolean;
  isSelected: boolean;
  isRowEditing: boolean;
  draft: T | null;
  errors: Record<string, string>;
  isSaving: boolean;
  onToggleSelect: (id: RowId, index: number, shiftKey: boolean) => void;
  onFieldChange: (field: string, value: unknown) => void;
  onCommit: () => void;
  onCancel: () => void;
  onRowDoubleClick: (rowId: RowId, row: T) => void;
  /** When set, files dropped on the row are handed to this callback. */
  onFilesDropped?: (row: T, files: File[]) => void;
}

function GridRowInner<T, C>({
  row,
  rowId,
  rowIndex,
  top,
  height,
  layout,
  context,
  api,
  selectable,
  isSelected,
  isRowEditing,
  draft,
  errors,
  isSaving,
  onToggleSelect,
  onFieldChange,
  onCommit,
  onCancel,
  onRowDoubleClick,
  onFilesDropped,
}: GridRowProps<T, C>) {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const rowError = errors.__row__;

  // Only the first editable column autofocuses, so entering edit mode does not
  // fight over the caret.
  const firstEditableColId = isRowEditing
    ? layout.items.find((item) => isEditable(item.column, row))?.colId
    : undefined;

  // Every row background must be opaque: the sticky selection cell paints the
  // row's colour through `bg-inherit`, and a translucent tint lets the cells
  // scrolling underneath it show through. Each tint is therefore pre-mixed with
  // the grid's surface (white / gray-900) — the colour the alpha version
  // composited to — rather than expressed as an alpha.
  const background = isRowEditing
    ? 'bg-brand-25 dark:bg-[color-mix(in_srgb,var(--color-brand-500)_10%,var(--color-gray-900))]'
    : isSelected
      ? 'bg-brand-50 dark:bg-[color-mix(in_srgb,var(--color-brand-500)_15%,var(--color-gray-900))]'
      : rowIndex % 2 === 1
        ? 'bg-[color-mix(in_srgb,var(--color-gray-50)_60%,var(--color-white))] dark:bg-[color-mix(in_srgb,var(--color-white)_2%,var(--color-gray-900))]'
        : 'bg-white dark:bg-gray-900';

  return (
    <div
      role="row"
      aria-rowindex={rowIndex + 1}
      aria-selected={selectable ? isSelected : undefined}
      className={`absolute left-0 flex border-b border-gray-200 dark:border-gray-700 ${background} hover:bg-brand-25 dark:hover:bg-[color-mix(in_srgb,var(--color-white)_4%,var(--color-gray-900))] ${
        isSaving ? 'opacity-60' : ''
      } ${
        isDropTarget
          ? 'outline-2 -outline-offset-2 outline-dashed outline-brand-500'
          : ''
      }`}
      style={{ top, height, width: layout.totalWidth + (selectable ? 40 : 0) }}
      onDoubleClick={() => onRowDoubleClick(rowId, row)}
      title={rowError}
      onDragOver={
        onFilesDropped
          ? (event) => {
              // Only react to an actual file drag, not a column reorder.
              if (!event.dataTransfer.types.includes('Files')) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
              if (!isDropTarget) setIsDropTarget(true);
            }
          : undefined
      }
      onDragLeave={onFilesDropped ? () => setIsDropTarget(false) : undefined}
      onDrop={
        onFilesDropped
          ? (event) => {
              if (!event.dataTransfer.types.includes('Files')) return;
              event.preventDefault();
              setIsDropTarget(false);
              const files = Array.from(event.dataTransfer.files);
              if (files.length > 0) onFilesDropped(row, files);
            }
          : undefined
      }
    >
      {selectable && (
        <SelectionCell
          checked={isSelected}
          onToggle={(shiftKey) => onToggleSelect(rowId, rowIndex, shiftKey)}
        />
      )}

      {layout.items.map((item) => (
        <GridCell
          key={item.colId}
          item={item}
          row={row}
          rowIndex={rowIndex}
          context={context}
          api={api}
          isRowEditing={isRowEditing}
          draft={draft}
          errors={errors}
          isFirstEditable={item.colId === firstEditableColId}
          onFieldChange={onFieldChange}
          onCommit={onCommit}
          onCancel={onCancel}
        />
      ))}
    </div>
  );
}

export const GridRow = memo(GridRowInner) as typeof GridRowInner;
