import type {
  DateFilterType,
  FilterKind,
  FilterModelMap,
  HxFilterModel,
  NumberFilterType,
  TextFilterType,
} from '../types';

/**
 * Every wire-format filter shape is built here, so the contract with the server
 * is defined in exactly one place.
 */

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

export const DATE_FILTER_TYPES: DateFilterType[] = [
  'equals',
  'notEqual',
  'before',
  'after',
  'inRange',
  'blank',
  'notBlank',
];

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

/** Filter types that need no operand. */
export function isUnaryFilter(type: string): boolean {
  return type === 'blank' || type === 'notBlank';
}

export function isRangeFilter(type: string): boolean {
  return type === 'inRange';
}

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

export function buildTextFilter(type: TextFilterType, filter: string): HxFilterModel | null {
  if (!isUnaryFilter(type) && filter.trim() === '') return null;
  return isUnaryFilter(type)
    ? { filterType: 'text', type }
    : { filterType: 'text', type, filter };
}

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

export function buildSetFilter(values: string[]): HxFilterModel | null {
  if (values.length === 0) return null;
  return { filterType: 'set', values };
}

/** Sets or clears one column's entry, returning a new map. */
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

/** A short label for the floating filter / header indicator. */
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
