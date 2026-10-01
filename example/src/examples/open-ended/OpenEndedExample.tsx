import { useMemo, useState } from 'react';
import { DataGrid, type ColumnDef, type HxRowsRequest } from '@helix-x/datagrid-ui';
import { fetchStocksUncounted } from '../../api';
import { Banner } from '../../layout/Banner';
import { useTheme, DENSITY } from '../../theme';
import type { Stock } from '../../types';

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const columns: ColumnDef<Stock>[] = [
  { field: 'symbol', header: 'Symbol', width: 100, pinned: 'left', filter: 'text' },
  { field: 'name', header: 'Company', flex: 2, minWidth: 180, filter: 'text' },
  { field: 'sector', header: 'Sector', width: 170, filter: 'text' },
  {
    field: 'price',
    header: 'Last',
    width: 110,
    align: 'right',
    filter: 'number',
    valueFormatter: (value) => money.format(Number(value)),
  },
  {
    field: 'changePct',
    header: 'Change %',
    width: 110,
    align: 'right',
    filter: 'number',
    valueFormatter: (value) => `${Number(value).toFixed(2)}%`,
  },
];

/**
 * A backend that pages but never counts. The pager shows "of many", keeps
 * Next enabled while pages come back full, and treats a short page as the end.
 */
export function OpenEndedExample() {
  const { density } = useTheme();
  const [banner, setBanner] = useState<string | null>(null);

  // #region uncounted-source
  const dataSource = useMemo(
    () => ({
      // The response carries `lastRow: -1`; nothing else changes on the client.
      getRows: (request: HxRowsRequest, signal: AbortSignal) =>
        fetchStocksUncounted(request, signal),
    }),
    []
  );
  // #endregion

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {banner && <Banner onDismiss={() => setBanner(null)}>{banner}</Banner>}

      <DataGrid<Stock>
        columns={columns}
        dataSource={dataSource}
        getRowId={(row) => row.symbol}
        height="100%"
        rowHeight={DENSITY[density].rowHeight}
        headerHeight={DENSITY[density].headerHeight}
        defaultPageSize={50}
        pageSizeOptions={[25, 50, 100]}
        selectable={false}
        floatingFilter
        onError={(error) =>
          setBanner(error instanceof Error ? error.message : 'Request failed')
        }
        emptyMessage="No symbols match these filters."
        className="min-h-0 flex-1 shadow-sm"
        toolbar={(api) => (
          <>
            <button
              type="button"
              onClick={() =>
                api.setFilterModel({
                  sector: { filterType: 'text', type: 'equals', filter: 'Technology' },
                })
              }
              className={TOOLBAR_BUTTON}
            >
              Technology only
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
