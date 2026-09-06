import type { ColumnDef } from '@helix-x/datagrid-ui';
import type { Stock } from '../../types';

export type FlashDirection = 'up' | 'down';

export interface LiveContext {
  /** Symbols that repriced in the last moment, and which way they moved. */
  flash: Record<string, FlashDirection | undefined>;
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const time = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export const liveColumns: ColumnDef<Stock, LiveContext>[] = [
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
  { field: 'name', header: 'Company', flex: 1, minWidth: 170, filter: 'text' },
  {
    // #region flash-cell
    field: 'price',
    header: 'Last',
    width: 130,
    align: 'right',
    filter: 'number',
    cellRenderer: ({ row, context }) => {
      // The flash lives in `context`, so a tick repaints cells without
      // rebuilding a single column definition.
      const direction = context.flash[row.symbol];
      const tone =
        direction === 'up'
          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
          : direction === 'down'
            ? 'bg-error-500/20 text-error-700 dark:text-error-300'
            : 'bg-transparent';
      return (
        <span
          className={`rounded px-1.5 py-0.5 font-medium tabular-nums transition-colors duration-500 ${tone}`}
        >
          {money.format(row.price)}
        </span>
      );
    },
    exportValue: (row) => row.price.toFixed(2),
    // #endregion
  },
  {
    field: 'changePct',
    header: 'Change %',
    width: 115,
    align: 'right',
    filter: 'number',
    cellRenderer: ({ row }) => {
      const up = row.changePct >= 0;
      return (
        <span
          className={
            up
              ? 'font-medium tabular-nums text-emerald-600 dark:text-emerald-400'
              : 'font-medium tabular-nums text-error-600 dark:text-error-500'
          }
        >
          {up ? '▲' : '▼'} {Math.abs(row.changePct).toFixed(2)}%
        </span>
      );
    },
    exportValue: (row) => row.changePct.toFixed(2),
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
    field: 'lastTrade',
    header: 'Tick',
    width: 110,
    align: 'right',
    filter: false,
    sortable: false,
    valueFormatter: (value) => (value ? time.format(new Date(String(value))) : ''),
  },
];
