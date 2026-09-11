import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GridHeader } from '../GridHeader';
import { resolveColumn } from '../../core/values';
import type { ColumnDef, ColumnLayout, FilterModelMap, SortModelItem } from '../../types';
import { fakeHorizontalLayout, type Person } from '../../test/helpers';

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
  { field: 'email', header: 'Email', width: 200 },
  { field: 'age', header: 'Age', width: 100, sortable: false },
];

function setup(
  overrides: {
    definitions?: ColumnDef<Person, unknown>[];
    sortModel?: SortModelItem[];
    filterModel?: FilterModelMap;
    selectable?: boolean;
    allSelected?: boolean;
    someSelected?: boolean;
  } = {}
) {
  const handlers = {
    onToggleAll: vi.fn(),
    onSort: vi.fn(),
    onFilterChange: vi.fn(),
    onResize: vi.fn(),
    onMove: vi.fn(),
    onPin: vi.fn(),
  };
  const view = render(
    <GridHeader<Person, unknown>
      layout={layoutOf(overrides.definitions ?? columns)}
      sortModel={overrides.sortModel ?? []}
      filterModel={overrides.filterModel ?? {}}
      headerHeight={36}
      selectable={overrides.selectable ?? true}
      allSelected={overrides.allSelected ?? false}
      someSelected={overrides.someSelected ?? false}
      {...handlers}
    />
  );
  return { ...view, ...handlers, user: userEvent.setup() };
}

describe('structure and accessibility', () => {
  it('renders one columnheader per layout item, in order', () => {
    setup();
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(3);
    expect(headers[0]).toHaveTextContent('Name');
  });

  it('numbers the columns one-based via aria-colindex', () => {
    setup();
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((h) => h.getAttribute('aria-colindex'))).toEqual(['1', '2', '3']);
  });

  it('reports aria-sort for each column', () => {
    setup({ sortModel: [{ colId: 'name', sort: 'desc' }] });
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]).toHaveAttribute('aria-sort', 'descending');
    expect(headers[1]).toHaveAttribute('aria-sort', 'none');
  });

  it('reserves the selection gutter in its width and renders the header checkbox', () => {
    setup();
    expect(screen.getByRole('row')).toHaveStyle({ width: '490px', height: '36px' });
    expect(
      screen.getByRole('checkbox', { name: 'Select all rows on this page' })
    ).toBeInTheDocument();
  });

  it('drops the gutter and checkbox when selection is off', () => {
    setup({ selectable: false });
    expect(screen.getByRole('row')).toHaveStyle({ width: '450px' });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows the select-all checkbox as indeterminate for a partial selection', () => {
    setup({ someSelected: true });
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    expect(box).not.toBeChecked();
  });

  it('toggles the whole page from the header checkbox', async () => {
    const { onToggleAll, user } = setup();
    await user.click(screen.getByRole('checkbox'));
    expect(onToggleAll).toHaveBeenCalledOnce();
  });
});

describe('sorting', () => {
  it('reports a plain click as non-additive', async () => {
    const { onSort, user } = setup();
    await user.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSort).toHaveBeenCalledWith('name', false);
  });

  it('reports a shift-click as additive, which is what builds a multi-sort', async () => {
    const { onSort, user } = setup();
    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('button', { name: /Name/ }));
    await user.keyboard('{/Shift}');
    expect(onSort).toHaveBeenCalledWith('name', true);
  });

  it('disables the sort button for a non-sortable column', async () => {
    const { onSort, user } = setup();
    const ageButton = screen.getByRole('button', { name: 'Age' });
    expect(ageButton).toBeDisabled();

    await user.click(ageButton);
    expect(onSort).not.toHaveBeenCalled();
  });

  it('shows an arrow for the sorted direction', () => {
    const { rerender } = render(<div />);
    rerender(<div />);

    setup({ sortModel: [{ colId: 'name', sort: 'asc' }] });
    expect(screen.getByRole('button', { name: /Name/ })).toHaveTextContent('↑');
  });

  it('shows a down arrow for a descending sort', () => {
    setup({ sortModel: [{ colId: 'name', sort: 'desc' }] });
    expect(screen.getByRole('button', { name: /Name/ })).toHaveTextContent('↓');
  });

  it('numbers each column once more than one sort is active', () => {
    setup({
      sortModel: [
        { colId: 'email', sort: 'asc' },
        { colId: 'name', sort: 'desc' },
      ],
    });
    expect(screen.getByRole('button', { name: /Email/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /Name/ })).toHaveTextContent('2');
  });

  it('omits the ordinal for a single sort', () => {
    setup({ sortModel: [{ colId: 'name', sort: 'asc' }] });
    expect(screen.getByRole('button', { name: /Name/ }).textContent).not.toMatch(/\d/);
  });
});

