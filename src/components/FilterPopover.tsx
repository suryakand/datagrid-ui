import { useEffect, useMemo, useRef, useState } from 'react';
import type { FilterKind, HxFilterModel } from '../types';
import {
  DATE_FILTER_TYPES,
  FILTER_TYPE_LABELS,
  NUMBER_FILTER_TYPES,
  TEXT_FILTER_TYPES,
  buildDateFilter,
  buildNumberFilter,
  buildSetFilter,
  buildTextFilter,
  isRangeFilter,
  isUnaryFilter,
} from '../core/filterModel';
import { useKeepInView } from './useKeepInView';

/** Props for {@link FilterPopover}. */
export interface FilterPopoverProps {
  /** Which filter UI to render. */
  kind: FilterKind;
  /** The column's current filter, or `undefined` when unfiltered. */
  value: HxFilterModel | undefined;
  /**
   * Options for a `set` filter: a static list, or a loader called the first
   * time the popover opens.
   */
  setValues?: string[] | (() => Promise<string[]>);
  /** Called with the new filter, or `null` to clear the column's filter. */
  onApply: (filter: HxFilterModel | null) => void;
  /** Dismiss the popover. */
  onClose: () => void;
}

const FIELD_CLASS =
  'h-8 w-full rounded border border-gray-300 bg-white px-2 text-xs text-gray-800 ' +
  'outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 ' +
  'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

const BUTTON_CLASS =
  'rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50';

function SetFilterBody({
  value,
  setValues,
  onApply,
}: {
  value: HxFilterModel | undefined;
  setValues: FilterPopoverProps['setValues'];
  onApply: (filter: HxFilterModel | null) => void;
}) {
  const [options, setOptions] = useState<string[]>(
    Array.isArray(setValues) ? setValues : []
  );
  const [isLoading, setIsLoading] = useState(typeof setValues === 'function');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(value?.filterType === 'set' ? value.values : [])
  );

  useEffect(() => {
    if (typeof setValues !== 'function') {
      setOptions(Array.isArray(setValues) ? setValues : []);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setValues()
      .then((loaded) => {
        if (!cancelled) setOptions(loaded);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setValues]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? options.filter((o) => o.toLowerCase().includes(needle)) : options;
  }, [options, search]);

  const toggle = (option: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  };

  return (
    <>
      <input
        type="search"
        className={FIELD_CLASS}
        placeholder="Search values..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="max-h-52 overflow-y-auto rounded border border-gray-200 dark:border-gray-700">
        {isLoading && (
          <p className="p-2 text-xs text-gray-500 dark:text-gray-400">Loading...</p>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="p-2 text-xs text-gray-500 dark:text-gray-400">No values.</p>
        )}
        {filtered.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5"
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-brand-500"
              checked={selected.has(option)}
              onChange={() => toggle(option)}
            />
            <span className="truncate">{option}</span>
          </label>
        ))}
      </div>

      <div className="flex justify-between gap-2">
        <button
          type="button"
          className={`${BUTTON_CLASS} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5`}
          onClick={() => {
            setSelected(new Set());
            onApply(null);
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className={`${BUTTON_CLASS} bg-brand-500 text-white hover:bg-brand-600`}
          onClick={() => onApply(buildSetFilter([...selected]))}
        >
          Apply
        </button>
      </div>
    </>
  );
}

/**
 * The per-column filter editor, covering all four
 * {@link FilterKind | filter kinds}. Emits the wire-format model directly.
 *
 * {@link DataGrid} opens this from the header; exported for custom surfaces.
 *
 * It is absolutely positioned: it hangs below its nearest positioned ancestor,
 * right-aligned to it. If that would put any part of it outside the window or
 * outside an ancestor that clips overflow (such as the grid's scroll
 * viewport), it slides sideways just far enough to fit, and re-fits as
 * anything scrolls. So opening it under a narrow first column no longer cuts
 * off its left side.
 */
export function FilterPopover({
  kind,
  value,
  setValues,
  onApply,
  onClose,
}: FilterPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useKeepInView(containerRef);

  const types =
    kind === 'text'
      ? TEXT_FILTER_TYPES
      : kind === 'number'
        ? NUMBER_FILTER_TYPES
        : DATE_FILTER_TYPES;

  const [type, setType] = useState<string>(() => {
    if (value && value.filterType !== 'set') return value.type;
    return types[0];
  });

  const [operand, setOperand] = useState<string>(() => {
    if (!value) return '';
    if (value.filterType === 'text') return value.filter ?? '';
    if (value.filterType === 'number') return value.filter?.toString() ?? '';
    if (value.filterType === 'date') return value.dateFrom ?? '';
    return '';
  });

  const [operandTo, setOperandTo] = useState<string>(() => {
    if (!value) return '';
    if (value.filterType === 'number') return value.filterTo?.toString() ?? '';
    if (value.filterType === 'date') return value.dateTo ?? '';
    return '';
  });

  // Close on outside click / Escape, the way a menu is expected to behave.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const apply = () => {
    if (kind === 'text') {
      onApply(buildTextFilter(type as never, operand));
    } else if (kind === 'number') {
      onApply(buildNumberFilter(type as never, operand, operandTo));
    } else {
      onApply(buildDateFilter(type as never, operand, operandTo));
    }
  };

  const inputType = kind === 'date' ? 'date' : kind === 'number' ? 'number' : 'text';

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-full z-30 mt-1 flex w-60 flex-col gap-2 rounded-md border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
      onClick={(event) => event.stopPropagation()}
    >
      {kind === 'set' ? (
        <SetFilterBody value={value} setValues={setValues} onApply={onApply} />
      ) : (
        <>
          <select
            className={FIELD_CLASS}
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {types.map((option) => (
              <option key={option} value={option}>
                {FILTER_TYPE_LABELS[option] ?? option}
              </option>
            ))}
          </select>

          {!isUnaryFilter(type) && (
            <input
              type={inputType}
              className={FIELD_CLASS}
              value={operand}
              autoFocus
              placeholder="Value"
              onChange={(event) => setOperand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') apply();
              }}
            />
          )}

          {isRangeFilter(type) && (
            <input
              type={inputType}
              className={FIELD_CLASS}
              value={operandTo}
              placeholder="To"
              onChange={(event) => setOperandTo(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') apply();
              }}
            />
          )}

          <div className="flex justify-between gap-2">
            <button
              type="button"
              className={`${BUTTON_CLASS} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5`}
              onClick={() => {
                setOperand('');
                setOperandTo('');
                onApply(null);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className={`${BUTTON_CLASS} bg-brand-500 text-white hover:bg-brand-600`}
              onClick={apply}
            >
              Apply
            </button>
          </div>
        </>
      )}
    </div>
  );
}
