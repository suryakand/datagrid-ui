import { useEffect, useMemo, useRef, useState } from 'react';
import { DataGrid, type GridApi, type HxRowsRequest } from '@helix-x/datagrid-ui';
import { fetchStocks } from '../../api';
import { useTheme, DENSITY } from '../../theme';
import type { Stock } from '../../types';
import { liveColumns, type FlashDirection, type LiveContext } from './columns';

/** How long a repriced cell stays tinted. */
const FLASH_MS = 600;

/**
 * A live feed driven by server-sent events.
 *
 * The important part is that a tick never refetches. The stream hands us whole
 * rows, `api.updateRows` patches the ones currently on screen by id, and the
 * user's scroll position, selection, sort and open editor are all untouched.
 * Symbols that are not on the current page are simply ignored.
 */
export function LiveExample() {
  const apiRef = useRef<GridApi<Stock>>(null);
  const { density } = useTheme();

  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ticks, setTicks] = useState(0);
  const [flash, setFlash] = useState<Record<string, FlashDirection | undefined>>({});

  // Read inside the event handler, which is created once and must not close
  // over a stale `paused`.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Last price we displayed per symbol, to decide the flash direction.
  const lastPriceRef = useRef(new Map<string, number>());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dataSource = useMemo(
    () => ({
      getRows: (request: HxRowsRequest, signal: AbortSignal) =>
        fetchStocks(request, signal),
    }),
    []
  );

  // #region sse-subscribe
  useEffect(() => {
    const source = new EventSource('/api/stream');
    const timers = timersRef.current;

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.onmessage = (event) => {
      if (pausedRef.current) return;

      let batch: Stock[];
      try {
        batch = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!Array.isArray(batch) || batch.length === 0) return;

      const directions: Record<string, FlashDirection> = {};
      for (const row of batch) {
        const previous = lastPriceRef.current.get(row.symbol);
        if (previous !== undefined && previous !== row.price) {
          directions[row.symbol] = row.price > previous ? 'up' : 'down';
        }
        lastPriceRef.current.set(row.symbol, row.price);
      }

      // Patch the rows on screen. No network, no re-sort, no scroll jump.
      apiRef.current?.updateRows(batch);
      setTicks((count) => count + batch.length);

      if (Object.keys(directions).length === 0) return;
      setFlash((current) => ({ ...current, ...directions }));

      for (const symbol of Object.keys(directions)) {
        clearTimeout(timers.get(symbol));
        timers.set(
          symbol,
          setTimeout(() => {
            setFlash(({ [symbol]: _cleared, ...rest }) => rest);
            timers.delete(symbol);
          }, FLASH_MS)
        );
      }
    };

    return () => {
      source.close();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);
  // #endregion

  const context = useMemo<LiveContext>(() => ({ flash }), [flash]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <DataGrid<Stock, LiveContext>
        columns={liveColumns}
        dataSource={dataSource}
        getRowId={(row) => row.symbol}
        context={context}
        apiRef={apiRef}
        storageKey="example-live"
        height="100%"
        rowHeight={DENSITY[density].rowHeight}
        headerHeight={DENSITY[density].headerHeight}
        defaultPageSize={50}
        pageSizeOptions={[25, 50, 100]}
        selectable={false}
        floatingFilter
        exportFileName="live-prices"
        emptyMessage="No symbols match these filters."
        className="min-h-0 flex-1 shadow-sm"
        toolbar={() => (
          <>
            <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  connected && !paused
                    ? 'animate-pulse bg-emerald-500'
                    : connected
                      ? 'bg-amber-500'
                      : 'bg-gray-400'
                }`}
              />
              {!connected ? 'Disconnected' : paused ? 'Paused' : 'Streaming'}
            </span>
            <button
              type="button"
              onClick={() => setPaused((current) => !current)}
              className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5"
            >
              {paused ? 'Resume feed' : 'Pause feed'}
            </button>
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {ticks.toLocaleString()} row updates received
            </span>
          </>
        )}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Sort by <span className="font-medium">Last</span>, scroll, or open a filter
        — the feed keeps patching rows underneath without disturbing any of it.
      </p>
    </div>
  );
}
