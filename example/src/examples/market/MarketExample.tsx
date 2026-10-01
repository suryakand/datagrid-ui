import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DataGrid,
  type GridApi,
  type HxRowsRequest,
  type RowCommitResult,
} from '@helix-x/datagrid-ui';
import { ValidationError, fetchStocks, saveStock } from '../../api';
import { Banner } from '../../layout/Banner';
import { useTheme, DENSITY } from '../../theme';
import type { Stock } from '../../types';
import { columns, type GridContext } from './columns';

/*
 * Two rules decided per row, from its data. A SELL-rated stock cannot be
 * selected -- its checkbox becomes a padlock, and shift-ranges and select-all
 * step over it -- and it carries a background of its own in place of the
 * stripe. The colour is opaque, as a row colour must be: the sticky checkbox
 * and pinned cells paint the row's background.
 */
// #region row-rules
const SELL_ROW =
  'bg-error-50 dark:bg-[color-mix(in_srgb,var(--color-error-500)_12%,var(--color-gray-900))]';

const isRowSelectable = (row: Stock) => row.rating !== 'SELL';
const getRowClassName = (row: Stock) => (row.rating === 'SELL' ? SELL_ROW : '');
// #endregion

/**
 * The full server-side contract: paging, sorting, four filter kinds and
 * inline editing with server-side validation.
 */
export function MarketExample() {
  const apiRef = useRef<GridApi<Stock>>(null);
  const { density } = useTheme();
  const [savingSymbol, setSavingSymbol] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);

  // Memoised on [] so local state changes never trigger a refetch.
  // #region data-source
  const dataSource = useMemo(
    () => ({
      getRows: (request: HxRowsRequest, signal: AbortSignal) =>
        fetchStocks(request, signal),
    }),
    []
  );
  // #endregion

  const toggleWatchlist = useCallback(async (row: Stock) => {
    setSavingSymbol(row.symbol);
    try {
      const updated = await saveStock(row.symbol, { onWatchlist: !row.onWatchlist });
      // Patch in place — no round trip, no scroll jump.
      apiRef.current?.updateRows([updated]);
    } catch (error) {
      setBanner(error instanceof Error ? error.message : 'Could not update watchlist');
    } finally {
      setSavingSymbol(null);
    }
  }, []);

  const context = useMemo<GridContext>(
    () => ({ savingSymbol, onToggleWatchlist: toggleWatchlist }),
    [savingSymbol, toggleWatchlist]
  );

  /*
   * Returning `{ ok: false, errors }` keeps the row open and paints the
   * messages onto the offending cells. Try typing "TODO" into a note.
   */
  // #region row-commit
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
  // #endregion

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {banner && <Banner onDismiss={() => setBanner(null)}>{banner}</Banner>}
      {selectedCount > 0 && (
        <p className="text-xs text-brand-600 dark:text-brand-400">
          {selectedCount} selected — the toolbar's Export CSV honours the selection.
          SELL-rated rows are locked and cannot be selected.
        </p>
      )}

      <DataGrid<Stock, GridContext>
        columns={columns}
        dataSource={dataSource}
        getRowId={(row) => row.symbol}
        context={context}
        apiRef={apiRef}
        storageKey="example-market"
        height="100%"
        rowHeight={DENSITY[density].rowHeight}
        headerHeight={DENSITY[density].headerHeight}
        defaultPageSize={50}
        pageSizeOptions={[20, 50, 100, 200]}
        selectable
        isRowSelectable={isRowSelectable}
        getRowClassName={getRowClassName}
        floatingFilter
        exportFileName="stocks"
        onRowCommit={handleRowCommit}
        onSelectionChanged={(ids) => setSelectedCount(ids.length)}
        onError={(error) =>
          setBanner(error instanceof Error ? error.message : 'Request failed')
        }
        emptyMessage="No symbols match these filters."
        className="min-h-0 flex-1 shadow-sm"
        toolbar={(api) => (
          <>
            <button type="button" onClick={() => api.refresh({ purge: true })} className={TOOLBAR_BUTTON}>
              Refresh prices
            </button>
            <button
              type="button"
              onClick={() =>
                api.setFilterModel({
                  changePct: { filterType: 'number', type: 'greaterThan', filter: 0 },
                })
              }
              className={TOOLBAR_BUTTON}
            >
              Gainers only
            </button>
            <button type="button" onClick={() => api.setFilterModel({})} className={TOOLBAR_BUTTON}>
              Clear filters
            </button>
          </>
        )}
      />
    </div>
  );
}

const TOOLBAR_BUTTON =
  'rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 ' +
  'dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5';
