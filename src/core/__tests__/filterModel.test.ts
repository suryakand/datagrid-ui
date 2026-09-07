import { describe, expect, it } from 'vitest';
import {
  DATE_FILTER_TYPES,
  FILTER_TYPE_LABELS,
  NUMBER_FILTER_TYPES,
  TEXT_FILTER_TYPES,
  buildDateFilter,
  buildNumberFilter,
  buildSetFilter,
  buildTextFilter,
  defaultFilterType,
  describeFilter,
  isRangeFilter,
  isUnaryFilter,
  withFilter,
} from '../filterModel';
import type { FilterModelMap } from '../../types';

describe('operator catalogues', () => {
  it('lists the text operators in UI order', () => {
    expect(TEXT_FILTER_TYPES).toEqual([
      'contains',
      'notContains',
      'equals',
      'notEqual',
      'startsWith',
      'endsWith',
      'blank',
      'notBlank',
    ]);
  });

  it('lists the number operators in UI order', () => {
    expect(NUMBER_FILTER_TYPES).toEqual([
      'equals',
      'notEqual',
      'lessThan',
      'lessThanOrEqual',
      'greaterThan',
      'greaterThanOrEqual',
      'inRange',
      'blank',
      'notBlank',
    ]);
  });

  it('lists the date operators in UI order', () => {
    expect(DATE_FILTER_TYPES).toEqual([
      'equals',
      'notEqual',
      'before',
      'after',
      'inRange',
      'blank',
      'notBlank',
    ]);
  });

  it('has a label for every operator it offers', () => {
    for (const type of [
      ...TEXT_FILTER_TYPES,
      ...NUMBER_FILTER_TYPES,
      ...DATE_FILTER_TYPES,
    ]) {
      expect(FILTER_TYPE_LABELS[type], `missing label for ${type}`).toBeTypeOf('string');
    }
  });
});

describe('isUnaryFilter / isRangeFilter', () => {
  it('treats only blank and notBlank as unary', () => {
    expect(isUnaryFilter('blank')).toBe(true);
    expect(isUnaryFilter('notBlank')).toBe(true);
    expect(isUnaryFilter('equals')).toBe(false);
    expect(isUnaryFilter('inRange')).toBe(false);
  });

  it('treats only inRange as a range', () => {
    expect(isRangeFilter('inRange')).toBe(true);
    expect(isRangeFilter('equals')).toBe(false);
    expect(isRangeFilter('blank')).toBe(false);
  });
});

describe('defaultFilterType', () => {
  it('opens text on contains and the rest on equals', () => {
    expect(defaultFilterType('text')).toBe('contains');
    expect(defaultFilterType('number')).toBe('equals');
    expect(defaultFilterType('date')).toBe('equals');
    expect(defaultFilterType('set')).toBe('set');
  });
});

describe('buildTextFilter', () => {
  it('builds a binary filter', () => {
    expect(buildTextFilter('contains', 'acme')).toEqual({
      filterType: 'text',
      type: 'contains',
      filter: 'acme',
    });
  });

  it('returns null for a blank term, which is what clears the filter', () => {
    expect(buildTextFilter('contains', '')).toBeNull();
    expect(buildTextFilter('contains', '   ')).toBeNull();
  });

  it('keeps the term unmodified, including its surrounding spaces', () => {
    // Only the emptiness check trims; the term itself is sent as typed.
    expect(buildTextFilter('equals', ' acme ')).toEqual({
      filterType: 'text',
      type: 'equals',
      filter: ' acme ',
    });
  });

  it('omits the operand entirely for unary operators', () => {
    expect(buildTextFilter('blank', '')).toEqual({ filterType: 'text', type: 'blank' });
    expect(buildTextFilter('notBlank', 'ignored')).toEqual({
      filterType: 'text',
      type: 'notBlank',
    });
  });
});

describe('buildNumberFilter', () => {
  it('coerces the operand to a number', () => {
    expect(buildNumberFilter('greaterThan', '42')).toEqual({
      filterType: 'number',
      type: 'greaterThan',
      filter: 42,
    });
  });

  it('accepts zero and negatives', () => {
    expect(buildNumberFilter('equals', '0')).toEqual({
      filterType: 'number',
      type: 'equals',
      filter: 0,
    });
    expect(buildNumberFilter('lessThan', '-5.5')).toEqual({
      filterType: 'number',
      type: 'lessThan',
      filter: -5.5,
    });
  });

  it('returns null for a blank or non-numeric operand', () => {
    expect(buildNumberFilter('equals', '')).toBeNull();
    expect(buildNumberFilter('equals', '   ')).toBeNull();
    expect(buildNumberFilter('equals', 'abc')).toBeNull();
  });

  it('builds a range with both bounds', () => {
    expect(buildNumberFilter('inRange', '10', '100')).toEqual({
      filterType: 'number',
      type: 'inRange',
      filter: 10,
      filterTo: 100,
    });
  });

  it('returns null when a range is missing its upper bound', () => {
    expect(buildNumberFilter('inRange', '10')).toBeNull();
    expect(buildNumberFilter('inRange', '10', '')).toBeNull();
    expect(buildNumberFilter('inRange', '10', 'abc')).toBeNull();
  });

  it('ignores both operands for unary operators', () => {
    expect(buildNumberFilter('blank', '99', '100')).toEqual({
      filterType: 'number',
      type: 'blank',
    });
  });
});

