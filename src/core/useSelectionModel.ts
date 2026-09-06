import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * A row's stable identity, as returned by `getRowId`.
 *
 * Selection, editing and {@link GridApi.updateRows} all key off this.
 */
export type RowId = string | number;

/**
 * What {@link useSelectionModel} returns.
 *
 * @typeParam T - The row type.
 */
export interface UseSelectionModelResult<T> {
  /** Every selected id, including rows on pages that are not loaded. */
  selectedIds: Set<RowId>;
  /** Whether one id is selected. */
  isSelected: (id: RowId) => boolean;
  /** True when every row currently on screen is selected. */
  allVisibleSelected: boolean;
  /** True when some, but not all, visible rows are selected. */
  someVisibleSelected: boolean;
  /**
   * Toggle one row.
   * @param id - The row to toggle.
   * @param index - Its index in the loaded page, used as the shift anchor.
   * @param shiftKey - Extend from the last toggled row instead of toggling one.
   */
  toggleRow: (id: RowId, index: number, shiftKey: boolean) => void;
  /** Select every visible row, or deselect them if all are already selected. */
  toggleAllVisible: () => void;
  /** Deselect everything, including rows on other pages. */
  clear: () => void;
  /** Select every row on the current page. */
  selectAllVisible: () => void;
  /** The selected rows that are currently loaded. */
  getSelectedRows: () => T[];
}

/**
 * Multi-row selection with shift-range support.
 *
 * Selection survives paging: ids stay selected even when their rows are not
 * loaded, which is why `getSelectedRows` returns only the loaded subset while
 * `selectedIds` holds everything.
 *
 * @typeParam T - The row type.
 * @param rows - The currently loaded page.
 * @param getRowId - Stable identity for a row.
 * @param onSelectionChanged - Called with every selected id after each change.
 * @returns The selection state and its mutators.
 */
export function useSelectionModel<T>(
  rows: T[],
  getRowId: (row: T) => RowId,
  onSelectionChanged?: (ids: RowId[]) => void
): UseSelectionModelResult<T> {
  const [selectedIds, setSelectedIds] = useState<Set<RowId>>(() => new Set());
  const lastToggledIndexRef = useRef<number | null>(null);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const getRowIdRef = useRef(getRowId);
  getRowIdRef.current = getRowId;

  const commit = useCallback(
    (next: Set<RowId>) => {
      setSelectedIds(next);
      onSelectionChanged?.([...next]);
    },
    [onSelectionChanged]
  );

  const isSelected = useCallback((id: RowId) => selectedIds.has(id), [selectedIds]);

  const visibleIds = useMemo(() => rows.map(getRowId), [rows, getRowId]);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    !allVisibleSelected && visibleIds.some((id) => selectedIds.has(id));

  const toggleRow = useCallback(
    (id: RowId, index: number, shiftKey: boolean) => {
      const next = new Set(selectedIds);
      const anchor = lastToggledIndexRef.current;

      if (shiftKey && anchor != null && anchor !== index) {
        // Shift extends from the last click across the loaded window.
        const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
        const shouldSelect = !next.has(id);
        for (let i = from; i <= to; i++) {
          const rowId = getRowIdRef.current(rowsRef.current[i]);
          if (rowId == null) continue;
          if (shouldSelect) next.add(rowId);
          else next.delete(rowId);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      lastToggledIndexRef.current = index;
      commit(next);
    },
    [selectedIds, commit]
  );

  const toggleAllVisible = useCallback(() => {
    const next = new Set(selectedIds);
    if (allVisibleSelected) {
      for (const id of visibleIds) next.delete(id);
    } else {
      for (const id of visibleIds) next.add(id);
    }
    lastToggledIndexRef.current = null;
    commit(next);
  }, [selectedIds, allVisibleSelected, visibleIds, commit]);

  const selectAllVisible = useCallback(() => {
    const next = new Set(selectedIds);
    for (const id of visibleIds) next.add(id);
    commit(next);
  }, [selectedIds, visibleIds, commit]);

  const clear = useCallback(() => {
    lastToggledIndexRef.current = null;
    commit(new Set());
  }, [commit]);

  const getSelectedRows = useCallback(
    () => rowsRef.current.filter((row) => selectedIds.has(getRowIdRef.current(row))),
    [selectedIds]
  );

  return {
    selectedIds,
    isSelected,
    allVisibleSelected,
    someVisibleSelected,
    toggleRow,
    toggleAllVisible,
    clear,
    selectAllVisible,
    getSelectedRows,
  };
}
