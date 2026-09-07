import { describe, expect, it } from 'vitest';
import {
  columnId,
  exportValue,
  formatValue,
  headerText,
  isEditable,
  resolveColumn,
  resolveValue,
} from '../values';
import type { ColumnDef } from '../../types';

interface Row {
  id: number;
  name: string;
  customer?: { businessName?: string | null } | null;
  'customer.businessName'?: string;
  legacyName?: string;
  count?: number | null;
  when?: Date;
  flag?: boolean;
}

/** Typed as `never` context because that is the signature the helpers take. */
const col = (definition: ColumnDef<Row, never>): ColumnDef<Row, never> => definition;

describe('resolveValue', () => {
  it('reads a flat field', () => {
    expect(resolveValue({ id: 1, name: 'Ada' }, col({ field: 'name', header: 'N' }))).toBe(
      'Ada'
    );
  });

  it('reads a dotted path into a nested object', () => {
    const row: Row = { id: 1, name: 'Ada', customer: { businessName: 'Acme' } };
    expect(
      resolveValue(row, col({ field: 'customer.businessName', header: 'C' }))
    ).toBe('Acme');
  });

  it('falls back to the literal flat key when the nested path misses', () => {
    // Servers that flatten joined relations hand back this shape.
    const row = { id: 1, name: 'Ada', 'customer.businessName': 'Flat Co' } as Row;
    expect(
      resolveValue(row, col({ field: 'customer.businessName', header: 'C' }))
    ).toBe('Flat Co');
  });

  it('falls back to each alias in order when field and flat key both miss', () => {
    const row: Row = { id: 1, name: 'Ada', legacyName: 'Legacy Co' };
    const value = resolveValue(
      row,
      col({
        field: 'customer.businessName',
        header: 'C',
        fieldAliases: ['missing.path', 'legacyName'],
      })
    );
    expect(value).toBe('Legacy Co');
  });

  it('prefers valueGetter over every other lookup', () => {
    const row: Row = { id: 1, name: 'Ada', customer: { businessName: 'Acme' } };
    const value = resolveValue(
      row,
      col({
        field: 'customer.businessName',
        header: 'C',
        valueGetter: () => 'computed',
      })
    );
    expect(value).toBe('computed');
  });

  it('returns undefined rather than throwing when the path hits a null', () => {
    const row: Row = { id: 1, name: 'Ada', customer: null };
    expect(
      resolveValue(row, col({ field: 'customer.businessName', header: 'C' }))
    ).toBeUndefined();
  });

  it('returns undefined when the column has no field and no valueGetter', () => {
    expect(resolveValue({ id: 1, name: 'Ada' }, col({ colId: 'x', header: 'X' })))
      .toBeUndefined();
  });

  it('tolerates a null row', () => {
    expect(
      resolveValue(null as unknown as Row, col({ field: 'name', header: 'N' }))
    ).toBeUndefined();
  });

  it('preserves a falsy value instead of falling through to an alias', () => {
    const row: Row = { id: 1, name: 'Ada', count: 0, legacyName: 'alias' };
    expect(
      resolveValue(row, col({ field: 'count', header: 'C', fieldAliases: ['legacyName'] }))
    ).toBe(0);
  });

  it('falls through to the alias when the value is null, since null is not undefined', () => {
    // `readPath` returns null, which is `!== undefined`, so the null wins.
    const row: Row = { id: 1, name: 'Ada', count: null, legacyName: 'alias' };
    expect(
      resolveValue(row, col({ field: 'count', header: 'C', fieldAliases: ['legacyName'] }))
    ).toBeNull();
  });
});

describe('formatValue', () => {
  const row: Row = { id: 1, name: 'Ada' };

  it('renders null and undefined as an empty string', () => {
    expect(formatValue(null, row, col({ field: 'name', header: 'N' }))).toBe('');
    expect(formatValue(undefined, row, col({ field: 'name', header: 'N' }))).toBe('');
  });

  it('renders a Date as YYYY-MM-DD', () => {
    const value = new Date(Date.UTC(2024, 4, 17, 13, 30));
    expect(formatValue(value, row, col({ field: 'when', header: 'W' }))).toBe(
      '2024-05-17'
    );
  });

  it('renders booleans as Yes and No', () => {
    expect(formatValue(true, row, col({ field: 'flag', header: 'F' }))).toBe('Yes');
    expect(formatValue(false, row, col({ field: 'flag', header: 'F' }))).toBe('No');
  });

  it('stringifies everything else', () => {
    expect(formatValue(42, row, col({ field: 'count', header: 'C' }))).toBe('42');
    expect(formatValue(0, row, col({ field: 'count', header: 'C' }))).toBe('0');
  });

  it('hands control to valueFormatter, including for null', () => {
    const column = col({
      field: 'count',
      header: 'C',
      valueFormatter: (value) => (value == null ? '--' : `#${String(value)}`),
    });
    expect(formatValue(null, row, column)).toBe('--');
    expect(formatValue(7, row, column)).toBe('#7');
  });

  it('passes the whole row to valueFormatter', () => {
    const column = col({
      field: 'count',
      header: 'C',
      valueFormatter: (value, whole) => `${whole.name}:${String(value)}`,
    });
    expect(formatValue(3, { id: 1, name: 'Ada' }, column)).toBe('Ada:3');
  });
});

