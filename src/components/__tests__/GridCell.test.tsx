import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GridCell } from '../GridCell';
import { resolveColumn } from '../../core/values';
import type { ColumnDef, ColumnLayoutItem, GridApi } from '../../types';
import type { Person } from '../../test/helpers';

const row: Person = {
  id: 1,
  name: 'Ada',
  email: 'ada@example.com',
  age: 36,
  active: true,
  joined: '2024-05-17',
  customer: { businessName: 'Acme' },
};

const api = {} as GridApi<Person>;

function item(
  definition: ColumnDef<Person, unknown>,
  geometry: Partial<ColumnLayoutItem<Person, unknown>> = {}
): ColumnLayoutItem<Person, unknown> {
  const column = resolveColumn(definition);
  return { column, colId: column.colId, width: 120, left: 0, stickyOffset: 0, ...geometry };
}

function setup(
  definition: ColumnDef<Person, unknown>,
  overrides: Partial<React.ComponentProps<typeof GridCell<Person, unknown>>> = {}
) {
  const onFieldChange = vi.fn();
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <GridCell<Person, unknown>
      item={overrides.item ?? item(definition)}
      row={row}
      rowIndex={0}
      context={undefined}
      api={api}
      isRowEditing={false}
      draft={null}
      errors={{}}
      isFirstEditable={false}
      onFieldChange={onFieldChange}
      onCommit={onCommit}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { ...view, onFieldChange, onCommit, onCancel };
}

describe('display mode', () => {
  it('renders the formatted value with the gridcell role and the column id', () => {
    setup({ field: 'name', header: 'Name' });
    const cell = screen.getByRole('gridcell');
    expect(cell).toHaveTextContent('Ada');
    expect(cell).toHaveAttribute('data-col-id', 'name');
  });

  it('resolves a dotted field path', () => {
    setup({ field: 'customer.businessName', header: 'Customer' });
    expect(screen.getByRole('gridcell')).toHaveTextContent('Acme');
  });

  it('renders a boolean through the default formatter', () => {
    setup({ field: 'active', header: 'Active' });
    expect(screen.getByRole('gridcell')).toHaveTextContent('Yes');
  });

  it('applies valueFormatter', () => {
    setup({
      field: 'age',
      header: 'Age',
      valueFormatter: (value) => `${String(value)} yrs`,
    });
    expect(screen.getByRole('gridcell')).toHaveTextContent('36 yrs');
  });

  it('sets the formatted text as a title so a truncated cell is still readable', () => {
    setup({ field: 'email', header: 'Email' });
    expect(screen.getByRole('gridcell')).toHaveAttribute('title', 'ada@example.com');
  });

  it('omits the title for an empty value', () => {
    setup({ colId: 'nothing', header: 'X', valueGetter: () => null });
    expect(screen.getByRole('gridcell')).not.toHaveAttribute('title');
  });
});

describe('cellRenderer', () => {
  it('renders custom markup instead of the formatted text', () => {
    setup({
      field: 'name',
      header: 'Name',
      cellRenderer: ({ formatted }) => <strong data-testid="custom">{formatted}!</strong>,
    });
    expect(screen.getByTestId('custom')).toHaveTextContent('Ada!');
  });

  it('receives the row, index, raw value, formatted text, column, context and api', () => {
    const cellRenderer = vi.fn(() => null);
    const context = { permissions: ['edit'] };
    setup(
      { field: 'age', header: 'Age', cellRenderer },
      { context, rowIndex: 7, api }
    );

    expect(cellRenderer).toHaveBeenCalledWith(
      expect.objectContaining({
        row,
        rowIndex: 7,
        value: 36,
        formatted: '36',
        context,
        api,
      })
    );
  });

  it('leaves the title off, since the renderer owns its own tooltip', () => {
    setup({ field: 'name', header: 'Name', cellRenderer: () => <span>x</span> });
    expect(screen.getByRole('gridcell')).not.toHaveAttribute('title');
  });
});

