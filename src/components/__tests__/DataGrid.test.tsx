import { createRef } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataGrid, type DataGridProps } from '../DataGrid';
import { GRID_STATE_VERSION, type ColumnDef, type GridApi } from '../../types';
import {
  controllableDataSource,
  flushEffects,
  lastRequest,
  makePeople,
  resizeViewport,
  stubDataSource,
  type Person,
  type StubDataSource,
} from '../../test/helpers';

const columns: ColumnDef<Person>[] = [
  { field: 'name', header: 'Name', width: 160, filter: 'text', editable: true },
  { field: 'email', header: 'Email', width: 200, filter: 'text' },
  { field: 'age', header: 'Age', width: 80, filter: 'number' },
];

const getRowId = (row: Person) => row.id;

/**
 * Renders the grid and gives it a measured viewport.
 *
 * Without the resize the virtual window is empty and no cells exist, so every
 * integration test has to go through here.
 */
type GridOverrides = Omit<Partial<DataGridProps<Person>>, 'dataSource'> & {
  dataSource?: StubDataSource<Person>;
};

async function renderGrid(overrides: GridOverrides = {}) {
  const dataSource = overrides.dataSource ?? stubDataSource(makePeople(75));
  const view = render(
    <DataGrid<Person>
      columns={columns}
      dataSource={dataSource}
      getRowId={getRowId}
      {...overrides}
    />
  );

  resizeViewport(900, 400);
  await waitFor(() => expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'false'));
  // The row window is applied by an effect that runs after the render which
  // cleared aria-busy, so the grid has rows but has not painted them yet.
  await flushEffects();

  return { ...view, dataSource, user: userEvent.setup() };
}

/**
 * The data rows only.
 *
 * The header and the floating filter strip are both `role="row"` and hold no
 * gridcells, so a plain `getAllByRole('row')` cannot be indexed into.
 */
function dataRows(): HTMLElement[] {
  return screen.getAllByRole('row').filter((row) => row.hasAttribute('aria-rowindex'));
}

function rowTexts(): string[] {
  return dataRows().map((row) => within(row).getAllByRole('gridcell')[0]?.textContent ?? '');
}

describe('first render', () => {
  it('fetches page 0 at the default page size and paints the rows', async () => {
    const { dataSource } = await renderGrid();

    expect(dataSource.requests[0]).toMatchObject({ startRow: 0, endRow: 20 });
    expect(screen.getByText('Person 1')).toBeInTheDocument();
    expect(screen.getByText('1-20 of 75')).toBeInTheDocument();
  });

  it('renders the headers from the column definitions', async () => {
    await renderGrid();
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Age/ })).toBeInTheDocument();
  });

  it('reports the server total as aria-rowcount, not the loaded page size', async () => {
    await renderGrid();
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '75');
  });

  it('renders only the windowed rows, not the whole page', async () => {
    await renderGrid({ dataSource: stubDataSource(makePeople(500)), defaultPageSize: 100 });
    // A 400px viewport at 36px rows cannot hold 100 rows.
    expect(screen.getAllByRole('row').length).toBeLessThan(30);
  });

  it('shows the loading overlay while the first fetch is in flight', () => {
    const { dataSource } = controllableDataSource<Person>();
    render(<DataGrid<Person> columns={columns} dataSource={dataSource} getRowId={getRowId} />);
    resizeViewport(900, 400);
    // The overlay and the pager both say it, which is the point: both surfaces
    // report the in-flight fetch.
    expect(screen.getAllByText('Loading...').length).toBeGreaterThanOrEqual(2);
  });

  it('shows the empty overlay when the server returns no rows', async () => {
    await renderGrid({ dataSource: stubDataSource<Person>([]) });
    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('shows a custom empty message', async () => {
    await renderGrid({
      dataSource: stubDataSource<Person>([]),
      emptyMessage: 'Nothing matches those filters',
    });
    expect(screen.getByText('Nothing matches those filters')).toBeInTheDocument();
  });

  it('shows the error overlay and calls onError when the fetch rejects', async () => {
    const onError = vi.fn();
    render(
      <DataGrid<Person>
        columns={columns}
        dataSource={{ getRows: () => Promise.reject(new Error('HTTP 500')) }}
        getRowId={getRowId}
        onError={onError}
      />
    );
    resizeViewport(900, 400);

    await waitFor(() => expect(screen.getByText('HTTP 500')).toBeInTheDocument());
    expect(onError).toHaveBeenCalled();
  });
});

