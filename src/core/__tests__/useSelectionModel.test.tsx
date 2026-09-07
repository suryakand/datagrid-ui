import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSelectionModel } from '../useSelectionModel';
import { makePeople, type Person } from '../../test/helpers';

const getRowId = (row: Person) => row.id;

function render(rows: Person[] = makePeople(5), onSelectionChanged = vi.fn()) {
  const view = renderHook(
    (props: { rows: Person[] }) =>
      useSelectionModel<Person>(props.rows, getRowId, onSelectionChanged),
    { initialProps: { rows } }
  );
  return { ...view, onSelectionChanged };
}

describe('single-row toggling', () => {
  it('starts with nothing selected', () => {
    const { result } = render();
    expect([...result.current.selectedIds]).toEqual([]);
    expect(result.current.allVisibleSelected).toBe(false);
    expect(result.current.someVisibleSelected).toBe(false);
  });

  it('selects then deselects the same row', () => {
    const { result } = render();

    act(() => result.current.toggleRow(2, 1, false));
    expect(result.current.isSelected(2)).toBe(true);

    act(() => result.current.toggleRow(2, 1, false));
    expect(result.current.isSelected(2)).toBe(false);
  });

  it('reports every selected id to onSelectionChanged', () => {
    const { result, onSelectionChanged } = render();

    act(() => result.current.toggleRow(1, 0, false));
    act(() => result.current.toggleRow(3, 2, false));

    expect(onSelectionChanged).toHaveBeenLastCalledWith([1, 3]);
  });
});

describe('shift-range selection', () => {
  it('extends the selection from the last toggled row', () => {
    const { result } = render();

    act(() => result.current.toggleRow(1, 0, false));
    act(() => result.current.toggleRow(4, 3, true));

    expect([...result.current.selectedIds].sort()).toEqual([1, 2, 3, 4]);
  });

  it('extends upwards as well as downwards', () => {
    const { result } = render();

    act(() => result.current.toggleRow(5, 4, false));
    act(() => result.current.toggleRow(3, 2, true));

    expect([...result.current.selectedIds].sort()).toEqual([3, 4, 5]);
  });

  it('deselects the range when the anchored row is already selected', () => {
    const { result } = render();

    act(() => result.current.selectAllVisible());
    act(() => result.current.toggleRow(1, 0, false)); // anchor at 0, now deselected
    act(() => result.current.toggleRow(4, 3, true)); // 4 is selected -> clear 0..3

    expect([...result.current.selectedIds]).toEqual([5]);
  });

  it('falls back to a plain toggle when there is no anchor yet', () => {
    const { result } = render();
    act(() => result.current.toggleRow(3, 2, true));
    expect([...result.current.selectedIds]).toEqual([3]);
  });

  it('falls back to a plain toggle when shift-clicking the anchor itself', () => {
    const { result } = render();
    act(() => result.current.toggleRow(3, 2, false));
    act(() => result.current.toggleRow(3, 2, true));
    expect([...result.current.selectedIds]).toEqual([]);
  });

  it('re-anchors on every toggle, so two shift-clicks chain', () => {
    const { result } = render();

    act(() => result.current.toggleRow(1, 0, false)); // anchor 0
    act(() => result.current.toggleRow(2, 1, true)); // anchor 1, selects 0..1
    act(() => result.current.toggleRow(4, 3, true)); // anchor 3, selects 1..3

    expect([...result.current.selectedIds].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('select-all over the visible page', () => {
  it('selects every visible row and reports all-selected', () => {
    const { result } = render();
    act(() => result.current.toggleAllVisible());

    expect(result.current.allVisibleSelected).toBe(true);
    expect(result.current.someVisibleSelected).toBe(false);
    expect([...result.current.selectedIds].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('deselects every visible row when they are already all selected', () => {
    const { result } = render();
    act(() => result.current.toggleAllVisible());
    act(() => result.current.toggleAllVisible());
    expect([...result.current.selectedIds]).toEqual([]);
  });

  it('reports the indeterminate state when only some visible rows are selected', () => {
    const { result } = render();
    act(() => result.current.toggleRow(2, 1, false));

    expect(result.current.allVisibleSelected).toBe(false);
    expect(result.current.someVisibleSelected).toBe(true);
  });

  it('selectAllVisible adds without ever deselecting', () => {
    const { result } = render();
    act(() => result.current.selectAllVisible());
    act(() => result.current.selectAllVisible());
    expect([...result.current.selectedIds].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('is not "all selected" when the page is empty', () => {
    const { result } = render([]);
    expect(result.current.allVisibleSelected).toBe(false);
    expect(result.current.someVisibleSelected).toBe(false);
  });

  it('clears the shift anchor, so the next shift-click is a plain toggle', () => {
    const { result } = render();
    act(() => result.current.toggleRow(1, 0, false));
    act(() => result.current.toggleAllVisible());
    act(() => result.current.toggleAllVisible()); // back to empty, anchor cleared
    act(() => result.current.toggleRow(4, 3, true));
    expect([...result.current.selectedIds]).toEqual([4]);
  });
});

describe('selection across pages', () => {
  it('keeps ids selected when their rows leave the loaded page', () => {
    const { result, rerender } = render(makePeople(5, 1));
    act(() => result.current.toggleRow(1, 0, false));
    act(() => result.current.toggleRow(2, 1, false));

    rerender({ rows: makePeople(5, 100) });

    expect([...result.current.selectedIds].sort()).toEqual([1, 2]);
    // None of them are on screen any more.
    expect(result.current.getSelectedRows()).toEqual([]);
    expect(result.current.someVisibleSelected).toBe(false);
  });

  it('returns only the loaded subset from getSelectedRows', () => {
    const { result, rerender } = render(makePeople(5, 1));
    act(() => result.current.toggleAllVisible());

    rerender({ rows: makePeople(5, 3) }); // ids 3..7 now on screen

    expect(result.current.getSelectedRows().map(getRowId)).toEqual([3, 4, 5]);
  });

  it('recomputes all/some visible against the new page', () => {
    const { result, rerender } = render(makePeople(5, 1));
    act(() => result.current.toggleAllVisible());
    expect(result.current.allVisibleSelected).toBe(true);

    rerender({ rows: makePeople(5, 3) });
    expect(result.current.allVisibleSelected).toBe(false);
    expect(result.current.someVisibleSelected).toBe(true);
  });

  it('clear() drops rows on other pages too', () => {
    const { result, rerender, onSelectionChanged } = render(makePeople(5, 1));
    act(() => result.current.toggleAllVisible());
    rerender({ rows: makePeople(5, 100) });

    act(() => result.current.clear());

    expect([...result.current.selectedIds]).toEqual([]);
    expect(onSelectionChanged).toHaveBeenLastCalledWith([]);
  });
});