describe('buildDateFilter', () => {
  it('builds a single-bound filter', () => {
    expect(buildDateFilter('before', '2024-05-01')).toEqual({
      filterType: 'date',
      type: 'before',
      dateFrom: '2024-05-01',
    });
  });

  it('returns null without a lower bound', () => {
    expect(buildDateFilter('after', '')).toBeNull();
  });

  it('builds a range with both bounds', () => {
    expect(buildDateFilter('inRange', '2024-01-01', '2024-12-31')).toEqual({
      filterType: 'date',
      type: 'inRange',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    });
  });

  it('returns null when a range is missing its upper bound', () => {
    expect(buildDateFilter('inRange', '2024-01-01')).toBeNull();
    expect(buildDateFilter('inRange', '2024-01-01', '')).toBeNull();
  });

  it('ignores both bounds for unary operators', () => {
    expect(buildDateFilter('notBlank', '', '')).toEqual({
      filterType: 'date',
      type: 'notBlank',
    });
  });
});

describe('buildSetFilter', () => {
  it('builds a set from the selected values', () => {
    expect(buildSetFilter(['ACTIVE', 'PENDING'])).toEqual({
      filterType: 'set',
      values: ['ACTIVE', 'PENDING'],
    });
  });

  it('returns null for an empty selection rather than an empty set', () => {
    // An empty set would mean "match nothing"; null is what clears the filter.
    expect(buildSetFilter([])).toBeNull();
  });
});

describe('withFilter', () => {
  const model: FilterModelMap = {
    name: { filterType: 'text', type: 'contains', filter: 'a' },
    age: { filterType: 'number', type: 'equals', filter: 30 },
  };

  it('adds a column without touching the others', () => {
    const next = withFilter(model, 'city', { filterType: 'text', type: 'equals', filter: 'NY' });
    expect(Object.keys(next).sort()).toEqual(['age', 'city', 'name']);
    expect(next.age).toBe(model.age);
  });

  it('replaces an existing column', () => {
    const next = withFilter(model, 'name', {
      filterType: 'text',
      type: 'startsWith',
      filter: 'z',
    });
    expect(next.name).toEqual({ filterType: 'text', type: 'startsWith', filter: 'z' });
  });

  it('removes the entry when given null', () => {
    const next = withFilter(model, 'name', null);
    expect(next).not.toHaveProperty('name');
    expect(next.age).toBeDefined();
  });

  it('never mutates the map it was given', () => {
    const before = JSON.stringify(model);
    withFilter(model, 'name', null);
    withFilter(model, 'zzz', { filterType: 'text', type: 'equals', filter: 'q' });
    expect(JSON.stringify(model)).toBe(before);
  });

  it('returns a new object even when clearing a column that was not set', () => {
    const next = withFilter(model, 'unknown', null);
    expect(next).not.toBe(model);
    expect(next).toEqual(model);
  });
});

describe('describeFilter', () => {
  it('names the single value of a one-item set', () => {
    expect(describeFilter({ filterType: 'set', values: ['ACTIVE'] })).toBe('ACTIVE');
  });

  it('counts a multi-value set', () => {
    expect(describeFilter({ filterType: 'set', values: ['A', 'B', 'C'] })).toBe(
      '3 selected'
    );
  });

  it('shows the bare term for a binary text filter', () => {
    expect(describeFilter({ filterType: 'text', type: 'contains', filter: 'acme' })).toBe(
      'acme'
    );
  });

  it('labels a unary filter of every kind', () => {
    expect(describeFilter({ filterType: 'text', type: 'blank' })).toBe('Is empty');
    expect(describeFilter({ filterType: 'number', type: 'notBlank' })).toBe('Is not empty');
    expect(describeFilter({ filterType: 'date', type: 'blank' })).toBe('Is empty');
  });

  it('renders a numeric range as "from - to"', () => {
    expect(
      describeFilter({ filterType: 'number', type: 'inRange', filter: 10, filterTo: 100 })
    ).toBe('10 - 100');
  });

  it('prefixes a binary numeric filter with its label', () => {
    expect(
      describeFilter({ filterType: 'number', type: 'greaterThan', filter: 5 })
    ).toBe('Greater than 5');
  });

  it('renders a date range and a binary date filter', () => {
    expect(
      describeFilter({
        filterType: 'date',
        type: 'inRange',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      })
    ).toBe('2024-01-01 - 2024-12-31');
    expect(
      describeFilter({ filterType: 'date', type: 'before', dateFrom: '2024-01-01' })
    ).toBe('Before 2024-01-01');
  });

  it('describes a text filter whose operand is missing as an empty string', () => {
    expect(describeFilter({ filterType: 'text', type: 'contains' })).toBe('');
  });
});
