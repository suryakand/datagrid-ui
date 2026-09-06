import { useMemo, useRef, useState } from 'react';
import { DataGrid, type GridApi, type HxRowsRequest } from '@helix-x/datagrid-ui';
import { fetchStocks } from '../../api';
import type { Stock } from '../../types';
import { portfolioColumns, type PortfolioContext } from './columns';

/**
 * Images in rows. Every logo and avatar is a real HTTP request to the mock
 * server, so this is also the example that shows what a grid full of <img>
 * actually behaves like.
 */
export function PortfolioExample() {
  const apiRef = useRef<GridApi<Stock>>(null);
  const [maxMarketCap, setMaxMarketCap] = useState(0);
  const [rowHeight, setRowHeight] = useState(52);

  const dataSource = useMemo(
    () => ({
      getRows: async (request: HxRowsRequest, signal: AbortSignal) => {
        const response = await fetchStocks(request, signal);
        // Scale the allocation bars to the largest holding on this page.
        setMaxMarketCap(
          response.rows.reduce((max, row) => Math.max(max, row.marketCap), 0)
        );
        return response;
      },
    }),
    []
  );

  const context = useMemo<PortfolioContext>(() => ({ maxMarketCap }), [maxMarketCap]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <DataGrid<Stock, PortfolioContext>
        columns={portfolioColumns}
        dataSource={dataSource}
        getRowId={(row) => row.symbol}
        context={context}
        apiRef={apiRef}
        storageKey="example-portfolio"
        height="100%"
        // Images need the row to be tall enough to hold them; the grid's
        // rows are a fixed height, which is what keeps virtualization cheap.
        rowHeight={rowHeight}
        headerHeight={38}
        defaultPageSize={25}
        pageSizeOptions={[10, 25, 50, 100]}
        selectable={false}
        floatingFilter
        exportFileName="holdings"
        emptyMessage="No holdings match these filters."
        className="min-h-0 flex-1 shadow-sm"
        toolbar={() => (
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            Row height
            <input
              type="range"
              min={40}
              max={80}
              step={4}
              value={rowHeight}
              onChange={(event) => setRowHeight(Number(event.target.value))}
              className="accent-brand-500"
            />
            <span className="w-8 tabular-nums">{rowHeight}px</span>
          </label>
        )}
      />
    </div>
  );
}
