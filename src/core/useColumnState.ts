import { useCallback, useMemo, useState } from 'react';
import type {
  ColumnDef,
  ColumnLayout,
  ColumnLayoutItem,
  Pinned,
  PersistedGridState,
  ResolvedColumn,
} from '../types';
import { columnId, resolveColumn } from './values';

export interface ColumnStateValue {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
  pinned: Record<string, Pinned>;
}

export interface UseColumnStateResult<T, C> {
  /** Every column, in user order, including hidden ones (for the columns panel). */
  allColumns: ResolvedColumn<T, C>[];
  visibleColumns: ResolvedColumn<T, C>[];
  layout: ColumnLayout<T, C>;
  state: ColumnStateValue;
  isHidden: (colId: string) => boolean;
  setHidden: (colId: string, hidden: boolean) => void;
  setWidth: (colId: string, width: number) => void;
  setPinned: (colId: string, pinned: Pinned | undefined) => void;
  moveColumn: (colId: string, toIndex: number) => void;
  reset: () => void;
}

function defaultsFrom<T, C>(columns: ColumnDef<T, C>[]): ColumnStateValue {
  const order: string[] = [];
  const hidden: string[] = [];
  const widths: Record<string, number> = {};
  const pinned: Record<string, Pinned> = {};

  for (const column of columns) {
    const id = columnId(column);
    order.push(id);
    if (column.hide) hidden.push(id);
    if (column.width != null) widths[id] = column.width;
    if (column.pinned) pinned[id] = column.pinned;
  }

  return { order, hidden, widths, pinned };
}

/**
 * Merges persisted state *over* the column defaults, key by key.
 *
 * Deliberately not a wholesale replacement: a saved state that predates a new
 * column must not hide it, and must not discard the defaults for keys it does
 * not mention.
 */
function mergePersisted(
  defaults: ColumnStateValue,
  persisted: PersistedGridState['columns'] | undefined,
  knownIds: Set<string>
): ColumnStateValue {
  if (!persisted) return defaults;

  // Keep the saved order for columns that still exist, then append any new
  // columns in their declared position rather than dumping them at the end.
  const savedOrder = persisted.order.filter((id) => knownIds.has(id));
  const savedSet = new Set(savedOrder);
  const order = [...savedOrder];
  defaults.order.forEach((id, index) => {
    if (!savedSet.has(id)) order.splice(Math.min(index, order.length), 0, id);
  });

  return {
    order,
    hidden: (persisted.hidden ?? defaults.hidden).filter((id) => knownIds.has(id)),
    widths: { ...defaults.widths, ...(persisted.widths ?? {}) },
    pinned: { ...defaults.pinned, ...(persisted.pinned ?? {}) },
  };
}

