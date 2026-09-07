import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ColumnsPanel } from '../ColumnsPanel';
import { resolveColumn } from '../../core/values';
import type { ColumnDef, ResolvedColumn } from '../../types';
import type { Person } from '../../test/helpers';

const definitions: ColumnDef<Person, unknown>[] = [
  { field: 'name', header: 'Name' },
  { field: 'email', header: 'Email' },
  { field: 'age', header: 'Age' },
];

function setup(
  hidden: string[] = [],
  columns: ResolvedColumn<Person, unknown>[] = definitions.map((d) => resolveColumn(d))
) {
  const handlers = {
    onToggle: vi.fn(),
    onMove: vi.fn(),
    onPin: vi.fn(),
    onReset: vi.fn(),
    onClose: vi.fn(),
  };
  const view = render(
    <ColumnsPanel<Person, unknown>
      columns={columns}
      isHidden={(colId) => hidden.includes(colId)}
      {...handlers}
    />
  );
  return { ...view, ...handlers, user: userEvent.setup() };
}

describe('listing', () => {
  it('lists every column, hidden ones included', () => {
    setup(['email']);
    for (const label of ['Name', 'Email', 'Age']) {
      expect(screen.getByRole('checkbox', { name: label })).toBeInTheDocument();
    }
  });

  it('ticks visible columns and unticks hidden ones', () => {
    setup(['email']);
    expect(screen.getByRole('checkbox', { name: 'Name' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Email' })).not.toBeChecked();
  });

  it('summarises how many are shown', () => {
    setup(['email']);
    expect(screen.getByText('2 of 3 shown')).toBeInTheDocument();
  });

  it('uses headerName when the header is a node', () => {
    setup(
      [],
      [resolveColumn({ field: 'name', header: <em>Name</em>, headerName: 'Full name' })]
    );
    expect(screen.getByRole('checkbox', { name: 'Full name' })).toBeInTheDocument();
  });
});

describe('search', () => {
  it('narrows the list case-insensitively', async () => {
    const { user } = setup();
    await user.type(screen.getByPlaceholderText('Search columns...'), 'EMA');

    expect(screen.getByRole('checkbox', { name: 'Email' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Name' })).not.toBeInTheDocument();
  });

  it('leaves the total count alone, since it counts all columns not the matches', async () => {
    const { user } = setup();
    await user.type(screen.getByPlaceholderText('Search columns...'), 'email');
    expect(screen.getByText('3 of 3 shown')).toBeInTheDocument();
  });

  it('restores the full list when the search is cleared', async () => {
    const { user } = setup();
    const box = screen.getByPlaceholderText('Search columns...');
    await user.type(box, 'email');
    await user.clear(box);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });
});

describe('actions', () => {
  it('toggles a visible column to hidden', async () => {
    const { onToggle, user } = setup();
    await user.click(screen.getByRole('checkbox', { name: 'Email' }));
    expect(onToggle).toHaveBeenCalledWith('email', true);
  });

  it('toggles a hidden column back to visible', async () => {
    const { onToggle, user } = setup(['email']);
    await user.click(screen.getByRole('checkbox', { name: 'Email' }));
    expect(onToggle).toHaveBeenCalledWith('email', false);
  });

  it('pins an unpinned column to the left', async () => {
    const { onPin, user } = setup();
    await user.click(screen.getAllByRole('button', { name: '📌' })[0]);
    expect(onPin).toHaveBeenCalledWith('name', 'left');
  });

  it('unpins a pinned column', async () => {
    const { onPin, user } = setup(
      [],
      [resolveColumn({ field: 'name', header: 'Name', pinned: 'left' })]
    );
    const pin = screen.getByRole('button', { name: '📌' });
    expect(pin).toHaveAttribute('title', 'Unpin (left)');

    await user.click(pin);
    expect(onPin).toHaveBeenCalledWith('name', undefined);
  });

  it('closes from the × button', async () => {
    const { onClose, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Close columns panel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('resets from the escape-hatch button', async () => {
    const { onReset, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});

describe('drag to reorder', () => {
  function rowFor(label: string): HTMLElement {
    return screen.getByRole('checkbox', { name: label }).closest('[draggable]') as HTMLElement;
  }

  function transfer() {
    const store: Record<string, string> = {};
    return {
      setData: (key: string, value: string) => {
        store[key] = value;
      },
      getData: (key: string) => store[key] ?? '',
    };
  }

  it('moves the dragged column to the drop target index', () => {
    const { onMove } = setup();
    const dataTransfer = transfer();

    fireEvent.dragStart(rowFor('Age'), { dataTransfer });
    fireEvent.drop(rowFor('Name'), { dataTransfer });

    expect(onMove).toHaveBeenCalledWith('age', 0);
  });

  it('ignores a drop onto the column being dragged', () => {
    const { onMove } = setup();
    const dataTransfer = transfer();

    fireEvent.dragStart(rowFor('Age'), { dataTransfer });
    fireEvent.drop(rowFor('Age'), { dataTransfer });

    expect(onMove).not.toHaveBeenCalled();
  });

  it('uses the index in the full column list, not the filtered one', async () => {
    const { onMove, user } = setup();
    await user.type(screen.getByPlaceholderText('Search columns...'), 'a');

    const dataTransfer = transfer();
    fireEvent.dragStart(rowFor('Age'), { dataTransfer });
    fireEvent.drop(rowFor('Name'), { dataTransfer });

    // `Name` is index 0 of all columns, even though the search reordered nothing.
    expect(onMove).toHaveBeenCalledWith('age', 0);
  });
});
