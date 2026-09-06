import type { ColumnDef } from '@helix-x/datagrid-ui';
import { fetchExchanges, fetchSectors } from '../../api';
import type { Stock } from '../../types';

/**
 * Volatile app state. Anything that changes at runtime belongs here rather
 * than baked into a column, so the definitions below can be module constants
 * that never rebuild.
 */
export interface GridContext {
  savingSymbol: string | null;
  onToggleWatchlist: (row: Stock) => void;
}

/* -------------------------------------------------------------------------- */
/* Formatters                                                                 */
/* -------------------------------------------------------------------------- */

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat('en-US');

const formatDateTime = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }) : '';

/* -------------------------------------------------------------------------- */
/* Columns                                                                    */
/* -------------------------------------------------------------------------- */

export const columns: ColumnDef<Stock, GridContext>[] = [
  {
    field: 'symbol',
    header: 'Symbol',
    headerName: 'Symbol',
    width: 100,
    pinned: 'left',
    lockPosition: true,
    filter: 'text',
    cellRenderer: ({ value }) => (
      <span className="font-mono font-semibold tracking-wide text-gray-900 dark:text-gray-100">
        {String(value)}
      </span>
    ),
  },
  {
    field: 'name',
    header: 'Company',
    flex: 2,
    minWidth: 180,
    filter: 'text',
  },
  {
    // #region set-filter-async
    field: 'sector',
    header: 'Sector',
    width: 170,
    filter: 'set',
    // A function makes the popover load its options from the API the first
    // time it opens, instead of hard-coding them in the client.
    filterParams: { values: fetchSectors },
    // #endregion
  },
  {
    field: 'exchange',
    header: 'Exchange',
    width: 110,
    filter: 'set',
    filterParams: { values: fetchExchanges },
  },
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
    width: 120,
    align: 'right',
    filter: 'number',
    cellRenderer: ({ row }) => {
      const up = row.changePct >= 0;
      return (
        <span
          className={
            up
              ? 'font-medium text-emerald-600 dark:text-emerald-400'
              : 'font-medium text-error-600 dark:text-error-500'
          }
        >
          {up ? '▲' : '▼'} {Math.abs(row.changePct).toFixed(2)}%
        </span>
      );
    },
    // The renderer above is markup; exports need the plain number.
    exportValue: (row) => row.changePct.toFixed(2),
  },
  {
    field: 'change',
    header: 'Change',
    width: 110,
    align: 'right',
    hide: true,
    filter: 'number',
    valueFormatter: (value) => money.format(Number(value)),
  },
  {
    field: 'volume',
    header: 'Volume',
    width: 120,
    align: 'right',
    filter: 'number',
    valueFormatter: (value) => compact.format(Number(value)),
    exportValue: (row) => String(row.volume),
  },
  {
    field: 'marketCap',
    header: 'Market cap',
    width: 130,
    align: 'right',
    filter: 'number',
    valueFormatter: (value) => `$${compact.format(Number(value))}`,
    exportValue: (row) => String(row.marketCap),
  },
  {
    field: 'peRatio',
    header: 'P/E',
    width: 90,
    align: 'right',
    filter: 'number',
    // Null P/E is meaningful (no earnings), so it renders as an em dash
    // rather than 0 — and the blank / notBlank filters can find them.
    valueFormatter: (value) =>
      value === null || value === undefined ? '—' : Number(value).toFixed(1),
  },
  {
    field: 'dividendYield',
    header: 'Yield',
    width: 90,
    align: 'right',
    filter: 'number',
    valueFormatter: (value) => (Number(value) === 0 ? '—' : `${Number(value).toFixed(2)}%`),
  },
  {
    // Derived, so there is no `field` to sort or filter on server-side.
    colId: 'range52',
    header: '52w range',
    width: 150,
    sortable: false,
    filter: false,
    valueGetter: (row) => `${row.low52}-${row.high52}`,
    cellRenderer: ({ row }) => {
      const span = Math.max(row.high52 - row.low52, 0.01);
      const position = Math.min(100, Math.max(0, ((row.price - row.low52) / span) * 100));
      return (
        <div className="flex w-full items-center gap-2">
          <span className="w-12 shrink-0 text-right text-[11px] text-gray-500 tabular-nums">
            {integer.format(row.low52)}
          </span>
          <div className="relative h-1 flex-1 rounded bg-gray-200 dark:bg-gray-700">
            <span
              className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded bg-brand-500"
              style={{ left: `${position}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-[11px] text-gray-500 tabular-nums">
            {integer.format(row.high52)}
          </span>
        </div>
      );
    },
    exportValue: (row) => `${row.low52} - ${row.high52}`,
  },
  {
    field: 'lastTrade',
    header: 'Last trade',
    width: 170,
    filter: 'date',
    valueFormatter: formatDateTime,
  },
  {
    // #region editable-select
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
    // #endregion
    cellRenderer: ({ row }) => {
      const tone =
        row.rating === 'BUY'
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
          : row.rating === 'SELL'
            ? 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-300'
            : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300';
      return (
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}>
          {row.rating}
        </span>
      );
    },
  },
  {
    field: 'onWatchlist',
    header: 'Watch',
    width: 90,
    align: 'center',
    filter: false,
    editable: true,
    editor: 'checkbox',
    cellRenderer: ({ row, context }) => (
      <button
        type="button"
        // `context` is how a renderer reaches live app state without the
        // column definition itself ever being rebuilt.
        disabled={context.savingSymbol === row.symbol}
        onClick={() => context.onToggleWatchlist(row)}
        className="text-base leading-none disabled:opacity-40"
        title={row.onWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
      >
        {row.onWatchlist ? '★' : '☆'}
      </button>
    ),
    exportValue: (row) => (row.onWatchlist ? 'yes' : 'no'),
  },
  {
    field: 'analyst',
    header: 'Analyst',
    width: 140,
    hide: true,
    filter: 'text',
  },
  {
    field: 'notes',
    header: 'Notes',
    flex: 1,
    minWidth: 160,
    filter: 'text',
    editable: true,
    editor: 'text',
    editorParams: { placeholder: 'Desk note…' },
  },
];
