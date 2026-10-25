import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ColumnDef,
  FilterModelMap,
  HxColumnVO,
  HxDataSource,
  SortModelItem,
} from '../types';
import { buildRequest } from './useServerDataSource';
import { resolveValue } from './values';

/**
 * One line of a grouped grid, in display order. Every kind is drawn at the
 * grid's fixed row height, so virtualization is unaffected by grouping.
 *
 * - `leaf` — an ordinary row. `leafIndex` is its position in
 *   {@link UseRowGroupingResult.leafRows}, which is what selection ranges use.
 * - `group` — a group row returned by the server for the group level.
 * - `status` — the line under an expanded group's rows: still loading, failed,
 *   or more rows to load.
 *
 * @typeParam T - The row type.
 */
export type GroupedDisplayRow<T> =
  | {
      /** Discriminant: an ordinary row. */
      kind: 'leaf';
      /** The row. */
      row: T;
      /** The group it sits in, or `null` when the grid is not grouped. */
      groupKey: string | null;
      /** Its index in {@link UseRowGroupingResult.leafRows}. */
      leafIndex: number;
    }
  | {
      /** Discriminant: a group row. */
      kind: 'group';
      /** The group row as the server returned it, aggregates included. */
      row: T;
      /** The group's value as a string — what is sent in `groupKeys`. */
      groupKey: string;
      /** Rows in the group, or `null` when the server did not say. */
      childCount: number | null;
      /** Whether the group is open. */
      expanded: boolean;
    }
  | {
      /** Discriminant: the line under an expanded group's rows. */
      kind: 'status';
      /** The group this line belongs to. */
      groupKey: string;
      /** Loading the next block, failed, or more rows available. */
      status: 'loading' | 'error' | 'more';
      /** Rows of the group loaded so far. */
      loaded: number;
      /** Rows in the group per the server's `lastRow`, or `-1` if unknown. */
      total: number;
      /** What the last fetch threw, for `status: 'error'`. */
      error?: unknown;
    };

/**
 * Options for {@link useRowGrouping}.
 *
 * @typeParam T - The row type.
 */
export interface UseRowGroupingOptions<T> {
  /** The same data source the grid pages through. */
  dataSource: HxDataSource<T>;
  /**
   * The page the grid loaded: group rows while grouped, ordinary rows
   * otherwise.
   */
  rows: T[];
  /**
   * The column being grouped by, or `null` when not grouped. Its value on a
   * group row, as a string, is the group's key.
   */
  groupColumn: ColumnDef<T, never> | null;
  /** Sent with every request for a group's rows. */
  rowGroupCols: HxColumnVO[];
  /** Sent with every request for a group's rows. */
  valueCols: HxColumnVO[];
  /** Active sorts, sent with every request for a group's rows. */
  sortModel: SortModelItem[];
  /** Active filters, sent with every request for a group's rows. */
  filterModel: FilterModelMap;
  /**
   * Rows asked for each time a group is opened or "Load more" is used.
   * @defaultValue 100
   */
  blockSize?: number;
  /**
   * Reads a group row's child count.
   * @defaultValue the row's numeric `childCount` field
   */
  getGroupChildCount?: (row: T) => number | null | undefined;
  /** Called when a fetch throws. Aborted requests are not reported. */
  onError?: (error: unknown) => void;
}

/**
 * What {@link useRowGrouping} returns.
 *
 * @typeParam T - The row type.
 */
export interface UseRowGroupingResult<T> {
  /** Every line to draw, in order. */
  displayRows: GroupedDisplayRow<T>[];
  /**
   * The ordinary rows among `displayRows`, in order: the page itself when not
   * grouped, the rows loaded inside expanded groups when grouped.
   */
  leafRows: T[];
  /** Open a closed group (fetching its first block if needed) or close it. */
  toggleGroup: (groupKey: string) => void;
  /** Fetch the next block of an open group; also retries after an error. */
  loadMore: (groupKey: string) => void;
  /**
   * Close every group and drop every loaded block, cancelling fetches in
   * flight. Called for you whenever the query changes.
   */
  reset: () => void;
  /**
   * Patch rows already loaded inside groups, matched by id. No request is
   * made; ids that are not loaded are ignored.
   */
  patchRows: (rows: T[], getRowId: (row: T) => string | number) => void;
}

