import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FloatingFilterRow } from '../FloatingFilterRow';
import { resolveColumn } from '../../core/values';
import type { ColumnDef, ColumnLayout, FilterModelMap } from '../../types';
import type { Person } from '../../test/helpers';

function layoutOf(definitions: ColumnDef<Person, unknown>[]): ColumnLayout<Person, unknown> {
  let left = 0;
  const items = definitions.map((definition) => {
    const column = resolveColumn(definition);
    const entry = {
      column,
      colId: column.colId,
      width: column.width,
      left,
      stickyOffset: 0,
      pinned: column.pinned,
    };
    left += column.width;
    return entry;
  });
  return { items, totalWidth: left, leftPinnedWidth: 0, rightPinnedWidth: 0 };
}

const columns: ColumnDef<Person, unknown>[] = [
  { field: 'name', header: 'Name', width: 150, filter: 'text' },
  { field: 'age', header: 'Age', width: 100, filter: 'number' },
  { field: 'active', header: 'Active', width: 100, filter: 'set' },
  { field: 'email', header: 'Email', width: 200 },
];

function setup(
  filterModel: FilterModelMap = {},
  definitions = columns,
  selectable = true
) {
  const onFilterChange = vi.fn();
  const view = render(
    <FloatingFilterRow<Person, unknown>
      layout={layoutOf(definitions)}
      filterModel={filterModel}
      height={28}
      selectable={selectable}
      onFilterChange={onFilterChange}
    />
  );
  return { ...view, onFilterChange, user: userEvent.setup() };
}

describe('which columns get an input', () => {
  it('gives free-text columns an editable box', () => {
    setup();
    expect(screen.getByRole('searchbox', { name: 'Filter name' })).toBeInTheDocument();
  });

  it('gives no box to a column with no filter configured', () => {
    setup();
    expect(screen.queryByRole('searchbox', { name: 'Filter email' })).not.toBeInTheDocument();
  });

  it('honours suppressFloatingFilter', () => {
    setup({}, [
      {
        field: 'name',
        header: 'Name',
        width: 150,
        filter: 'text',
        filterParams: { suppressFloatingFilter: true },
      },
    ]);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('shows a read-only summary for number, date and set columns', () => {
    // A single input cannot express a range or a value set, so those kinds
    // display their filter and are edited from the header popover instead.
    setup({
      age: { filterType: 'number', type: 'inRange', filter: 10, filterTo: 40 },
      active: { filterType: 'set', values: ['A', 'B'] },
    });

    expect(screen.getByText('10 - 40')).toBeInTheDocument();
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);
  });

  it('shows a dash placeholder for an unfiltered non-text column', () => {
    setup();
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });
});

describe('typing into a text filter', () => {
  it('emits a contains filter for each keystroke', async () => {
    const { onFilterChange, user } = setup();
    await user.type(screen.getByRole('searchbox', { name: 'Filter name' }), 'a');
    expect(onFilterChange).toHaveBeenLastCalledWith('name', {
      filterType: 'text',
      type: 'contains',
      filter: 'a',
    });
  });

  it('emits null when the box is emptied, which clears the column', async () => {
    const { onFilterChange, user } = setup({
      name: { filterType: 'text', type: 'contains', filter: 'ada' },
    });
    await user.clear(screen.getByRole('searchbox', { name: 'Filter name' }));
    expect(onFilterChange).toHaveBeenLastCalledWith('name', null);
  });

  it('seeds the box from the model', () => {
    setup({ name: { filterType: 'text', type: 'contains', filter: 'ada' } });
    expect(screen.getByRole('searchbox', { name: 'Filter name' })).toHaveValue('ada');
  });

  it('re-syncs when the model is changed elsewhere, such as by a reset', () => {
    const { rerender } = setup({
      name: { filterType: 'text', type: 'contains', filter: 'ada' },
    });
    rerender(
      <FloatingFilterRow<Person, unknown>
        layout={layoutOf(columns)}
        filterModel={{}}
        height={28}
        selectable
        onFilterChange={() => undefined}
      />
    );
    expect(screen.getByRole('searchbox', { name: 'Filter name' })).toHaveValue('');
  });

  it('blanks the box when a non-text filter takes over the column', () => {
    const { rerender } = setup({
      name: { filterType: 'text', type: 'contains', filter: 'ada' },
    });
    rerender(
      <FloatingFilterRow<Person, unknown>
        layout={layoutOf(columns)}
        filterModel={{ name: { filterType: 'text', type: 'blank' } }}
        height={28}
        selectable
        onFilterChange={() => undefined}
      />
    );
    expect(screen.getByRole('searchbox', { name: 'Filter name' })).toHaveValue('');
  });
});

describe('geometry', () => {
  it('matches the header width, including the selection gutter', () => {
    setup();
    // 150 + 100 + 100 + 200 columns, plus the 40px gutter.
    expect(screen.getByRole('row')).toHaveStyle({ width: '590px', height: '28px' });
  });

  it('drops the gutter when selection is off', () => {
    setup({}, columns, false);
    expect(screen.getByRole('row')).toHaveStyle({ width: '550px' });
  });

  // Matches the header's select-all cell, so unpinned filter inputs scrolled
  // left pass underneath the gutter rather than over it.
  it('stacks the gutter above the filter inputs scrolling beneath it', () => {
    setup();
    const gutter = screen.getByRole('row').firstElementChild as HTMLElement;
    expect(gutter).toHaveStyle({ width: '40px', zIndex: '3' });
    expect(gutter).toHaveClass('sticky', 'left-0');
  });
});
