import type { ColumnDef } from '@helix-x/datagrid-ui';
import { fetchSectors } from '../../api';
import type { Stock } from '../../types';
import { AnalystAvatar, CompanyLogo } from './CompanyLogo';

export interface PortfolioContext {
  /** Largest market cap on the page, so the bar has something to scale to. */
  maxMarketCap: number;
}

const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export const portfolioColumns: ColumnDef<Stock, PortfolioContext>[] = [
  {
    // A two-line identity cell: logo, company name, ticker. The `field` still
    // points at `name`, so server-side sorting and filtering keep working even
    // though the cell renders something composite.
    // #region identity-cell
    field: 'name',
    header: 'Holding',
    headerName: 'Company',
    flex: 2,
    minWidth: 240,
    pinned: 'left',
    filter: 'text',
    cellRenderer: ({ row }) => (
      <div className="flex items-center gap-2.5 py-1">
        <CompanyLogo symbol={row.symbol} size={30} />
        <div className="min-w-0 leading-tight">
          <div className="truncate font-medium text-gray-900 dark:text-gray-100">
            {row.name}
          </div>
          <div className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
            {row.symbol} · {row.exchange}
          </div>
        </div>
      </div>
    ),
    // The cell is two lines of markup; the export gets one clean field.
    exportValue: (row) => `${row.name} (${row.symbol})`,
    // #endregion
  },
  {
    field: 'sector',
    header: 'Sector',
    width: 165,
    filter: 'set',
    filterParams: { values: fetchSectors },
  },
  {
    field: 'analyst',
    header: 'Covering analyst',
    width: 190,
    filter: 'text',
    cellRenderer: ({ row }) => (
      <div className="flex items-center gap-2">
        <AnalystAvatar name={row.analyst} size={24} />
        <span className="truncate">{row.analyst}</span>
      </div>
    ),
  },
  {
    field: 'price',
    header: 'Last',
    width: 105,
    align: 'right',
    filter: 'number',
    valueFormatter: (value) => money.format(Number(value)),
  },
  {
    field: 'marketCap',
    header: 'Market cap',
    width: 210,
    filter: 'number',
    cellRenderer: ({ row, context }) => {
      const share = context.maxMarketCap
        ? Math.max(2, (row.marketCap / context.maxMarketCap) * 100)
        : 0;
      return (
        <div className="flex w-full items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
              style={{ width: `${share}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-gray-600 dark:text-gray-300">
            ${compact.format(row.marketCap)}
          </span>
        </div>
      );
    },
    exportValue: (row) => String(row.marketCap),
  },
  {
    field: 'rating',
    header: 'Rating',
    width: 105,
    filter: 'set',
    filterParams: { values: ['BUY', 'HOLD', 'SELL'] },
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
];
