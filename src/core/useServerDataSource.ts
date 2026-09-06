import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FilterModelMap, HxDataSource, HxRowsRequest, SortModelItem } from '../types';

/**
 * Options for {@link useServerDataSource}.
 *
 * @typeParam T - The row type.
 */
export interface UseServerDataSourceOptions<T> {
  /** Where rows come from. Memoise it, or every render refetches. */
  dataSource: HxDataSource<T>;
  /** Rows per page. */
  pageSize: number;
  /** Zero-based page index. */
  page: number;
  /** Active sorts, primary first. */
  sortModel: SortModelItem[];
  /** Active filters, keyed by column id. */
  filterModel: FilterModelMap;
  /**
   * Blocks to keep around so paging back and forth does not refetch.
   * @defaultValue 3
   */
  maxCachedBlocks?: number;
  /** Called when a fetch throws. Aborted requests are not reported. */
  onError?: (error: unknown) => void;
}

/**
 * What {@link useServerDataSource} returns.
 *
 * @typeParam T - The row type.
 */
export interface UseServerDataSourceResult<T> {
  /** Rows for the current page. Empty while the first fetch is in flight. */
  rows: T[];
  /** Total across all pages, from the response's `lastRow`. */
  totalRows: number;
  /** True while a fetch is in flight. */
  isLoading: boolean;
  /** The last error, or `null`. */
  error: unknown;
  /**
   * Re-fetch the current page.
   * @param options - `purge: true` drops every cached block first.
   */
  refresh: (options?: { purge?: boolean }) => void;
  /**
   * Patch loaded rows in place, matched by id. Ids that are not loaded are
   * ignored. No network request is made.
   */
  patchRows: (rows: T[], getRowId: (row: T) => string | number) => void;
}

function buildRequest(
  page: number,
  pageSize: number,
  sortModel: SortModelItem[],
  filterModel: FilterModelMap
): HxRowsRequest {
  return {
    startRow: page * pageSize,
    endRow: page * pageSize + pageSize,
    sortModel,
    filterModel,
    // Sent empty for wire compatibility with grid endpoints that expect them.
    rowGroupCols: [],
    valueCols: [],
    pivotCols: [],
    pivotMode: false,
    groupKeys: [],
  };
}

/**
 * Server-side paging with a small block cache.
 *
 * {@link DataGrid} uses this internally; call it directly only when building a
 * custom surface on top of the same data contract.
 *
 * @typeParam T - The row type.
 * @param options - Data source, page, sort and filters.
 * @returns The current page plus loading state and imperative helpers.
 *
 * @remarks
 * Every request carries an `AbortController` and a sequence number, so a slow
 * response for an old sort or filter can never overwrite a newer one. The cache
 * is dropped wholesale when the query changes, so stale blocks are never mixed
 * with fresh ones.
 *
 * @example
 * ```ts
 * const { rows, totalRows, isLoading, refresh } = useServerDataSource({
 *   dataSource,
 *   page: 0,
 *   pageSize: 50,
 *   sortModel: [{ colId: 'name', sort: 'asc' }],
 *   filterModel: {},
 * });
 * ```
 */
export function useServerDataSource<T>({
  dataSource,
  pageSize,
  page,
  sortModel,
  filterModel,
  maxCachedBlocks = 3,
  onError,
}: UseServerDataSourceOptions<T>): UseServerDataSourceResult<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Bumping this re-runs the effect without changing the query itself.
  const [refreshToken, setRefreshToken] = useState(0);

  const cacheRef = useRef(new Map<string, { rows: T[]; lastRow: number }>());
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // The query identity. Serialising the models keeps the effect from re-firing
  // on every render just because the caller rebuilt an equal object.
  const queryKey = useMemo(
    () => JSON.stringify({ pageSize, sortModel, filterModel }),
    [pageSize, sortModel, filterModel]
  );

  // Any change to the query invalidates every cached block.
  useEffect(() => {
    cacheRef.current.clear();
  }, [queryKey]);

  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const dataSourceRef = useRef(dataSource);
  useEffect(() => {
    dataSourceRef.current = dataSource;
  }, [dataSource]);

  useEffect(() => {
    const blockKey = `${queryKey}::${page}`;
    const cached = cacheRef.current.get(blockKey);
    if (cached) {
      setRows(cached.rows);
      setTotalRows(cached.lastRow);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    const request = buildRequest(page, pageSize, sortModel, filterModel);

    dataSourceRef.current
      .getRows(request, controller.signal)
      .then((response) => {
        // A response from a superseded request must never land.
        if (requestId !== requestIdRef.current) return;

        const lastRow = response.lastRow ?? response.rows.length;
        cacheRef.current.set(blockKey, { rows: response.rows, lastRow });

        // Evict oldest-first; Map preserves insertion order.
        while (cacheRef.current.size > maxCachedBlocks) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest === undefined) break;
          cacheRef.current.delete(oldest);
        }

        setRows(response.rows);
        setTotalRows(lastRow);
        setIsLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        setError(err);
        setIsLoading(false);
        onErrorRef.current?.(err);
      });

    return () => {
      controller.abort();
    };
  }, [queryKey, page, pageSize, sortModel, filterModel, refreshToken, maxCachedBlocks]);

  const refresh = useCallback((options?: { purge?: boolean }) => {
    if (options?.purge !== false) cacheRef.current.clear();
    setRefreshToken((token) => token + 1);
  }, []);

  const patchRows = useCallback(
    (updated: T[], getRowId: (row: T) => string | number) => {
      if (updated.length === 0) return;
      const byId = new Map(updated.map((row) => [getRowId(row), row]));

      const merge = (list: T[]) => {
        let changed = false;
        const next = list.map((row) => {
          const replacement = byId.get(getRowId(row));
          if (!replacement) return row;
          changed = true;
          return replacement;
        });
        return changed ? next : list;
      };

      setRows(merge);
      // Keep the cache consistent, or paging away and back would resurrect the
      // pre-save row.
      for (const [key, block] of cacheRef.current) {
        cacheRef.current.set(key, { ...block, rows: merge(block.rows) });
      }
    },
    []
  );

  return { rows, totalRows, isLoading, error, refresh, patchRows };
}