interface GroupChildren<T> {
  rows: T[];
  total: number;
  done: boolean;
  loading: boolean;
  error: unknown;
}

const DEFAULT_BLOCK_SIZE = 100;

function defaultChildCount(row: unknown): number | null {
  const value = (row as Record<string, unknown> | null)?.childCount;
  const count = typeof value === 'string' ? Number(value) : value;
  return typeof count === 'number' && Number.isFinite(count) ? count : null;
}

/**
 * The client half of single-level, server-side row grouping.
 *
 * The page of group rows comes from {@link useServerDataSource}; this hook
 * owns what happens below them. Opening a group asks the data source for that
 * group's rows with `groupKeys: [key]`, a block at a time, and splices them in
 * under the group row. The result is one flat list, so the fixed-height
 * virtualization of {@link useVirtualRows} works unchanged.
 *
 * {@link DataGrid} uses this internally; call it directly only when building a
 * custom surface on the same data contract.
 *
 * @typeParam T - The row type.
 * @param options - Data source, the loaded page, and the query.
 * @returns The lines to draw plus the group controls.
 *
 * @remarks
 * Like the page fetch, every group fetch carries an `AbortController`, and a
 * generation counter drops any response that arrives after the query changed,
 * so rows fetched under an old sort or filter are never spliced into the new
 * result. Any change to the query closes every group.
 */
