import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useColumnState } from '../useColumnState';
import type { ColumnDef, PersistedGridState } from '../../types';
import type { Person } from '../../test/helpers';

const columns: ColumnDef<Person>[] = [
  { field: 'name', header: 'Name', width: 100 },
  { field: 'email', header: 'Email', width: 200 },
  { field: 'age', header: 'Age', width: 50, minWidth: 60 },
];

type Persisted = PersistedGridState['columns'];

function render(
  cols: ColumnDef<Person>[] = columns,
  persisted?: Persisted,
  availableWidth = 1000
) {
  const onChange = vi.fn();
  const view = renderHook(() =>
    useColumnState<Person, unknown>(cols, persisted, onChange, availableWidth)
  );
  return { ...view, onChange };
}

describe('defaults from the column definitions', () => {
  it('orders columns as declared and shows them all', () => {
    const { result } = render();
    expect(result.current.state.order).toEqual(['name', 'email', 'age']);
    expect(result.current.visibleColumns.map((c) => c.colId)).toEqual([
      'name',
      'email',
      'age',
    ]);
  });

  it('starts a column with hide: true in the hidden set but keeps it in allColumns', () => {
    const { result } = render([
      { field: 'name', header: 'Name' },
      { field: 'email', header: 'Email', hide: true },
    ]);
    expect(result.current.isHidden('email')).toBe(true);
    expect(result.current.visibleColumns.map((c) => c.colId)).toEqual(['name']);
    expect(result.current.allColumns.map((c) => c.colId)).toEqual(['name', 'email']);
  });

  it('clamps a declared width below minWidth up to minWidth', () => {
    const { result } = render();
    expect(result.current.visibleColumns.find((c) => c.colId === 'age')?.width).toBe(60);
  });

  it('seeds pinned columns from the definitions', () => {
    const { result } = render([
      { field: 'name', header: 'Name', width: 100, pinned: 'left' },
      { field: 'email', header: 'Email', width: 100 },
    ]);
    expect(result.current.state.pinned).toEqual({ name: 'left' });
  });
});

describe('merging persisted state over the defaults', () => {
  it('keeps the saved order for columns that still exist', () => {
    const { result } = render(columns, {
      order: ['age', 'name', 'email'],
      hidden: [],
      widths: {},
      pinned: {},
    });
    expect(result.current.state.order).toEqual(['age', 'name', 'email']);
  });

  it('drops saved ids for columns that no longer exist', () => {
    const { result } = render(columns, {
      order: ['gone', 'age', 'name', 'email'],
      hidden: ['gone'],
      widths: { gone: 500 },
      pinned: {},
    });
    expect(result.current.state.order).toEqual(['age', 'name', 'email']);
    expect(result.current.state.hidden).toEqual([]);
  });

  it('inserts a newly added column near its declared position rather than at the end', () => {
    // Saved layout predates `age`, which is declared third.
    const { result } = render(columns, {
      order: ['email', 'name'],
      hidden: [],
      widths: {},
      pinned: {},
    });
    expect(result.current.state.order).toEqual(['email', 'name', 'age']);
  });

  it('does not hide a new column just because the saved state predates it', () => {
    const withNew: ColumnDef<Person>[] = [...columns, { field: 'active', header: 'Active' }];
    const { result } = render(withNew, {
      order: ['name', 'email', 'age'],
      hidden: [],
      widths: {},
      pinned: {},
    });
    expect(result.current.isHidden('active')).toBe(false);
    expect(result.current.state.order).toContain('active');
  });

  it('merges widths key by key instead of replacing the defaults wholesale', () => {
    const { result } = render(columns, {
      order: ['name', 'email', 'age'],
      hidden: [],
      widths: { name: 333 },
      pinned: {},
    });
    // `name` is overridden; `email` keeps its declared 200.
    expect(result.current.state.widths).toEqual({ name: 333, email: 200, age: 50 });
  });

  it('merges pinned key by key', () => {
    const declared: ColumnDef<Person>[] = [
      { field: 'name', header: 'Name', pinned: 'left' },
      { field: 'email', header: 'Email' },
    ];
    const { result } = render(declared, {
      order: ['name', 'email'],
      hidden: [],
      widths: {},
      pinned: { email: 'right' },
    });
    expect(result.current.state.pinned).toEqual({ name: 'left', email: 'right' });
  });

  it('lets a saved empty hidden list reveal a column declared with hide: true', () => {
    const declared: ColumnDef<Person>[] = [
      { field: 'name', header: 'Name' },
      { field: 'email', header: 'Email', hide: true },
    ];
    const { result } = render(declared, {
      order: ['name', 'email'],
      hidden: [],
      widths: {},
      pinned: {},
    });
    expect(result.current.isHidden('email')).toBe(false);
  });

  it('falls back to the defaults entirely when nothing is persisted', () => {
    const { result } = render(columns, undefined);
    expect(result.current.state.order).toEqual(['name', 'email', 'age']);
  });
});

