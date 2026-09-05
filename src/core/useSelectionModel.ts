import { useCallback, useMemo, useRef, useState } from 'react';

export type RowId = string | number;

export interface UseSelectionModelResult<T> {
  selectedIds: Set<RowId>;
  isSelected: (id: RowId) => boolean;
  /** True when every row currently on screen is selected. */
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  toggleRow: (id: RowId, index: number, shiftKey: boolean) => void;
  toggleAllVisible: () => void;
  clear: () => void;
  selectAllVisible: () => void;
  getSelectedRows: () => T[];
}

/**
 * Selection lives here as a real React model rather than being read back out of
 * persisted grid state -- that indirection is what made the previous
 * implementation's "is anything selected?" check unreliable.
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
