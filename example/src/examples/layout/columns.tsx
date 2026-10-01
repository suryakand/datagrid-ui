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
  {
    field: 'symbol',
    header: 'Symbol',
    width: 100,
    pinned: 'left',
    // Stays first: it cannot be dragged, and nothing can be dropped onto it.
    lockPosition: true,
    filter: 'text',
  },
  {
    // #region size-limits
    field: 'name',
    header: 'Company',
    width: 220,
    // A resize drag stops at these bounds instead of letting the column
    // collapse to nothing or swallow the viewport.
    minWidth: 160,
    maxWidth: 320,
    filter: 'text',
    // #endregion
  },
  { field: 'sector', header: 'Sector', width: 150, filter: 'text' },
  {
    // #region hidden-by-default
    field: 'exchange',
    header: 'Exchange',
    width: 110,
    filter: 'text',
    // Starts hidden but keeps its slot in the column order, so showing it
    // from the Columns panel puts it back where it was declared.
    hide: true,
    // #endregion
  },
  {
    field: 'price',
    header: 'Last',
    width: 110,
    minWidth: 90,
    maxWidth: 160,
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
  {
    field: 'volume',
    header: 'Volume',
    width: 110,
    align: 'right',
    hide: true,
    filter: 'number',
    valueFormatter: (value) => compact.format(Number(value)),
  },
  {
    field: 'marketCap',
    header: 'Market cap',
    width: 120,
    align: 'right',
    filter: 'number',
    valueFormatter: (value) => `$${compact.format(Number(value))}`,
  },
  { field: 'notes', header: 'Notes', width: 220, minWidth: 120, filter: 'text' },
  {
    // #region pin-right
    field: 'analyst',
    header: 'Analyst',
    width: 140,
    // Right-pinned columns stick to the far edge while the middle scrolls.
    pinned: 'right',
    filter: 'text',
    // #endregion
  },
];
