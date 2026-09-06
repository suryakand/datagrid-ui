import type { ColumnDef } from '@helix-x/datagrid-ui';
import type { Stock } from '../../types';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * Deliberately plain. Nothing here mentions a colour — the accent arrives
 * entirely through the `brand` utilities the grid itself uses for selection,
 * focus rings, the pager and the filter chrome.
 */
export const themingColumns: ColumnDef<Stock>[] = [
  {
    field: 'symbol',
    header: 'Symbol',
    width: 100,
    pinned: 'left',
    filter: 'text',
    cellRenderer: ({ value }) => (
      <span className="font-mono font-semibold">{String(value)}</span>
    ),
  },
  { field: 'name', header: 'Company', flex: 1, minWidth: 160, filter: 'text' },
  { field: 'sector', header: 'Sector', width: 160, filter: 'text' },
  {
    field: 'price',
    header: 'Last',
    width: 110,
    align: 'right',
    filter: 'number',
    valueFormatter: (value) => money.format(Number(value)),
  },
  {
    field: 'volume',
    header: 'Volume',
    width: 110,
    align: 'right',
    filter: 'number',
    valueFormatter: (value) => compact.format(Number(value)),
    exportValue: (row) => String(row.volume),
  },
  {
    field: 'rating',
    header: 'Rating',
    width: 110,
    filter: 'set',
    filterParams: { values: ['BUY', 'HOLD', 'SELL'] },
    editable: true,
    editor: 'select',
    editorParams: {
      options: [
        { label: 'Buy', value: 'BUY' },
        { label: 'Hold', value: 'HOLD' },
        { label: 'Sell', value: 'SELL' },
      ],
    },
  },
];
