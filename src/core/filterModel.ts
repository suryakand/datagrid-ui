import type {
  DateFilterType,
  FilterKind,
  FilterModelMap,
  HxFilterModel,
  NumberFilterType,
  TextFilterType,
} from '../types';

/**
 * Builders and helpers for the wire-format filter shapes.
 *
 * Every filter the grid sends is constructed here, so the contract with the
 * server is defined in exactly one place.
 */

/** Every text operator, in the order the filter UI lists them. */
export const TEXT_FILTER_TYPES: TextFilterType[] = [
  'contains',
  'notContains',
  'equals',
  'notEqual',
  'startsWith',
  'endsWith',
  'blank',
  'notBlank',
];

/** Every numeric operator, in the order the filter UI lists them. */
export const NUMBER_FILTER_TYPES: NumberFilterType[] = [
  'equals',
  'notEqual',
  'lessThan',
  'lessThanOrEqual',
  'greaterThan',
  'greaterThanOrEqual',
  'inRange',
  'blank',
  'notBlank',
];

/** Every date operator, in the order the filter UI lists them. */
export const DATE_FILTER_TYPES: DateFilterType[] = [
  'equals',
  'notEqual',
  'before',
  'after',
  'inRange',
  'blank',
  'notBlank',
];

/**
 * Human-readable label for each operator, e.g. `notEqual` → `'Not equal'`.
 *
 * Replace an entry to relabel an operator throughout the filter UI.
 */
export const FILTER_TYPE_LABELS: Record<string, string> = {
  contains: 'Contains',
  notContains: 'Does not contain',
  equals: 'Equals',
  notEqual: 'Not equal',
  startsWith: 'Starts with',
  endsWith: 'Ends with',
  blank: 'Is empty',
  notBlank: 'Is not empty',
  lessThan: 'Less than',
  lessThanOrEqual: 'Less than or equal',
  greaterThan: 'Greater than',
  greaterThanOrEqual: 'Greater than or equal',
  inRange: 'Between',
  before: 'Before',
  after: 'After',
};

/**
 * Whether an operator takes no operand — `blank` and `notBlank`.
 *
 * @param type - The operator name.
 * @returns `true` when no value is needed.
 */
export function isUnaryFilter(type: string): boolean {
  return type === 'blank' || type === 'notBlank';
}

/**
 * Whether an operator takes two operands — currently only `inRange`.
 *
 * @param type - The operator name.
 * @returns `true` when both bounds are needed.
 */
export function isRangeFilter(type: string): boolean {
  return type === 'inRange';
}

/**
 * The operator a filter starts on when its popover is first opened.
 *
 * `contains` for text, `equals` for numbers and dates.
 *
 * @param kind - The filter kind.
 * @returns The default operator name.
 */
export function defaultFilterType(kind: FilterKind): string {
  switch (kind) {
    case 'text':
      return 'contains';
    case 'number':
      return 'equals';
    case 'date':
      return 'equals';
    case 'set':
      return 'set';
  }
}

/**
 * Builds a text filter, or `null` when there is nothing to send.
 *
 * @param type - The operator.
 * @param filter - The search term. Ignored for unary operators.
 * @returns The filter model, or `null` if a non-unary operator got a blank term.
 *
 * @example
 * ```ts
 * buildTextFilter('contains', 'acme');
 * // { filterType: 'text', type: 'contains', filter: 'acme' }
 * buildTextFilter('contains', '   '); // null
 * ```
 */
export function buildTextFilter(type: TextFilterType, filter: string): HxFilterModel | null {
  if (!isUnaryFilter(type) && filter.trim() === '') return null;
  return isUnaryFilter(type)
    ? { filterType: 'text', type }
    : { filterType: 'text', type, filter };
}

/**
 * Builds a numeric filter, or `null` when the input is incomplete.
 *
 * @param type - The operator.
 * @param filter - The operand, or lower bound for `inRange`, as typed.
 * @param filterTo - The upper bound. Required for `inRange`.
 * @returns The filter model, or `null` if a required operand is missing or not
 * a number.
 *
 * @example
 * ```ts
 * buildNumberFilter('inRange', '10', '100');
 * // { filterType: 'number', type: 'inRange', filter: 10, filterTo: 100 }
 * buildNumberFilter('inRange', '10'); // null — no upper bound
 * ```
 */