describe('mutators', () => {
  it('hides and shows a column, notifying onChange each time', () => {
    const { result, onChange } = render();

    act(() => result.current.setHidden('email', true));
    expect(result.current.isHidden('email')).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ hidden: ['email'] })
    );

    act(() => result.current.setHidden('email', false));
    expect(result.current.isHidden('email')).toBe(false);
  });

  it('does not add a duplicate when hiding an already hidden column', () => {
    const { result } = render();
    act(() => result.current.setHidden('email', true));
    act(() => result.current.setHidden('email', true));
    expect(result.current.state.hidden).toEqual(['email']);
  });

  it('rounds a resize and clamps it up to minWidth', () => {
    const { result } = render();
    act(() => result.current.setWidth('name', 240.6));
    expect(result.current.state.widths.name).toBe(241);

    act(() => result.current.setWidth('age', 10));
    expect(result.current.visibleColumns.find((c) => c.colId === 'age')?.width).toBe(60);
  });

  it('pins and unpins a column', () => {
    const { result } = render();
    act(() => result.current.setPinned('name', 'left'));
    expect(result.current.state.pinned).toEqual({ name: 'left' });

    act(() => result.current.setPinned('name', undefined));
    expect(result.current.state.pinned).toEqual({});
  });

  it('moves a column to a new index', () => {
    const { result } = render();
    act(() => result.current.moveColumn('age', 0));
    expect(result.current.state.order).toEqual(['age', 'name', 'email']);
  });

  it('clamps an out-of-range move index to the ends', () => {
    const { result } = render();
    act(() => result.current.moveColumn('name', 99));
    expect(result.current.state.order).toEqual(['email', 'age', 'name']);

    act(() => result.current.moveColumn('name', -5));
    expect(result.current.state.order).toEqual(['name', 'email', 'age']);
  });

  it('leaves the order untouched for an unknown column or a move to its own index', () => {
    const { result, onChange } = render();
    act(() => result.current.moveColumn('nope', 0));
    act(() => result.current.moveColumn('name', 0));

    expect(result.current.state.order).toEqual(['name', 'email', 'age']);
    // `update` notifies from inside the state updater, so onChange still fires
    // for a no-op move -- with the unchanged state, which is harmless to persist.
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ order: ['name', 'email', 'age'] })
    );
  });

  it('resets back to the definitions defaults', () => {
    const { result, onChange } = render();
    act(() => result.current.setHidden('email', true));
    act(() => result.current.setWidth('name', 400));
    act(() => result.current.moveColumn('age', 0));

    act(() => result.current.reset());

    expect(result.current.state).toEqual({
      order: ['name', 'email', 'age'],
      hidden: [],
      widths: { name: 100, email: 200, age: 50 },
      pinned: {},
    });
    expect(onChange).toHaveBeenLastCalledWith(result.current.state);
  });
});

