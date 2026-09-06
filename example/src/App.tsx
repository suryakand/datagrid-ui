import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DataGrid,
  type GridApi,
  type HxRowsRequest,
  type RowCommitResult,
} from '@helix-x/datagrid-ui';
import { ValidationError, fetchStocks, saveStock } from './api';
import { columns, type GridContext } from './columns';
import type { Stock } from './types';

export function App() {
  const apiRef = useRef<GridApi<Stock>>(null);
  const [savingSymbol, setSavingSymbol] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);

  /*
   * The data source is the whole server-side contract: one function that
   * turns the grid's request into a fetch. Memoised on [] so changing local
   * state never causes a refetch.
   */
  const dataSource = useMemo(
    () => ({
      getRows: (request: HxRowsRequest, signal: AbortSignal) =>
        fetchStocks(request, signal),
    }),
    []
  );

  const toggleWatchlist = useCallback(async (row: Stock) => {
    setSavingSymbol(row.symbol);
    try {
      const updated = await saveStock(row.symbol, { onWatchlist: !row.onWatchlist });
      // Patch the row in place — no round trip, no scroll jump.
      apiRef.current?.updateRows([updated]);
    } catch (error) {
      setBanner(error instanceof Error ? error.message : 'Could not update watchlist');
    } finally {
      setSavingSymbol(null);
    }
  }, []);

  /* Rebuilt whenever the volatile bits change; columns never are. */
  const context = useMemo<GridContext>(
    () => ({ savingSymbol, onToggleWatchlist: toggleWatchlist }),
    [savingSymbol, toggleWatchlist]
  );

  /*
   * Returning `{ ok: false, errors }` keeps the row in edit mode and paints
   * the messages onto the offending cells. Try typing "TODO" into a note.
   */
  const handleRowCommit = useCallback(
    async (draft: Stock): Promise<RowCommitResult> => {
      try {
        const updated = await saveStock(draft.symbol, {
          rating: draft.rating,
          notes: draft.notes,
          onWatchlist: draft.onWatchlist,
        });
        setBanner(`Saved ${updated.symbol}`);
        return { ok: true, row: updated };
      } catch (error) {
        if (error instanceof ValidationError) {
          return { ok: false, errors: error.errors, message: error.message };
        }
        return {
          ok: false,
          errors: {},
          message: error instanceof Error ? error.message : 'Save failed',
        };
      }
    },
    []
  );

  return (
    <div className="flex h-full flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h1 className="text-base font-semibold">Stock Market</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          480 symbols served from a mock API — paging, sorting and filtering all
          happen server-side.
        </p>
        {selectedCount > 0 && (
          <span className="ml-auto text-xs text-brand-600 dark:text-brand-400">
            {selectedCount} selected
          </span>
        )}
      </header>

      {banner && (
        <div className="flex items-center gap-2 border-b border-brand-200 bg-brand-25 px-4 py-1.5 text-xs text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
          {banner}
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="ml-auto rounded px-1.5 hover:bg-black/5 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      )}

      <main className="min-h-0 flex-1 p-4">
        <DataGrid<Stock, GridContext>
          columns={columns}
          dataSource={dataSource}
          getRowId={(row) => row.symbol}
          context={context}
          apiRef={apiRef}
          storageKey="stock-market-grid"
          height="100%"
          defaultPageSize={50}
          pageSizeOptions={[20, 50, 100, 200]}
          selectable
          floatingFilter
          exportFileName="stocks"
          onRowCommit={handleRowCommit}
          onSelectionChanged={(ids) => setSelectedCount(ids.length)}
          onError={(error) =>
            setBanner(error instanceof Error ? error.message : 'Request failed')
          }
          emptyMessage="No symbols match these filters."
          className="shadow-sm"
          toolbar={(api) => (
            <>
              <button
                type="button"
                onClick={() => api.refresh({ purge: true })}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-white/5"
              >
                Refresh prices
              </button>
              <button
                type="button"
                onClick={() =>
                  api.setFilterModel({
                    changePct: { filterType: 'number', type: 'greaterThan', filter: 0 },
                  })
                }
                className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-white/5"
              >
                Gainers only
              </button>
              <button
                type="button"
                onClick={() => api.setFilterModel({})}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-white/5"
              >
                Clear filters
              </button>
            </>
          )}
        />
      </main>
    </div>
  );
}
