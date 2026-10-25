import type { ColumnDef } from '@helix-x/datagrid-ui';
import type { Stock } from '../../types';

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const columns: ColumnDef<Stock>[] = [
  { field: 'symbol', header: 'Symbol', width: 180, pinned: 'left', filter: 'text' },
  { field: 'name', header: 'Company', width: 220, filter: 'text' },
  // #region groupable-columns
  // Offered in the ⋮ menu as "Group by this column".
  { field: 'sector', header: 'Sector', width: 160, filter: 'text', enableRowGroup: true },
  { field: 'exchange', header: 'Exchange', width: 110, filter: 'text', enableRowGroup: true },
  { field: 'rating', header: 'Rating', width: 100, enableRowGroup: true },
  // #endregion
  // #region aggregated-columns
  {
    field: 'price',
    header: 'Last (avg)',
    width: 120,
    align: 'right',
    // Asked of the server while grouped; the group row's value comes back
    // under `price` and goes through the same formatter as a normal row.
    aggFunc: 'avg',
    valueFormatter: (value) => (value == null ? '' : money.format(Number(value))),
  },
  {
    field: 'volume',
    header: 'Volume',
    width: 120,
    align: 'right',
    aggFunc: 'sum',
    valueFormatter: (value) => (value == null ? '' : compact.format(Number(value))),
  },
  {
    field: 'marketCap',
    header: 'Market cap',
    width: 130,
    align: 'right',
    aggFunc: 'sum',
    valueFormatter: (value) => (value == null ? '' : compact.format(Number(value))),
  },
  // #endregion
];