describe('the filter button', () => {
  it('appears only for columns with a filter kind', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Filter name' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filter email' })).not.toBeInTheDocument();
  });

  it('opens the popover', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Filter name' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  // KNOWN DEFECT. The button's own toggle races the popover's outside-click
  // dismissal: `mousedown` lands first and sets openFilter to null, so by the
  // time `click` runs its `current === colId ? null : colId` check, `current`
  // is already null and it re-opens. The icon can therefore open the popover
  // but never close it -- the user has to click elsewhere or press Escape.
  // Fix: have FilterPopover ignore mousedowns on its own trigger, or drop the
  // toggle and make the button open-only.
  // Delete `.fails` once that lands.
  it.fails('closes the popover when its own button is clicked again', async () => {
    const { user } = setup();
    const button = screen.getByRole('button', { name: 'Filter name' });

    await user.click(button);
    await user.click(button);

    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });

  it('currently leaves the popover open on a second click of its own button', async () => {
    // Pins the defect above so a fix is a deliberate, visible change.
    const { user } = setup();
    const button = screen.getByRole('button', { name: 'Filter name' });

    await user.click(button);
    await user.click(button);

    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('closes the popover on Escape', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Filter name' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });

  it('forwards the applied filter and closes the popover', async () => {
    const { onFilterChange, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Filter name' }));
    await user.type(screen.getByPlaceholderText('Value'), 'acme');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onFilterChange).toHaveBeenCalledWith('name', {
      filterType: 'text',
      type: 'contains',
      filter: 'acme',
    });
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });

  it('highlights and describes an active filter in its tooltip', () => {
    setup({
      filterModel: { name: { filterType: 'text', type: 'contains', filter: 'acme' } },
    });
    const button = screen.getByRole('button', { name: 'Filter name' });
    expect(button).toHaveAttribute('title', 'acme');
    expect(button.className).toContain('text-brand-500');
  });

  it('passes the column filterParams values through to a set popover', async () => {
    const { user } = setup({
      definitions: [
        {
          field: 'active',
          header: 'Active',
          width: 100,
          filter: 'set',
          filterParams: { values: ['YES', 'NO'] },
        },
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Filter active' }));
    expect(screen.getByRole('checkbox', { name: 'YES' })).toBeInTheDocument();
  });
});

describe('the column menu', () => {
  it('offers pin left and pin right', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Options for name' }));

    expect(screen.getByRole('button', { name: 'Pin left' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pin right' })).toBeInTheDocument();
  });

  it('pins the column and closes the menu', async () => {
    const { onPin, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Options for name' }));
    await user.click(screen.getByRole('button', { name: 'Pin left' }));

    expect(onPin).toHaveBeenCalledWith('name', 'left');
    expect(screen.queryByRole('button', { name: 'Pin left' })).not.toBeInTheDocument();
  });

  it('offers to unpin the side the column is already pinned to', async () => {
    const { onPin, user } = setup({
      definitions: [{ field: 'name', header: 'Name', width: 150, pinned: 'left' }],
    });
    await user.click(screen.getByRole('button', { name: 'Options for name' }));

    expect(screen.getByRole('button', { name: 'Pin right' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Unpin left' }));
    expect(onPin).toHaveBeenCalledWith('name', undefined);
  });

  it('closes when the pointer leaves it', async () => {
    const { onPin, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Options for name' }));
    const menu = screen.getByRole('button', { name: 'Pin left' }).parentElement!;
    await user.hover(menu);
    await user.unhover(menu);

    expect(screen.queryByRole('button', { name: 'Pin left' })).not.toBeInTheDocument();
    expect(onPin).not.toHaveBeenCalled();
  });

  it('closes the filter popover when the menu opens, and vice versa', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Filter name' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Options for name' }));
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pin left' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filter name' }));
    expect(screen.queryByRole('button', { name: 'Pin left' })).not.toBeInTheDocument();
  });
});

// Both popups hang off the right edge of their column, so under a narrow first
// column they would start left of the grid and be clipped.
describe('header popups under a narrow first column', () => {
  // The header cell's only child div without a role (the other is the resize
  // handle) is whichever popup is open.
  const isPopup = (element: Element) =>
    element.tagName === 'DIV' &&
    !element.hasAttribute('role') &&
    element.parentElement?.getAttribute('role') === 'columnheader';

  const popupOf = (button: HTMLElement) =>
    [...button.closest('[role="columnheader"]')!.children].find(isPopup) as HTMLElement;

  function setupNarrow() {
    // Right-aligned under a column whose right edge is 100px into the page.
    fakeHorizontalLayout((element) => {
      if (!isPopup(element)) return undefined;
      const width = element.textContent?.includes('Apply') ? 240 : 144;
      return { left: 100 - width, width };
    });
    return setup();
  }

  it('slides the filter popover right until its left edge is visible', async () => {
    const { user } = setupNarrow();
    const button = screen.getByRole('button', { name: 'Filter name' });
    await user.click(button);
    expect(popupOf(button).getBoundingClientRect().left).toBe(4);
  });

  it('slides the column menu right until its left edge is visible', async () => {
    const { user } = setupNarrow();
    const button = screen.getByRole('button', { name: 'Options for name' });
    await user.click(button);
    expect(popupOf(button).getBoundingClientRect().left).toBe(4);
  });
});

describe('resizing', () => {
  function handleFor(label: string): HTMLElement {
    const header = screen
      .getAllByRole('columnheader')
      .find((element) => element.textContent?.includes(label)) as HTMLElement;
    return header.querySelector('[role="separator"]') as HTMLElement;
  }

  it('reports the new width as the pointer moves', () => {
    const { onResize } = setup();
    const handle = handleFor('Name');

    fireEvent.pointerDown(handle, { clientX: 150, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 230, pointerId: 1 });

    expect(onResize).toHaveBeenCalledWith('name', 230);
  });

  it('reports a shrink as the pointer moves back', () => {
    const { onResize } = setup();
    const handle = handleFor('Name');

    fireEvent.pointerDown(handle, { clientX: 150, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 100, pointerId: 1 });

    expect(onResize).toHaveBeenCalledWith('name', 100);
  });

  it('floors the width at 40px however far left the pointer goes', () => {
    const { onResize } = setup();
    const handle = handleFor('Name');

    fireEvent.pointerDown(handle, { clientX: 150, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: -500, pointerId: 1 });

    expect(onResize).toHaveBeenLastCalledWith('name', 40);
  });

  it('ignores pointer moves that did not start on the handle', () => {
    const { onResize } = setup();
    fireEvent.pointerMove(handleFor('Name'), { clientX: 400, pointerId: 1 });
    expect(onResize).not.toHaveBeenCalled();
  });

  it('stops reporting once the pointer is released', () => {
    const { onResize } = setup();
    const handle = handleFor('Name');

    fireEvent.pointerDown(handle, { clientX: 150, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 200, pointerId: 1 });
    onResize.mockClear();
    fireEvent.pointerMove(handle, { clientX: 400, pointerId: 1 });

    expect(onResize).not.toHaveBeenCalled();
  });

  it('stops reporting when the pointer interaction is cancelled', () => {
    const { onResize } = setup();
    const handle = handleFor('Name');

    fireEvent.pointerDown(handle, { clientX: 150, pointerId: 1 });
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    onResize.mockClear();
    fireEvent.pointerMove(handle, { clientX: 400, pointerId: 1 });

    expect(onResize).not.toHaveBeenCalled();
  });

  it('offers no handle on a non-resizable column', () => {
    setup({ definitions: [{ field: 'name', header: 'Name', width: 150, resizable: false }] });
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('does not sort when the resize handle is clicked', async () => {
    const { onSort, user } = setup();
    await user.click(handleFor('Name'));
    expect(onSort).not.toHaveBeenCalled();
  });
});

describe('drag to reorder', () => {
  function headerFor(label: string): HTMLElement {
    return screen
      .getAllByRole('columnheader')
      .find((element) => element.textContent?.includes(label)) as HTMLElement;
  }

  const dataTransfer = () => ({ effectAllowed: '', setData: vi.fn(), getData: vi.fn() });

  it('moves the dragged column to the drop target index', () => {
    const { onMove } = setup();

    fireEvent.dragStart(headerFor('Age'), { dataTransfer: dataTransfer() });
    fireEvent.drop(headerFor('Name'), { dataTransfer: dataTransfer() });

    expect(onMove).toHaveBeenCalledWith('age', 0);
  });

  it('dims the column while it is being dragged', () => {
    setup();
    const source = headerFor('Age');
    fireEvent.dragStart(source, { dataTransfer: dataTransfer() });
    expect(source.className).toContain('opacity-40');

    fireEvent.dragEnd(source);
    expect(source.className).not.toContain('opacity-40');
  });

  it('ignores a drop onto the column being dragged', () => {
    const { onMove } = setup();
    fireEvent.dragStart(headerFor('Age'), { dataTransfer: dataTransfer() });
    fireEvent.drop(headerFor('Age'), { dataTransfer: dataTransfer() });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('marks a lockPosition column as not draggable', () => {
    setup({
      definitions: [{ field: 'name', header: 'Name', width: 150, lockPosition: true }],
    });
    expect(headerFor('Name')).toHaveAttribute('draggable', 'false');
  });
});
