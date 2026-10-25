import { useMemo, useState } from 'react';
import { DataGrid, type HxRowsRequest } from '@helix-x/datagrid-ui';
import { fetchStocks } from '../../api';
import { Banner } from '../../layout/Banner';
import { useTheme, DENSITY } from '../../theme';
import type { Stock } from '../../types';
import { columns } from './columns';

const GROUP_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'sector', label: 'Sector' },
  { value: 'exchange', label: 'Exchange' },
  { value: 'rating', label: 'Rating' },
];

/**
 * Single-level grouping, resolved by the server: group rows with aggregates,
 * and each group's rows fetched as it is opened.
 */
export function GroupingExample() {
  const { density } = useTheme();
  const [banner, setBanner] = useState<string | null>(null);

  // #region grouping-data-source
  // The same data source as every other example: the grouping fields simply
  // travel in the request, and the server answers group rows or a group's rows.
  const dataSource = useMemo(
    () => ({
      getRows: (request: HxRowsRequest, signal: AbortSignal) =>
        fetchStocks(request, signal),
    }),
    []
  );
  // #endregion

  // #region grouping-grid
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {banner && <Banner onDismiss={() => setBanner(null)}>{banner}</Banner>}

      <DataGrid<Stock>
        columns={columns}
        dataSource={dataSource}
        getRowId={(row) => row.symbol}
        storageKey="example-grouping"
        // Grouped on first visit; the user's own choice is persisted after that.
        defaultRowGroupColId="sector"
        // Rows fetched each time a group is opened or "Load more" is used.
        groupChildBlockSize={25}
        toolbar={(api) => (
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            Group by
            <select
              className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-900"
              value={api.getRowGroup() ?? ''}
              onChange={(event) => api.setRowGroup(event.target.value || null)}
            >
              {GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        height="100%"
        rowHeight={DENSITY[density].rowHeight}
        headerHeight={DENSITY[density].headerHeight}
        defaultPageSize={20}
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