export function buildNumberFilter(
  type: NumberFilterType,
  filter: string,
  filterTo?: string
): HxFilterModel | null {
  if (isUnaryFilter(type)) return { filterType: 'number', type };

  const from = Number(filter);
  if (filter.trim() === '' || Number.isNaN(from)) return null;

  if (isRangeFilter(type)) {
    const to = Number(filterTo);
    if (!filterTo || filterTo.trim() === '' || Number.isNaN(to)) return null;
    return { filterType: 'number', type, filter: from, filterTo: to };
  }

  return { filterType: 'number', type, filter: from };
}

/**
 * Builds a date filter, or `null` when the input is incomplete.
 *
 * @param type - The operator.
 * @param dateFrom - Lower bound, formatted `YYYY-MM-DD`.
 * @param dateTo - Upper bound. Required for `inRange`.
 * @returns The filter model, or `null` if a required bound is missing.
 */
export function buildDateFilter(
  type: DateFilterType,
  dateFrom: string,
  dateTo?: string
): HxFilterModel | null {
  if (isUnaryFilter(type)) return { filterType: 'date', type };
  if (!dateFrom) return null;

  if (isRangeFilter(type)) {
    if (!dateTo) return null;
    return { filterType: 'date', type, dateFrom, dateTo };
  }

  return { filterType: 'date', type, dateFrom };
}

/**
 * Builds a set filter, or `null` when nothing is selected.
 *
 * Returning `null` rather than an empty set is what clears the filter — see
 * {@link withFilter}.
 *
 * @param values - The selected values.
 * @returns The filter model, or `null` for an empty selection.
 */
export function buildSetFilter(values: string[]): HxFilterModel | null {
  if (values.length === 0) return null;
  return { filterType: 'set', values };
}

/**
 * Sets or clears one column's filter, returning a new map.
 *
 * Never mutates the map it is given, so the result is safe to hand straight to
 * `setState`.
 *
 * @param model - The current filter model.
 * @param colId - The column to change.
 * @param filter - The new filter, or `null` to remove the column's entry.
 * @returns A new filter model.
 *
 * @example
 * ```ts
 * const next = withFilter(filterModel, 'status', buildSetFilter(['ACTIVE']));
 * const cleared = withFilter(filterModel, 'status', null);
 * ```
 */
export function withFilter(
  model: FilterModelMap,
  colId: string,
  filter: HxFilterModel | null
): FilterModelMap {
  const next = { ...model };
  if (filter === null) {
    delete next[colId];
  } else {
    next[colId] = filter;
  }
  return next;
}

/**
 * A short human-readable summary of a filter, for the floating filter input and
 * the header's active-filter indicator.
 *
 * @param filter - The filter to describe.
 * @returns A short label, e.g. `'Between 10 - 100'` or `'3 selected'`.
 */
export function describeFilter(filter: HxFilterModel): string {
  switch (filter.filterType) {
    case 'set':
      return filter.values.length === 1
        ? filter.values[0]
        : `${filter.values.length} selected`;
    case 'text':
      return isUnaryFilter(filter.type)
        ? FILTER_TYPE_LABELS[filter.type]
        : String(filter.filter ?? '');
    case 'number':
      if (isUnaryFilter(filter.type)) return FILTER_TYPE_LABELS[filter.type];
      return isRangeFilter(filter.type)
        ? `${filter.filter} - ${filter.filterTo}`
        : `${FILTER_TYPE_LABELS[filter.type]} ${filter.filter}`;
    case 'date':
      if (isUnaryFilter(filter.type)) return FILTER_TYPE_LABELS[filter.type];
      return isRangeFilter(filter.type)
        ? `${filter.dateFrom} - ${filter.dateTo}`
        : `${FILTER_TYPE_LABELS[filter.type]} ${filter.dateFrom}`;
  }
}