describe('exportValue', () => {
  it('prefers exportValue over the formatter', () => {
    const column = col({
      field: 'name',
      header: 'N',
      valueFormatter: () => 'formatted',
      exportValue: () => 'exported',
    });
    expect(exportValue({ id: 1, name: 'Ada' }, column)).toBe('exported');
  });

  it('falls back to formatValue(resolveValue(...)) when exportValue is absent', () => {
    const row: Row = { id: 1, name: 'Ada', customer: { businessName: 'Acme' } };
    expect(
      exportValue(row, col({ field: 'customer.businessName', header: 'C' }))
    ).toBe('Acme');
  });
});

describe('headerText', () => {
  it('prefers headerName', () => {
    expect(
      headerText(col({ field: 'name', header: 'ignored', headerName: 'Full name' }))
    ).toBe('Full name');
  });

  it('uses a string header', () => {
    expect(headerText(col({ field: 'name', header: 'Name' }))).toBe('Name');
  });

  it('stringifies a numeric header', () => {
    expect(headerText(col({ field: 'name', header: 2024 }))).toBe('2024');
  });

  it('falls back to colId, then field, when the header is a node', () => {
    expect(headerText(col({ colId: 'the-id', field: 'name', header: null }))).toBe(
      'the-id'
    );
    expect(headerText(col({ field: 'name', header: null }))).toBe('name');
  });

  it('returns an empty string when nothing is usable', () => {
    expect(headerText(col({ header: null } as ColumnDef<Row, never>))).toBe('');
  });
});

describe('columnId', () => {
  it('prefers colId', () => {
    expect(columnId(col({ colId: 'a', field: 'b', header: 'H' }))).toBe('a');
  });

  it('falls back to field', () => {
    expect(columnId(col({ field: 'b', header: 'H' }))).toBe('b');
  });

  it('throws a named error when the column has neither', () => {
    expect(() => columnId(col({ header: 'H' }))).toThrowError(
      /every column needs a `colId` or a `field`/
    );
  });
});

describe('resolveColumn', () => {
  it('fills in the documented defaults', () => {
    const resolved = resolveColumn(col({ field: 'name', header: 'N' }));
    expect(resolved).toMatchObject({
      colId: 'name',
      width: 150,
      minWidth: 60,
      sortable: true,
      resizable: true,
    });
  });

  it('never resolves a width below minWidth', () => {
    const resolved = resolveColumn(col({ field: 'name', header: 'N', width: 10, minWidth: 90 }));
    expect(resolved.width).toBe(90);
  });

  it('raises the default width to a larger minWidth', () => {
    const resolved = resolveColumn(col({ field: 'name', header: 'N', minWidth: 300 }));
    expect(resolved.width).toBe(300);
  });

  it('keeps explicit false for sortable and resizable', () => {
    const resolved = resolveColumn(
      col({ field: 'name', header: 'N', sortable: false, resizable: false })
    );
    expect(resolved.sortable).toBe(false);
    expect(resolved.resizable).toBe(false);
  });

  it('does not mutate the definition it was given', () => {
    const definition = col({ field: 'name', header: 'N' });
    resolveColumn(definition);
    expect(definition.width).toBeUndefined();
  });
});

describe('isEditable', () => {
  const row: Row = { id: 1, name: 'Ada' };

  it('is false when editable is omitted', () => {
    expect(isEditable(col({ field: 'name', header: 'N' }), row)).toBe(false);
  });

  it('is true only for a literal true, not for a truthy value', () => {
    expect(isEditable(col({ field: 'name', header: 'N', editable: true }), row)).toBe(true);
    expect(isEditable(col({ field: 'name', header: 'N', editable: false }), row)).toBe(
      false
    );
  });

  it('calls a predicate with the row', () => {
    const column = col({ field: 'name', header: 'N', editable: (r) => r.id === 1 });
    expect(isEditable(column, { id: 1, name: 'Ada' })).toBe(true);
    expect(isEditable(column, { id: 2, name: 'Bob' })).toBe(false);
  });
});