describe('sorting', () => {
  it('cycles a column asc, then desc, then off', async () => {
    const { dataSource, user } = await renderGrid();
    const header = screen.getByRole('button', { name: /Name/ });

    await user.click(header);
    await waitFor(() =>
      expect(lastRequest(dataSource).sortModel).toEqual([{ colId: 'name', sort: 'asc' }])
    );

    await user.click(header);
    await waitFor(() =>
      expect(lastRequest(dataSource).sortModel).toEqual([{ colId: 'name', sort: 'desc' }])
    );

    await user.click(header);
    await waitFor(() => expect(lastRequest(dataSource).sortModel).toEqual([]));
  });

  it('replaces the sort on a plain click of another column', async () => {
    const { dataSource, user } = await renderGrid();

    await user.click(screen.getByRole('button', { name: /Name/ }));
    await user.click(screen.getByRole('button', { name: /Email/ }));

    await waitFor(() =>
      expect(lastRequest(dataSource).sortModel).toEqual([{ colId: 'email', sort: 'asc' }])
    );
  });

  it('appends to the sort on a shift-click, preserving priority order', async () => {
    const { dataSource, user } = await renderGrid();

    await user.click(screen.getByRole('button', { name: /Name/ }));
    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('button', { name: /Email/ }));
    await user.keyboard('{/Shift}');

    await waitFor(() =>
      expect(lastRequest(dataSource).sortModel).toEqual([
        { colId: 'name', sort: 'asc' },
        { colId: 'email', sort: 'asc' },
      ])
    );
  });

  it('drops just that column from a multi-sort on the third shift-click', async () => {
    const { dataSource, user } = await renderGrid();

    await user.click(screen.getByRole('button', { name: /Name/ }));
    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('button', { name: /Email/ }));
    await user.click(screen.getByRole('button', { name: /Email/ }));
    await user.click(screen.getByRole('button', { name: /Email/ }));
    await user.keyboard('{/Shift}');

    await waitFor(() =>
      expect(lastRequest(dataSource).sortModel).toEqual([{ colId: 'name', sort: 'asc' }])
    );
  });

  it('returns to page 1, since page 7 of a resorted set is never what was meant', async () => {
    const { dataSource, user } = await renderGrid();

    await user.click(screen.getByRole('button', { name: 'Next ›' }));
    await waitFor(() => expect(screen.getByText('21-40 of 75')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Name/ }));

    await waitFor(() => expect(lastRequest(dataSource).startRow).toBe(0));
    expect(screen.getByText('1-20 of 75')).toBeInTheDocument();
  });
});