describe('layout geometry', () => {
  it('lays fixed columns out left to right and reports the total width', () => {
    const { result } = render(columns, undefined, 1000);
    const { items, totalWidth } = result.current.layout;

    expect(items.map((i) => [i.colId, i.left, i.width])).toEqual([
      ['name', 0, 100],
      ['email', 100, 200],
      ['age', 300, 60],
    ]);
    expect(totalWidth).toBe(360);
  });

  it('shares the leftover space between flex columns in proportion', () => {
    const flexColumns: ColumnDef<Person>[] = [
      { field: 'name', header: 'Name', width: 100 },
      { field: 'email', header: 'Email', flex: 1 },
      { field: 'age', header: 'Age', flex: 3 },
    ];
    const { result } = render(flexColumns, undefined, 500);
    // spare = 500 - 100 fixed = 400, split 1:3.
    expect(result.current.layout.items.map((i) => i.width)).toEqual([100, 100, 300]);
  });

  it('never shrinks a flex column below its minWidth', () => {
    const flexColumns: ColumnDef<Person>[] = [
      { field: 'name', header: 'Name', width: 400 },
      { field: 'email', header: 'Email', flex: 1, minWidth: 120 },
    ];
    const { result } = render(flexColumns, undefined, 400);
    // No spare space at all, but minWidth still holds.
    expect(result.current.layout.items[1].width).toBe(120);
  });

  it('caps a flex column at its maxWidth', () => {
    const flexColumns: ColumnDef<Person>[] = [
      { field: 'email', header: 'Email', flex: 1, maxWidth: 150 },
    ];
    const { result } = render(flexColumns, undefined, 1000);
    expect(result.current.layout.items[0].width).toBe(150);
  });

  it('groups columns into left-pinned, unpinned and right-pinned bands', () => {
    const pinnedColumns: ColumnDef<Person>[] = [
      { field: 'name', header: 'Name', width: 100 },
      { field: 'email', header: 'Email', width: 200, pinned: 'right' },
      { field: 'age', header: 'Age', width: 80, pinned: 'left' },
    ];
    const { result } = render(pinnedColumns, undefined, 1000);
    expect(result.current.layout.items.map((i) => i.colId)).toEqual([
      'age',
      'name',
      'email',
    ]);
  });

  it('accumulates left sticky offsets from the left edge', () => {
    const pinnedColumns: ColumnDef<Person>[] = [
      { field: 'name', header: 'Name', width: 100, pinned: 'left' },
      { field: 'email', header: 'Email', width: 200, pinned: 'left' },
      { field: 'age', header: 'Age', width: 80 },
    ];
    const { result } = render(pinnedColumns, undefined, 1000);
    const offsets = Object.fromEntries(
      result.current.layout.items.map((i) => [i.colId, i.stickyOffset])
    );
    expect(offsets).toEqual({ name: 0, email: 100, age: 0 });
    expect(result.current.layout.leftPinnedWidth).toBe(300);
  });

  it('accumulates right sticky offsets from the right edge, walking backwards', () => {
    const pinnedColumns: ColumnDef<Person>[] = [
      { field: 'name', header: 'Name', width: 100 },
      { field: 'email', header: 'Email', width: 200, pinned: 'right' },
      { field: 'age', header: 'Age', width: 80, pinned: 'right' },
    ];
    const { result } = render(pinnedColumns, undefined, 1000);
    const offsets = Object.fromEntries(
      result.current.layout.items.map((i) => [i.colId, i.stickyOffset])
    );
    // `age` is the outermost right column, so it sits flush at 0.
    expect(offsets).toEqual({ name: 0, email: 80, age: 0 });
    expect(result.current.layout.rightPinnedWidth).toBe(280);
  });

  it('excludes hidden columns from the layout and the total width', () => {
    const { result } = render();
    act(() => result.current.setHidden('email', true));
    expect(result.current.layout.items.map((i) => i.colId)).toEqual(['name', 'age']);
    expect(result.current.layout.totalWidth).toBe(160);
  });

  it('recomputes when the available width changes', () => {
    const flexColumns: ColumnDef<Person>[] = [{ field: 'email', header: 'E', flex: 1 }];
    const narrow = renderHook(
      ({ width }: { width: number }) =>
        useColumnState<Person, unknown>(flexColumns, undefined, () => undefined, width),
      { initialProps: { width: 300 } }
    );
    expect(narrow.result.current.layout.items[0].width).toBe(300);

    narrow.rerender({ width: 900 });
    expect(narrow.result.current.layout.items[0].width).toBe(900);
  });
});
