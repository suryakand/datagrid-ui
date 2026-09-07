import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GridRow } from '../GridRow';
import { resolveColumn } from '../../core/values';
import type { ColumnDef, ColumnLayout, GridApi } from '../../types';
import type { Person } from '../../test/helpers';

const row: Person = {
  id: 7,
  name: 'Ada',
  email: 'ada@example.com',
  age: 36,
  active: true,
  joined: '2024-05-17',
  customer: { businessName: 'Acme' },
};

const api = {} as GridApi<Person>;

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

const defaultColumns: ColumnDef<Person, unknown>[] = [
  { field: 'name', header: 'Name', width: 100 },
  { field: 'email', header: 'Email', width: 200 },
];

function setup(
  overrides: Partial<React.ComponentProps<typeof GridRow<Person, unknown>>> = {},
  columns = defaultColumns
) {
  const handlers = {
    onToggleSelect: vi.fn(),
    onFieldChange: vi.fn(),
    onCommit: vi.fn(),
    onCancel: vi.fn(),
    onRowDoubleClick: vi.fn(),
  };
  const view = render(
    <GridRow<Person, unknown>
      row={row}
      rowId={7}
      rowIndex={3}
      top={108}
      height={36}
      layout={layoutOf(columns)}
      context={undefined}
      api={api}
      selectable
      isSelected={false}
      isRowEditing={false}
      draft={null}
      errors={{}}
      isSaving={false}
      {...handlers}
      {...overrides}
    />
  );
  return { ...view, ...handlers };
}

describe('layout and positioning', () => {
  it('absolutely positions the row at its computed offset and fixed height', () => {
    setup();
    expect(screen.getByRole('row')).toHaveStyle({ top: '108px', height: '36px' });
  });

  it('reserves 40px for the selection column in its width', () => {
    setup();
    // 100 + 200 columns + the 40px selection gutter.
    expect(screen.getByRole('row')).toHaveStyle({ width: '340px' });
  });

  it('omits the selection gutter when selection is off', () => {
    setup({ selectable: false });
    expect(screen.getByRole('row')).toHaveStyle({ width: '300px' });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('exposes a one-based aria-rowindex', () => {
    setup({ rowIndex: 3 });
    expect(screen.getByRole('row')).toHaveAttribute('aria-rowindex', '4');
  });

  it('renders one gridcell per layout item', () => {
    setup();
    expect(screen.getAllByRole('gridcell')).toHaveLength(2);
  });
});

describe('selection', () => {
  it('reports aria-selected only when the grid is selectable', () => {
    const { unmount } = setup({ isSelected: true });
    expect(screen.getByRole('row')).toHaveAttribute('aria-selected', 'true');
    unmount();

    setup({ selectable: false, isSelected: true });
    expect(screen.getByRole('row')).not.toHaveAttribute('aria-selected');
  });

  it('toggles with the row id, its index and the shift state', async () => {
    const user = userEvent.setup();
    const { onToggleSelect } = setup();

    await user.click(screen.getByRole('checkbox'));
    expect(onToggleSelect).toHaveBeenLastCalledWith(7, 3, false);
  });

  it('tints a selected row', () => {
    setup({ isSelected: true });
    expect(screen.getByRole('row').className).toContain('bg-brand-50');
  });

  it('stripes odd rows and leaves even rows plain', () => {
    const { unmount } = setup({ rowIndex: 1 });
    expect(screen.getByRole('row').className).toContain('bg-gray-50/60');
    unmount();

    setup({ rowIndex: 2 });
    expect(screen.getByRole('row').className).toContain('bg-white');
  });
});

describe('editing', () => {
  const editableColumns: ColumnDef<Person, unknown>[] = [
    { field: 'name', header: 'Name', width: 100 },
    { field: 'email', header: 'Email', width: 200, editable: true },
    { field: 'age', header: 'Age', width: 80, editable: true },
  ];

  it('opens the editor via double click', async () => {
    const user = userEvent.setup();
    const { onRowDoubleClick } = setup();

    await user.dblClick(screen.getAllByRole('gridcell')[0]);
    expect(onRowDoubleClick).toHaveBeenCalledWith(7, row);
  });

  it('autofocuses only the first editable column', () => {
    setup(
      { isRowEditing: true, draft: row },
      editableColumns
    );
    const inputs = screen.getAllByRole('textbox');
    // `email` is the first editable column, so it takes the caret.
    expect(inputs[0]).toHaveFocus();
    expect(inputs[1]).not.toHaveFocus();
  });

  it('tints the row while it is open for editing, over the selected tint', () => {
    setup({ isRowEditing: true, draft: row, isSelected: true }, editableColumns);
    expect(screen.getByRole('row').className).toContain('bg-brand-25');
  });

  it('dims the row while a commit is in flight', () => {
    setup({ isRowEditing: true, draft: row, isSaving: true }, editableColumns);
    expect(screen.getByRole('row').className).toContain('opacity-60');
  });

  it('surfaces a whole-row error as the row tooltip', () => {
    setup(
      { isRowEditing: true, draft: row, errors: { __row__: 'Save failed' } },
      editableColumns
    );
    expect(screen.getByRole('row')).toHaveAttribute('title', 'Save failed');
  });
});

describe('file drops', () => {
  function fileDragEvent(files: File[]) {
    return {
      dataTransfer: {
        types: ['Files'],
        files,
        dropEffect: '',
      },
    };
  }

  it('hands the dropped files to the callback along with the row', () => {
    const onFilesDropped = vi.fn();
    setup({ onFilesDropped });
    const target = screen.getByRole('row');
    const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' });

    fireEvent.dragOver(target, fileDragEvent([file]));
    fireEvent.drop(target, fileDragEvent([file]));

    expect(onFilesDropped).toHaveBeenCalledWith(row, [file]);
  });

  it('outlines the row while a file drag is over it, and clears on leave', () => {
    setup({ onFilesDropped: vi.fn() });
    const target = screen.getByRole('row');
    const file = new File(['x'], 'a.pdf');

    fireEvent.dragOver(target, fileDragEvent([file]));
    expect(target.className).toContain('outline-dashed');

    fireEvent.dragLeave(target);
    expect(target.className).not.toContain('outline-dashed');
  });

  it('ignores a column-reorder drag, which carries no Files type', () => {
    const onFilesDropped = vi.fn();
    setup({ onFilesDropped });
    const target = screen.getByRole('row');

    const columnDrag = { dataTransfer: { types: ['text/plain'], files: [], dropEffect: '' } };
    fireEvent.dragOver(target, columnDrag);
    expect(target.className).not.toContain('outline-dashed');

    fireEvent.drop(target, columnDrag);
    expect(onFilesDropped).not.toHaveBeenCalled();
  });

  it('does not fire for an empty file list', () => {
    const onFilesDropped = vi.fn();
    setup({ onFilesDropped });
    fireEvent.drop(screen.getByRole('row'), fileDragEvent([]));
    expect(onFilesDropped).not.toHaveBeenCalled();
  });

  it('attaches no drag handlers at all when the callback is absent', () => {
    setup();
    const target = screen.getByRole('row');
    fireEvent.dragOver(target, fileDragEvent([new File(['x'], 'a.pdf')]));
    expect(target.className).not.toContain('outline-dashed');
  });
});