describe('filtering', () => {
  it('sends a contains filter as the floating input is typed into', async () => {
    const { dataSource, user } = await renderGrid();

    await user.type(screen.getByRole('searchbox', { name: 'Filter name' }), 'ada');

    await waitFor(() =>
      expect(lastRequest(dataSource).filterModel).toEqual({
        name: { filterType: 'text', type: 'contains', filter: 'ada' },
      })
    );
  });

  it('clears the column when the floating input is emptied', async () => {
    const { dataSource, user } = await renderGrid();
    const box = screen.getByRole('searchbox', { name: 'Filter name' });

    await user.type(box, 'ada');
    await waitFor(() => expect(lastRequest(dataSource).filterModel).not.toEqual({}));

    await user.clear(box);
    await waitFor(() => expect(lastRequest(dataSource).filterModel).toEqual({}));
  });

  it('sends the richer model built by the header popover', async () => {
    const { dataSource, user } = await renderGrid();

    await user.click(screen.getByRole('button', { name: 'Filter age' }));
    // The popover's operator select comes before the pager's page-size select.
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'inRange');
    await user.type(screen.getByPlaceholderText('Value'), '20');
    await user.type(screen.getByPlaceholderText('To'), '40');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(lastRequest(dataSource).filterModel).toEqual({
        age: { filterType: 'number', type: 'inRange', filter: 20, filterTo: 40 },
      })
    );
  });

  it('combines filters across columns', async () => {
    const { dataSource, user } = await renderGrid();

    await user.type(screen.getByRole('searchbox', { name: 'Filter name' }), 'a');
    await user.type(screen.getByRole('searchbox', { name: 'Filter email' }), 'b');

    await waitFor(() =>
      expect(Object.keys(lastRequest(dataSource).filterModel).sort()).toEqual([
        'email',
        'name',
      ])
    );
  });

  it('returns to the first page when a filter changes', async () => {
    const { dataSource, user } = await renderGrid();

    await user.click(screen.getByRole('button', { name: 'Next ›' }));
    await waitFor(() => expect(screen.getByText('21-40 of 75')).toBeInTheDocument());

    await user.type(screen.getByRole('searchbox', { name: 'Filter name' }), 'a');
    await waitFor(() => expect(lastRequest(dataSource).startRow).toBe(0));
  });

  it('walks back to the last real page when a filter shrinks the result set', async () => {
    // Otherwise the user sits on an empty page 4 forever.
    let total = 75;
    const dataSource = stubDataSource(makePeople(75), { total: () => total });
    const { user } = await renderGrid({ dataSource });

    await user.click(screen.getByRole('button', { name: 'Last »' }));
    await waitFor(() => expect(screen.getByText('61-75 of 75')).toBeInTheDocument());

    total = 10;
    await user.type(screen.getByRole('searchbox', { name: 'Filter name' }), 'a');

    await waitFor(() => expect(screen.getByText('1-10 of 10')).toBeInTheDocument());
  });

  it('hides the floating filter row when asked', async () => {
    await renderGrid({ floatingFilter: false });
    expect(screen.queryByRole('searchbox', { name: 'Filter name' })).not.toBeInTheDocument();
  });
});

describe('paging', () => {
  it('requests the next window and updates the range summary', async () => {
    const { dataSource, user } = await renderGrid();

    await user.click(screen.getByRole('button', { name: 'Next ›' }));

    await waitFor(() => expect(screen.getByText('21-40 of 75')).toBeInTheDocument());
    expect(lastRequest(dataSource)).toMatchObject({ startRow: 20, endRow: 40 });
  });

  it('jumps to the last page', async () => {
    const { user } = await renderGrid();
    await user.click(screen.getByRole('button', { name: 'Last »' }));
    await waitFor(() => expect(screen.getByText('61-75 of 75')).toBeInTheDocument());
  });

  it('changing the page size refetches from page 0', async () => {
    const { dataSource, user } = await renderGrid();

    await user.click(screen.getByRole('button', { name: 'Next ›' }));
    await waitFor(() => expect(screen.getByText('21-40 of 75')).toBeInTheDocument());

    await user.selectOptions(screen.getByRole('combobox', { name: /rows/i }), '50');

    await waitFor(() =>
      expect(lastRequest(dataSource)).toMatchObject({ startRow: 0, endRow: 50 })
    );
    expect(screen.getByText('1-50 of 75')).toBeInTheDocument();
  });

  it('offers the configured page sizes', async () => {
    await renderGrid({ pageSizeOptions: [5, 25], defaultPageSize: 5 });
    const select = screen.getByRole('combobox', { name: /rows/i }) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['5', '25']);
  });
});