export function useRowGrouping<T>({
  dataSource,
  rows,
  groupColumn,
  rowGroupCols,
  valueCols,
  sortModel,
  filterModel,
  blockSize = DEFAULT_BLOCK_SIZE,
  getGroupChildCount,
  onError,
}: UseRowGroupingOptions<T>): UseRowGroupingResult<T> {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [children, setChildren] = useState<ReadonlyMap<string, GroupChildren<T>>>(
    () => new Map()
  );

  const generationRef = useRef(0);
  const controllersRef = useRef(new Map<string, AbortController>());

  // Read at call time, so the callbacks below stay stable.
  const latest = useRef({
    dataSource,
    rowGroupCols,
    valueCols,
    sortModel,
    filterModel,
    blockSize,
    onError,
    children,
  });
  latest.current = {
    dataSource,
    rowGroupCols,
    valueCols,
    sortModel,
    filterModel,
    blockSize,
    onError,
    children,
  };

  const reset = useCallback(() => {
    generationRef.current += 1;
    for (const controller of controllersRef.current.values()) controller.abort();
    controllersRef.current.clear();
    setExpanded(new Set());
    setChildren(new Map());
  }, []);

  // A different query invalidates every loaded block and every open group.
  const queryKey = useMemo(
    () => JSON.stringify({ rowGroupCols, valueCols, sortModel, filterModel }),
    [rowGroupCols, valueCols, sortModel, filterModel]
  );
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    reset();
  }, [queryKey, dataSource, reset]);

  useEffect(
    () => () => {
      for (const controller of controllersRef.current.values()) controller.abort();
    },
    []
  );

  const fetchBlock = useCallback((groupKey: string) => {
    const {
      dataSource: source,
      rowGroupCols: groupCols,
      valueCols: aggCols,
      sortModel: sorts,
      filterModel: filters,
      blockSize: size,
    } = latest.current;
    const existing = latest.current.children.get(groupKey);
    if (existing?.loading) return;

    const startRow = existing?.rows.length ?? 0;
    const generation = generationRef.current;
    const controller = new AbortController();
    controllersRef.current.get(groupKey)?.abort();
    controllersRef.current.set(groupKey, controller);

    const update = (patch: (current: GroupChildren<T>) => GroupChildren<T>) =>
      setChildren((current) => {
        const next = new Map(current);
        next.set(
          groupKey,
          patch(
            current.get(groupKey) ?? {
              rows: [],
              total: -1,
              done: false,
              loading: false,
              error: null,
            }
          )
        );
        return next;
      });

    update((entry) => ({ ...entry, loading: true, error: null }));

    source
      .getRows(
        buildRequest(startRow, startRow + size, sorts, filters, groupCols, aggCols, [groupKey]),
        controller.signal
      )
      .then((response) => {
        if (generation !== generationRef.current || controller.signal.aborted) return;
        controllersRef.current.delete(groupKey);
        const lastRow = response.lastRow ?? -1;
        update((entry) => {
          const loaded = [...entry.rows, ...response.rows];
          return {
            rows: loaded,
            total: lastRow,
            // A short block ends it whatever lastRow said; this also stops a
            // misbehaving server from offering "Load more" forever.
            done: response.rows.length < size || (lastRow >= 0 && loaded.length >= lastRow),
            loading: false,
            error: null,
          };
        });
      })
      .catch((error) => {
        if (generation !== generationRef.current || controller.signal.aborted) return;
        controllersRef.current.delete(groupKey);
        update((entry) => ({ ...entry, loading: false, error }));
        latest.current.onError?.(error);
      });
  }, []);

  const toggleGroup = useCallback(
    (groupKey: string) => {
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(groupKey)) {
          next.delete(groupKey);
        } else {
          next.add(groupKey);
        }
        return next;
      });
      // Closing keeps what was loaded, so reopening is instant. Opening a group
      // that has never been fetched starts its first block.
      if (!latest.current.children.has(groupKey)) fetchBlock(groupKey);
    },
    [fetchBlock]
  );

  const loadMore = useCallback((groupKey: string) => fetchBlock(groupKey), [fetchBlock]);

  const patchRows = useCallback(
    (updated: T[], getRowId: (row: T) => string | number) => {
      if (updated.length === 0) return;
      const byId = new Map(updated.map((row) => [getRowId(row), row]));
      setChildren((current) => {
        let changed = false;
        const next = new Map<string, GroupChildren<T>>();
        for (const [key, entry] of current) {
          let entryChanged = false;
          const patched = entry.rows.map((row) => {
            const replacement = byId.get(getRowId(row));
            if (!replacement) return row;
            entryChanged = true;
            return replacement;
          });
          changed ||= entryChanged;
          next.set(key, entryChanged ? { ...entry, rows: patched } : entry);
        }
        return changed ? next : current;
      });
    },
    []
  );

  const { displayRows, leafRows } = useMemo(() => {
    const display: GroupedDisplayRow<T>[] = [];
    const leaves: T[] = [];

    if (!groupColumn) {
      rows.forEach((row, index) => {
        display.push({ kind: 'leaf', row, groupKey: null, leafIndex: index });
      });
      return { displayRows: display, leafRows: rows };
    }

    for (const row of rows) {
      const value = resolveValue(row, groupColumn);
      const groupKey = value == null ? '' : String(value);
      const isOpen = expanded.has(groupKey);
      const count = getGroupChildCount ? getGroupChildCount(row) : defaultChildCount(row);

      display.push({
        kind: 'group',
        row,
        groupKey,
        childCount: count ?? null,
        expanded: isOpen,
      });
      if (!isOpen) continue;

      const entry = children.get(groupKey);
      for (const child of entry?.rows ?? []) {
        display.push({ kind: 'leaf', row: child, groupKey, leafIndex: leaves.length });
        leaves.push(child);
      }

      const loaded = entry?.rows.length ?? 0;
      const total = entry?.total ?? -1;
      if (!entry || entry.loading) {
        display.push({ kind: 'status', groupKey, status: 'loading', loaded, total });
      } else if (entry.error != null) {
        display.push({
          kind: 'status',
          groupKey,
          status: 'error',
          loaded,
          total,
          error: entry.error,
        });
      } else if (!entry.done) {
        display.push({ kind: 'status', groupKey, status: 'more', loaded, total });
      }
    }

    return { displayRows: display, leafRows: leaves };
  }, [rows, groupColumn, expanded, children, getGroupChildCount]);

  return { displayRows, leafRows, toggleGroup, loadMore, reset, patchRows };
}
