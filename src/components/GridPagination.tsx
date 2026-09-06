/** Props for {@link GridPagination}. */
export interface GridPaginationProps {
  /** Zero-based current page. */
  page: number;
  /** Rows per page. */
  pageSize: number;
  /** Total across all pages. `-1` when the server reported it as unknown. */
  totalRows: number;
  /** Page sizes to offer in the selector. */
  pageSizeOptions: number[];
  /** Disables the controls while a fetch is in flight. */
  isLoading: boolean;
  /** Called with the new zero-based page index. */
  onPageChange: (page: number) => void;
  /** Called with the new page size. */
  onPageSizeChange: (pageSize: number) => void;
}

const BUTTON_CLASS =
  'rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 transition-colors ' +
  'hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 ' +
  'dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5';

/**
 * The grid's pager: range summary, page size selector and navigation.
 *
 * {@link DataGrid} renders this itself. It is exported for apps that build a
 * custom surface on the same hooks.
 */
export function GridPagination({
  page,
  pageSize,
  totalRows,
  pageSizeOptions,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: GridPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const first = totalRows === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(totalRows, (page + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800/60">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-600 dark:text-gray-300">
          Rows
          <select
            className="ml-1 rounded border border-gray-300 bg-white px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <span className="text-xs text-gray-600 dark:text-gray-300">
          {isLoading ? 'Loading...' : `${first}-${last} of ${totalRows}`}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={page === 0}
          onClick={() => onPageChange(0)}
        >
          « First
        </button>
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          ‹ Prev
        </button>
        <span className="px-1 text-xs text-gray-600 dark:text-gray-300">
          Page {page + 1} of {pageCount}
        </span>
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={page + 1 >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next ›
        </button>
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={page + 1 >= pageCount}
          onClick={() => onPageChange(pageCount - 1)}
        >
          Last »
        </button>
      </div>
    </div>
  );
}