describe('geometry and classes', () => {
  it('pins the width in all three dimensions so the column cannot flex', () => {
    setup({ field: 'name', header: 'Name' }, { item: item({ field: 'name', header: 'N' }, { width: 175 }) });
    const cell = screen.getByRole('gridcell');
    expect(cell).toHaveStyle({ width: '175px', minWidth: '175px', maxWidth: '175px' });
  });

  it('sticks a left-pinned cell at its sticky offset', () => {
    setup(
      { field: 'name', header: 'N' },
      { item: item({ field: 'name', header: 'N' }, { pinned: 'left', stickyOffset: 40 }) }
    );
    expect(screen.getByRole('gridcell')).toHaveStyle({ position: 'sticky', left: '40px' });
  });

  it('sticks a right-pinned cell from the right edge', () => {
    setup(
      { field: 'name', header: 'N' },
      { item: item({ field: 'name', header: 'N' }, { pinned: 'right', stickyOffset: 80 }) }
    );
    expect(screen.getByRole('gridcell')).toHaveStyle({ position: 'sticky', right: '80px' });
  });

  it('gives a pinned cell an opaque background so scrolled rows do not show through', () => {
    setup(
      { field: 'name', header: 'N' },
      { item: item({ field: 'name', header: 'N' }, { pinned: 'left' }) }
    );
    expect(screen.getByRole('gridcell').className).toContain('bg-white');
  });

  it('applies the alignment class for each align value', () => {
    const { rerender } = render(
      <GridCell<Person, unknown>
        item={item({ field: 'age', header: 'Age', align: 'right' })}
        row={row}
        rowIndex={0}
        context={undefined}
        api={api}
        isRowEditing={false}
        draft={null}
        errors={{}}
        isFirstEditable={false}
        onFieldChange={() => undefined}
        onCommit={() => undefined}
        onCancel={() => undefined}
      />
    );
    expect(screen.getByRole('gridcell').className).toContain('justify-end');

    rerender(
      <GridCell<Person, unknown>
        item={item({ field: 'age', header: 'Age', align: 'center' })}
        row={row}
        rowIndex={0}
        context={undefined}
        api={api}
        isRowEditing={false}
        draft={null}
        errors={{}}
        isFirstEditable={false}
        onFieldChange={() => undefined}
        onCommit={() => undefined}
        onCancel={() => undefined}
      />
    );
    expect(screen.getByRole('gridcell').className).toContain('justify-center');
  });

  it('accepts a static cellClassName and a per-row function', () => {
    const { unmount } = setup({ field: 'age', header: 'Age', cellClassName: 'font-mono' });
    expect(screen.getByRole('gridcell').className).toContain('font-mono');
    unmount();

    setup({
      field: 'age',
      header: 'Age',
      cellClassName: (r) => (r.age > 30 ? 'text-error-600' : 'text-gray-500'),
    });
    expect(screen.getByRole('gridcell').className).toContain('text-error-600');
  });
});

describe('edit mode', () => {
  const editable: ColumnDef<Person, unknown> = {
    field: 'name',
    header: 'Name',
    editable: true,
  };

  it('swaps the renderer for the editor and reads from the draft, not the row', () => {
    setup(editable, {
      isRowEditing: true,
      draft: { ...row, name: 'DRAFTED' },
    });
    expect(screen.getByRole('textbox')).toHaveValue('DRAFTED');
  });

  it('stays in display mode for a column that is not editable', () => {
    setup({ field: 'email', header: 'Email' }, { isRowEditing: true, draft: row });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('gridcell')).toHaveTextContent('ada@example.com');
  });

  it('honours a per-row editable predicate', () => {
    setup(
      { field: 'name', header: 'Name', editable: (r) => r.id !== 1 },
      { isRowEditing: true, draft: row }
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('stays in display mode while the row is editing but no draft exists yet', () => {
    setup(editable, { isRowEditing: true, draft: null });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('writes changes back through onFieldChange, keyed by field', async () => {
    const user = userEvent.setup();
    const { onFieldChange } = setup(editable, { isRowEditing: true, draft: row });

    await user.type(screen.getByRole('textbox'), 'X');
    expect(onFieldChange).toHaveBeenLastCalledWith('name', 'AdaX');
  });

  it('keys the change by colId when the column has no field', async () => {
    const user = userEvent.setup();
    const { onFieldChange } = setup(
      { colId: 'derived', header: 'D', editable: true, valueGetter: () => 'v' },
      { isRowEditing: true, draft: row }
    );

    await user.type(screen.getByRole('textbox'), '!');
    expect(onFieldChange).toHaveBeenLastCalledWith('derived', 'v!');
  });

  it('paints the error for its own field only', () => {
    setup(editable, {
      isRowEditing: true,
      draft: row,
      errors: { name: 'Too short', email: 'Bad address' },
    });
    expect(screen.getByRole('textbox')).toHaveAttribute('title', 'Too short');
  });

  it('autofocuses only the first editable column', () => {
    const { unmount } = setup(editable, {
      isRowEditing: true,
      draft: row,
      isFirstEditable: true,
    });
    expect(screen.getByRole('textbox')).toHaveFocus();
    unmount();

    setup(editable, { isRowEditing: true, draft: row, isFirstEditable: false });
    expect(screen.getByRole('textbox')).not.toHaveFocus();
  });

  it('selects the builtin editor named by the column', () => {
    setup(
      { field: 'age', header: 'Age', editable: true, editor: 'number' },
      { isRowEditing: true, draft: row }
    );
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('defaults to the text editor when none is named', () => {
    setup(editable, { isRowEditing: true, draft: row });
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('accepts a custom editor component', async () => {
    const user = userEvent.setup();
    const { onCommit } = setup(
      {
        field: 'name',
        header: 'Name',
        editable: true,
        editor: ({ value, onCommit: commit }) => (
          <button type="button" onClick={commit}>
            custom:{String(value)}
          </button>
        ),
      },
      { isRowEditing: true, draft: row }
    );

    await user.click(screen.getByRole('button', { name: 'custom:Ada' }));
    expect(onCommit).toHaveBeenCalledOnce();
  });
});
