import { useMemo, useState } from 'react';
import { DataGrid, type HxRowsRequest } from '@helix-x/datagrid-ui';
import { fetchStocks } from '../../api';
import { Banner } from '../../layout/Banner';
import { useTheme, DENSITY } from '../../theme';
import type { Stock } from '../../types';
import { columns } from './columns';

/**
 * Column sizing, ordering, visibility and pinning, all saved under one
 * storage key.
 */
export function LayoutExample() {
  const { density } = useTheme();
  const [banner, setBanner] = useState<string | null>(null);

  const dataSource = useMemo(
    () => ({
      getRows: (request: HxRowsRequest, signal: AbortSignal) =>
        fetchStocks(request, signal),
    }),
    []
  );

  // #region layout-grid
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {banner && <Banner onDismiss={() => setBanner(null)}>{banner}</Banner>}

      <DataGrid<Stock>
        columns={columns}
        dataSource={dataSource}
        getRowId={(row) => row.symbol}
        // Width, order, visibility and pinning survive a reload. The Columns
        // panel's "Reset to defaults" returns to the definitions above.
        storageKey="example-layout"
        // Text columns get a search box under the header; the × inside it
        // clears that column's filter.
        floatingFilter
        height="100%"
        rowHeight={DENSITY[density].rowHeight}
        headerHeight={DENSITY[density].headerHeight}
        defaultPageSize={50}
        onError={(error) =>
          setBanner(error instanceof Error ? error.message : 'Request failed')
        }
        emptyMessage="No symbols match these filters."
        className="min-h-0 flex-1 shadow-sm"
      />
    </div>
  );
  // #endregion
}