export function useColumnState<T, C>(
  columns: ColumnDef<T, C>[],
  persisted: PersistedGridState['columns'] | undefined,
  onChange: (state: ColumnStateValue) => void,
  availableWidth: number
): UseColumnStateResult<T, C> {
  const resolved = useMemo(() => columns.map((c) => resolveColumn(c)), [columns]);

  const byId = useMemo(() => {
    const map = new Map<string, ResolvedColumn<T, C>>();
    for (const column of resolved) map.set(column.colId, column);
    return map;
  }, [resolved]);

  const defaults = useMemo(() => defaultsFrom(columns), [columns]);

  const [state, setState] = useState<ColumnStateValue>(() =>
    mergePersisted(defaults, persisted, new Set(defaults.order))
  );

  const update = useCallback(
    (mutate: (current: ColumnStateValue) => ColumnStateValue) => {
      setState((current) => {
        const next = mutate(current);
        onChange(next);
        return next;
      });
    },
    [onChange]
  );

  const hiddenSet = useMemo(() => new Set(state.hidden), [state.hidden]);

  const allColumns = useMemo(
    () =>
      state.order
        .map((id) => byId.get(id))
        .filter((c): c is ResolvedColumn<T, C> => c != null),
    [state.order, byId]
  );

  const visibleColumns = useMemo(
    () =>
      allColumns
        .filter((column) => !hiddenSet.has(column.colId))
        .map((column) =>
          state.widths[column.colId] != null || state.pinned[column.colId] != null
            ? {
                ...column,
                width: Math.max(
                  state.widths[column.colId] ?? column.width,
                  column.minWidth
                ),
                pinned: state.pinned[column.colId] ?? column.pinned,
              }
            : column
        ),
    [allColumns, hiddenSet, state.widths, state.pinned]
  );

  /**
   * One layout pass produces every geometry number the header and the cells
   * need, so no component computes its own offsets.
   */
  const layout = useMemo<ColumnLayout<T, C>>(() => {
    // Flex columns share whatever space the fixed ones leave over.
    const flexTotal = visibleColumns.reduce((sum, c) => sum + (c.flex ?? 0), 0);
    const fixedWidth = visibleColumns.reduce(
      (sum, c) => sum + (c.flex ? 0 : c.width),
      0
    );
    const spare = Math.max(0, availableWidth - fixedWidth);

    const widthOf = (column: ResolvedColumn<T, C>) => {
      if (!column.flex || flexTotal === 0) return column.width;
      const share = Math.floor((spare * column.flex) / flexTotal);
      const capped = column.maxWidth ? Math.min(share, column.maxWidth) : share;
      return Math.max(capped, column.minWidth);
    };

    // Pinned columns keep their declared order but are laid out as three
    // contiguous bands: left-pinned, unpinned, right-pinned.
    const left = visibleColumns.filter((c) => c.pinned === 'left');
    const middle = visibleColumns.filter((c) => !c.pinned);
    const right = visibleColumns.filter((c) => c.pinned === 'right');

    const items: ColumnLayoutItem<T, C>[] = [];
    let offset = 0;
    let leftSticky = 0;

    for (const column of left) {
      const width = widthOf(column);
      items.push({
        column,
        colId: column.colId,
        width,
        left: offset,
        pinned: 'left',
        stickyOffset: leftSticky,
      });
      offset += width;
      leftSticky += width;
    }

    for (const column of middle) {
      const width = widthOf(column);
      items.push({ column, colId: column.colId, width, left: offset, stickyOffset: 0 });
      offset += width;
    }

    // Right-pinned sticky offsets accumulate from the right edge, so walk them
    // backwards first.
    const rightWidths = right.map(widthOf);
    let rightSticky = 0;
    const rightOffsets: number[] = [];
    for (let i = right.length - 1; i >= 0; i--) {
      rightOffsets[i] = rightSticky;
      rightSticky += rightWidths[i];
    }

    right.forEach((column, index) => {
      const width = rightWidths[index];
      items.push({
        column,
        colId: column.colId,
        width,
        left: offset,
        pinned: 'right',
        stickyOffset: rightOffsets[index],
      });
      offset += width;
    });

    return {
      items,
      totalWidth: offset,
      leftPinnedWidth: leftSticky,
      rightPinnedWidth: rightSticky,
    };
  }, [visibleColumns, availableWidth]);

  const isHidden = useCallback((colId: string) => hiddenSet.has(colId), [hiddenSet]);

  const setHidden = useCallback(
    (colId: string, hidden: boolean) => {
      update((current) => ({
        ...current,
        hidden: hidden
          ? current.hidden.includes(colId)
            ? current.hidden
            : [...current.hidden, colId]
          : current.hidden.filter((id) => id !== colId),
      }));
    },
    [update]
  );

  const setWidth = useCallback(
    (colId: string, width: number) => {
      update((current) => ({
        ...current,
        widths: { ...current.widths, [colId]: Math.round(width) },
      }));
    },
    [update]
  );

  const setPinned = useCallback(
    (colId: string, pinned: Pinned | undefined) => {
      update((current) => {
        const next = { ...current.pinned };
        if (pinned) next[colId] = pinned;
        else delete next[colId];
        return { ...current, pinned: next };
      });
    },
    [update]
  );

  const moveColumn = useCallback(
    (colId: string, toIndex: number) => {
      update((current) => {
        const from = current.order.indexOf(colId);
        if (from === -1 || from === toIndex) return current;
        const order = [...current.order];
        order.splice(from, 1);
        order.splice(Math.max(0, Math.min(toIndex, order.length)), 0, colId);
        return { ...current, order };
      });
    },
    [update]
  );

  const reset = useCallback(() => {
    update(() => defaults);
  }, [update, defaults]);

  return {
    allColumns,
    visibleColumns,
    layout,
    state,
    isHidden,
    setHidden,
    setWidth,
    setPinned,
    moveColumn,
    reset,
  };
}