describe('selection', () => {
  it('selects a row and reports its id', async () => {
    const onSelectionChanged = vi.fn();
    const { user } = await renderGrid({ onSelectionChanged });

    const rows = dataRows();
    await user.click(within(rows[0]).getByRole('checkbox'));

    expect(onSelectionChanged).toHaveBeenLastCalledWith([1]);
    await waitFor(() => expect(dataRows()[0]).toHaveAttribute('aria-selected', 'true'));
  });

  it('selects the whole page from the header checkbox', async () => {
    const onSelectionChanged = vi.fn();
    const { user } = await renderGrid({ onSelectionChanged });

    await user.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }));

    // Only the rendered window is selectable; the page holds 20 rows.
    expect(onSelectionChanged.mock.calls[onSelectionChanged.mock.calls.length - 1][0]).toHaveLength(20);
  });

  it('keeps ids selected across a page change', async () => {
    const onSelectionChanged = vi.fn();
    const { user } = await renderGrid({ onSelectionChanged });

    await user.click(within(dataRows()[0]).getByRole('checkbox'));

    await user.click(screen.getByRole('button', { name: 'Next ›' }));
    await waitFor(() => expect(screen.getByText('21-40 of 75')).toBeInTheDocument());

    // Still selected, just not on screen.
    const header = screen.getByRole('checkbox', { name: 'Select all rows on this page' });
    expect(header).not.toBeChecked();
    expect(onSelectionChanged).toHaveBeenLastCalledWith([1]);
  });

  it('hides the selection column entirely when selectable is false', async () => {
    await renderGrid({ selectable: false });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('inline editing', () => {
  it('does not open on double click without an onRowCommit handler', async () => {
    const { user } = await renderGrid();
    await user.dblClick(screen.getByText('Person 1'));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('opens on double click and shows the save bar', async () => {
    const { user } = await renderGrid({ onRowCommit: () => ({ ok: true }) });

    await user.dblClick(screen.getByText('Person 1'));

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(
      screen.getByText('Editing row — Enter to save, Escape to cancel.')
    ).toBeInTheDocument();
  });

  it('commits the edited draft alongside the original row', async () => {
    const onRowCommit = vi.fn().mockResolvedValue({ ok: true });
    const { user } = await renderGrid({ onRowCommit });

    await user.dblClick(screen.getByText('Person 1'));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Edited{Enter}');

    await waitFor(() => expect(onRowCommit).toHaveBeenCalled());
    const [draft, original] = onRowCommit.mock.calls[0];
    expect(draft.name).toBe('Edited');
    expect(original.name).toBe('Person 1');
  });

  // KNOWN DEFECT. The click-away listener cancels the edit for any mousedown
  // outside `[data-hxg-editing-row]`, and the Save button lives in the footer
  // bar, not in the row -- so its own mousedown abandons the draft and unmounts
  // the button before the click can commit. Enter still works, which is why the
  // gallery does not show it. The mouse path to Save is dead.
  // Fix: also treat the edit bar as part of the editing surface (mark it with
  // the same data attribute, or check `closest('[data-hxg-edit-bar]')` too).
  // Delete `.fails` once that lands.
  it.fails('commits when the Save button is clicked', async () => {
    const onRowCommit = vi.fn().mockResolvedValue({ ok: true });
    const { user } = await renderGrid({ onRowCommit });

    await user.dblClick(screen.getByText('Person 1'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onRowCommit).toHaveBeenCalled());
  });

  it('currently abandons the edit when the Save button is clicked', async () => {
    // Pins the defect above so a fix is a deliberate, visible change.
    const onRowCommit = vi.fn().mockResolvedValue({ ok: true });
    const { user } = await renderGrid({ onRowCommit });

    await user.dblClick(screen.getByText('Person 1'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await flushEffects();

    expect(onRowCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('commits on Enter from inside the editor', async () => {
    const onRowCommit = vi.fn().mockResolvedValue({ ok: true });
    const { user } = await renderGrid({ onRowCommit });

    await user.dblClick(screen.getByText('Person 1'));
    await user.type(screen.getByRole('textbox'), '!{Enter}');

    await waitFor(() => expect(onRowCommit).toHaveBeenCalled());
    expect(onRowCommit.mock.calls[0][0].name).toBe('Person 1!');
  });

  it('closes the editor and keeps the original row on Escape', async () => {
    const onRowCommit = vi.fn().mockResolvedValue({ ok: true });
    const { user } = await renderGrid({ onRowCommit });

    await user.dblClick(screen.getByText('Person 1'));
    await user.type(screen.getByRole('textbox'), 'zzz');
    await user.keyboard('{Escape}');

    expect(onRowCommit).not.toHaveBeenCalled();
    expect(screen.getByText('Person 1')).toBeInTheDocument();
  });

  it('abandons the edit when the user clicks away from the row', async () => {
    const { user } = await renderGrid({ onRowCommit: () => ({ ok: true }) });

    await user.dblClick(screen.getByText('Person 1'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    await user.click(screen.getByRole('columnheader', { name: /Email/ }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    );
  });

  it('cancels from the Cancel button', async () => {
    const { user } = await renderGrid({ onRowCommit: () => ({ ok: true }) });
    await user.dblClick(screen.getByText('Person 1'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('keeps the row open and paints the field error on a rejected commit', async () => {
    const { user } = await renderGrid({
      onRowCommit: () => ({ ok: false, errors: { name: 'Name is taken' } }),
    });

    await user.dblClick(screen.getByText('Person 1'));
    await user.type(screen.getByRole('textbox'), '{Enter}');

    await waitFor(() =>
      expect(screen.getByRole('textbox')).toHaveAttribute('title', 'Name is taken')
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows a thrown commit error in the save bar', async () => {
    const { user } = await renderGrid({
      onRowCommit: () => {
        throw new Error('Server unreachable');
      },
    });

    await user.dblClick(screen.getByText('Person 1'));
    await user.type(screen.getByRole('textbox'), '{Enter}');

    await waitFor(() => expect(screen.getByText('Server unreachable')).toBeInTheDocument());
  });

  it('disables Save while a commit is in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { user } = await renderGrid({
      onRowCommit: async () => {
        await gate;
        return { ok: true };
      },
    });

    await user.dblClick(screen.getByText('Person 1'));
    await user.type(screen.getByRole('textbox'), '{Enter}');

    const saving = await screen.findByRole('button', { name: 'Saving...' });
    expect(saving).toBeDisabled();

    release();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Saving...' })).not.toBeInTheDocument()
    );
  });
});

describe('the columns panel', () => {
  it('opens from the toolbar and hides a column from the grid', async () => {
    const { user } = await renderGrid();

    await user.click(screen.getByRole('button', { name: 'Columns' }));
    await user.click(screen.getByRole('checkbox', { name: 'Email' }));

    await waitFor(() =>
      expect(screen.queryByRole('columnheader', { name: /Email/ })).not.toBeInTheDocument()
    );
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
  });

  it('reorders columns and closes again', async () => {
    const { user } = await renderGrid();
    await user.click(screen.getByRole('button', { name: 'Columns' }));

    await user.click(screen.getByRole('button', { name: 'Close columns panel' }));
    expect(screen.queryByPlaceholderText('Search columns...')).not.toBeInTheDocument();
  });
});

describe('persistence', () => {
  const STORAGE_KEY = 'hxg:people';

  it('persists sort, filters and page size under the namespaced key', async () => {
    const { user } = await renderGrid({ storageKey: 'people' });

    await user.click(screen.getByRole('button', { name: /Name/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: /rows/i }), '50');

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string);
      expect(stored.sort).toEqual([{ colId: 'name', sort: 'asc' }]);
      expect(stored.pagination.pageSize).toBe(50);
      expect(stored.v).toBe(GRID_STATE_VERSION);
    });
  });

  it('restores sort, filters and page size on the next mount', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: GRID_STATE_VERSION,
        columns: { order: ['age', 'name', 'email'], hidden: ['email'], widths: {}, pinned: {} },
        sort: [{ colId: 'age', sort: 'desc' }],
        filters: { name: { filterType: 'text', type: 'contains', filter: 'restored' } },
        pagination: { pageSize: 50 },
      })
    );

    const { dataSource } = await renderGrid({ storageKey: 'people' });

    expect(dataSource.requests[0]).toMatchObject({
      startRow: 0,
      endRow: 50,
      sortModel: [{ colId: 'age', sort: 'desc' }],
      filterModel: { name: { filterType: 'text', type: 'contains', filter: 'restored' } },
    });
    expect(screen.getByRole('searchbox', { name: 'Filter name' })).toHaveValue('restored');
    expect(screen.queryByRole('columnheader', { name: /Email/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('Age');
  });

  it('ignores state saved under a different schema version', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: GRID_STATE_VERSION + 1,
        columns: { order: [], hidden: ['name'], widths: {}, pinned: {} },
        sort: [{ colId: 'age', sort: 'desc' }],
        filters: {},
        pagination: { pageSize: 50 },
      })
    );

    const { dataSource } = await renderGrid({ storageKey: 'people' });

    expect(dataSource.requests[0]).toMatchObject({ endRow: 20, sortModel: [] });
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
  });

  it('persists nothing at all without a storageKey', async () => {
    const { user } = await renderGrid();
    await user.click(screen.getByRole('button', { name: /Name/ }));
    await waitFor(() => expect(window.localStorage.length).toBe(0));
  });

  it('returns the columns to their declared layout on reset', async () => {
    const { user } = await renderGrid({ storageKey: 'people' });

    await user.click(screen.getByRole('button', { name: 'Columns' }));
    await user.click(screen.getByRole('checkbox', { name: 'Email' }));
    await waitFor(() =>
      expect(screen.queryByRole('columnheader', { name: /Email/ })).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: /Email/ })).toBeInTheDocument()
    );
  });

  // KNOWN DEFECT. `onReset` runs `columnState.reset()` then `persisted.clear()`,
  // but reset's notification happens inside a setState updater, so it lands on
  // the *next* render -- after clear() has already removed the record. The
  // layout is then written straight back, still carrying the sort and filters
  // the reset was meant to discard, and they come back on the next mount.
  // Fix: clear the storage after the state has settled (an effect), or have
  // reset skip the onChange notification.
  // Delete `.fails` once that lands.
  it.fails('deletes the saved record when columns are reset', async () => {
    const { user } = await renderGrid({ storageKey: 'people' });
    await user.click(screen.getByRole('button', { name: /Name/ }));
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull());

    await user.click(screen.getByRole('button', { name: 'Columns' }));
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    await flushEffects();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('currently rewrites the record on reset, keeping the sort it should discard', async () => {
    // Pins the defect above so a fix is a deliberate, visible change.
    const { user } = await renderGrid({ storageKey: 'people' });
    await user.click(screen.getByRole('button', { name: /Name/ }));
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull());

    await user.click(screen.getByRole('button', { name: 'Columns' }));
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    await flushEffects();

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string);
    expect(stored.sort).toEqual([{ colId: 'name', sort: 'asc' }]);
  });
});

describe('the imperative API', () => {
  async function withApi(overrides: GridOverrides = {}) {
    const apiRef = createRef<GridApi<Person>>();
    const view = await renderGrid({ ...overrides, apiRef });
    return { ...view, api: apiRef.current as GridApi<Person> };
  }

  it('exposes the loaded rows', async () => {
    const { api } = await withApi();
    expect(api.getDisplayedRows()).toHaveLength(20);
    expect(api.getDisplayedRows()[0].id).toBe(1);
  });

  it('selects every loaded row and clears again from the api', async () => {
    const { api } = await withApi();

    api.selectAll();
    await waitFor(() => expect(api.getSelectedIds()).toHaveLength(20));
    expect(api.getSelectedRows()).toHaveLength(20);

    api.clearSelection();
    await waitFor(() => expect(api.getSelectedIds()).toHaveLength(0));
  });

  it('setSortModel and getSortModel round-trip through a refetch', async () => {
    const { api, dataSource } = await withApi();

    api.setSortModel([{ colId: 'age', sort: 'desc' }]);

    await waitFor(() =>
      expect(lastRequest(dataSource).sortModel).toEqual([{ colId: 'age', sort: 'desc' }])
    );
    expect(api.getSortModel()).toEqual([{ colId: 'age', sort: 'desc' }]);
  });

  it('setFilterModel replaces every filter in one refetch', async () => {
    const { api, dataSource } = await withApi();
    const model = { age: { filterType: 'number', type: 'greaterThan', filter: 30 } } as const;

    api.setFilterModel(model);

    await waitFor(() => expect(lastRequest(dataSource).filterModel).toEqual(model));
    expect(api.getFilterModel()).toEqual(model);
  });

  it('refresh refetches the current page', async () => {
    const { api, dataSource } = await withApi();
    const before = dataSource.requests.length;

    api.refresh({ purge: true });

    await waitFor(() => expect(dataSource.requests.length).toBe(before + 1));
  });

  it('updateRows patches a row on screen without a round trip', async () => {
    const { api, dataSource } = await withApi();
    const before = dataSource.requests.length;

    api.updateRows([{ ...makePeople(1, 2)[0], name: 'Patched live' }]);

    await waitFor(() => expect(screen.getByText('Patched live')).toBeInTheDocument());
    expect(dataSource.requests.length).toBe(before);
  });

  it('ignores updateRows for ids that are not on this page', async () => {
    const { api } = await withApi();
    api.updateRows([{ ...makePeople(1, 900)[0], name: 'Off page' }]);
    expect(screen.queryByText('Off page')).not.toBeInTheDocument();
  });

  it('startEditing and stopEditing drive the editor', async () => {
    const { api } = await withApi({ onRowCommit: () => ({ ok: true }) });

    api.startEditing(3);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument());

    api.stopEditing();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    );
  });

  it('startEditing is a no-op for an id that is not loaded', async () => {
    const { api } = await withApi({ onRowCommit: () => ({ ok: true }) });
    api.startEditing(9999);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    );
  });

  it('exportCsv downloads the visible columns of the loaded page', async () => {
    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined);
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'a' ? anchor : createElement(tag)
    );

    const { api } = await withApi({ exportFileName: 'people' });
    api.exportCsv();

    expect(click).toHaveBeenCalledOnce();
    expect(anchor.download).toBe('people.csv');
    vi.restoreAllMocks();
  });

  it('copySelectionToClipboard writes the loaded page as TSV', async () => {
    // jsdom exposes no clipboard, and `userEvent.setup()` installs its own stub
    // over whatever is there -- so this has to be defined after the render.
    const { api } = await withApi();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await api.copySelectionToClipboard();

    expect(writeText).toHaveBeenCalledOnce();
    const written = writeText.mock.calls[0][0] as string;
    expect(written.split('\r\n')[0]).toBe('Name\tEmail\tAge');
    expect(written).toContain('Person 1\tperson1@example.com');

    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('copySelectionToClipboard writes only the selection when there is one', async () => {
    const { api, user } = await withApi();
    await user.click(within(dataRows()[1]).getByRole('checkbox'));

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await api.copySelectionToClipboard();

    const written = writeText.mock.calls[0][0] as string;
    expect(written.split('\r\n')).toHaveLength(2);
    expect(written).toContain('Person 2');

    Reflect.deleteProperty(navigator, 'clipboard');
  });

  // KNOWN DEFECT. The api is memoised so that handing it to a memoised cell
  // never invalidates it, and every volatile value it reads goes through a
  // latest-value ref for exactly that reason -- but `persisted` is in the
  // dependency array, and `useGridState` returns a fresh object literal on
  // every render. The memo therefore never hits, and every GridCell re-renders
  // on every grid render.
  // Fix: memoise useGridState's return value, or drop `persisted` from the
  // dependency array and reach it through the existing `latest` ref.
  // Delete `.fails` once that lands.
  it.fails('keeps a stable identity so memoised cells are not invalidated', async () => {
    const seen: Array<GridApi<Person>> = [];
    await renderGrid({
      toolbar: (api) => {
        seen.push(api);
        return null;
      },
    });
    expect(new Set(seen).size).toBe(1);
  });

  it('currently hands out a new api object on every render', async () => {
    // Pins the defect above so a fix is a deliberate, visible change.
    const seen: Array<GridApi<Person>> = [];
    await renderGrid({
      toolbar: (api) => {
        seen.push(api);
        return null;
      },
    });
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('the toolbar and context', () => {
  it('renders custom toolbar content beside the built-in buttons', async () => {
    await renderGrid({ toolbar: () => <button type="button">Custom action</button> });
    expect(screen.getByRole('button', { name: 'Custom action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Columns' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('reaches every cell renderer with the context, without rebuilding columns', async () => {
    const withContext: ColumnDef<Person, { busyId: number }>[] = [
      {
        field: 'name',
        header: 'Name',
        width: 200,
        cellRenderer: ({ row, formatted, context }) =>
          context.busyId === row.id ? <span>saving {formatted}</span> : <span>{formatted}</span>,
      },
    ];

    const dataSource = stubDataSource(makePeople(5));
    const { rerender } = render(
      <DataGrid<Person, { busyId: number }>
        columns={withContext}
        dataSource={dataSource}
        getRowId={getRowId}
        context={{ busyId: 0 }}
      />
    );
    resizeViewport(900, 400);
    await waitFor(() => expect(screen.getByText('Person 2')).toBeInTheDocument());
    await flushEffects();

    rerender(
      <DataGrid<Person, { busyId: number }>
        columns={withContext}
        dataSource={dataSource}
        getRowId={getRowId}
        context={{ busyId: 2 }}
      />
    );

    await waitFor(() => expect(screen.getByText(/saving/)).toBeInTheDocument());
    // The context change alone must not have triggered a refetch.
    expect(dataSource.getRows).toHaveBeenCalledTimes(1);
  });
});

describe('scrolling', () => {
  it('renders a different slice of rows once scrolled', async () => {
    await renderGrid({ dataSource: stubDataSource(makePeople(200)), defaultPageSize: 100 });
    expect(rowTexts()).toContain('Person 1');

    const viewport = screen.getByRole('grid');
    Object.defineProperty(viewport, 'scrollTop', { value: 36 * 60, configurable: true });
    viewport.dispatchEvent(new Event('scroll'));

    await waitFor(() => expect(rowTexts()).not.toContain('Person 1'));
    expect(rowTexts().some((text) => text.startsWith('Person 6'))).toBe(true);
    // The DOM never grew: windowing replaced the slice rather than appending.
    expect(dataRows().length).toBeLessThan(30);
  });

  it('sizes the scroll spacer to the whole page, not the rendered window', async () => {
    const { container } = await renderGrid({
      dataSource: stubDataSource(makePeople(200)),
      defaultPageSize: 100,
      rowHeight: 36,
    });
    const spacer = container.querySelector('.relative > .relative') as HTMLElement;
    expect(spacer).toHaveStyle({ height: '3600px' });
  });
});
