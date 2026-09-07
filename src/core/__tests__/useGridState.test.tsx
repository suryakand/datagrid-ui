import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGridState } from '../useGridState';
import { GRID_STATE_VERSION, type PersistedGridState } from '../../types';

const KEY = 'people';
const STORAGE_KEY = `hxg:${KEY}`;

function saved(overrides: Partial<PersistedGridState> = {}): PersistedGridState {
  return {
    v: GRID_STATE_VERSION,
    columns: { order: ['name'], hidden: [], widths: { name: 120 }, pinned: {} },
    sort: [{ colId: 'name', sort: 'asc' }],
    filters: { name: { filterType: 'text', type: 'contains', filter: 'a' } },
    pagination: { pageSize: 50 },
    ...overrides,
  };
}

function readBack(): PersistedGridState {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('restoring on mount', () => {
  it('reads the state stored under the hxg: prefix', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved()));
    const { result } = renderHook(() => useGridState(KEY));

    expect(result.current.initial).toEqual(saved());
    expect(result.current.hasSavedState).toBe(true);
  });

  it('returns undefined when nothing is stored', () => {
    const { result } = renderHook(() => useGridState(KEY));
    expect(result.current.initial).toBeUndefined();
    expect(result.current.hasSavedState).toBe(false);
  });

  it('discards state saved under a different schema version rather than migrating it', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...saved(), v: GRID_STATE_VERSION + 1 })
    );
    const { result } = renderHook(() => useGridState(KEY));
    expect(result.current.initial).toBeUndefined();
  });

  it('discards malformed JSON instead of throwing', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    const { result } = renderHook(() => useGridState(KEY));
    expect(result.current.initial).toBeUndefined();
  });

  it('discards a stored null', () => {
    window.localStorage.setItem(STORAGE_KEY, 'null');
    const { result } = renderHook(() => useGridState(KEY));
    expect(result.current.initial).toBeUndefined();
  });

  it('survives a localStorage that throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const { result } = renderHook(() => useGridState(KEY));
    expect(result.current.initial).toBeUndefined();
  });

  it('reads nothing at all when no storageKey is given', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved()));
    const { result } = renderHook(() => useGridState(undefined));
    expect(result.current.initial).toBeUndefined();
    expect(result.current.hasSavedState).toBe(false);
  });

  it('does not re-read when the component re-renders', () => {
    const { result, rerender } = renderHook(() => useGridState(KEY));
    expect(result.current.initial).toBeUndefined();

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved()));
    rerender();

    // `initial` is read once on mount so it is safe as a useState seed.
    expect(result.current.initial).toBeUndefined();
  });
});

describe('persisting', () => {
  it('writes the column layout, stamped with the schema version', () => {
    const { result } = renderHook(() => useGridState(KEY));
    const columns = { order: ['a', 'b'], hidden: ['b'], widths: { a: 90 }, pinned: {} };

    act(() => result.current.saveColumns(columns));

    expect(readBack()).toMatchObject({ v: GRID_STATE_VERSION, columns });
  });

  it('writes sort, filters and page size independently, merging into one record', () => {
    const { result } = renderHook(() => useGridState(KEY));

    act(() => result.current.saveSort([{ colId: 'age', sort: 'desc' }]));
    act(() =>
      result.current.saveFilters({
        age: { filterType: 'number', type: 'equals', filter: 30 },
      })
    );
    act(() => result.current.savePageSize(100));

    expect(readBack()).toMatchObject({
      sort: [{ colId: 'age', sort: 'desc' }],
      filters: { age: { filterType: 'number', type: 'equals', filter: 30 } },
      pagination: { pageSize: 100 },
    });
  });

  it('preserves the restored state for the keys it does not touch', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved()));
    const { result } = renderHook(() => useGridState(KEY));

    act(() => result.current.savePageSize(10));

    expect(readBack().sort).toEqual([{ colId: 'name', sort: 'asc' }]);
    expect(readBack().pagination).toEqual({ pageSize: 10 });
  });

  it('flips hasSavedState once something has been written', () => {
    const { result } = renderHook(() => useGridState(KEY));
    expect(result.current.hasSavedState).toBe(false);
    act(() => result.current.savePageSize(10));
    expect(result.current.hasSavedState).toBe(true);
  });

  it('writes nothing when no storageKey is given', () => {
    const { result } = renderHook(() => useGridState(undefined));
    act(() => result.current.savePageSize(10));
    expect(window.localStorage.length).toBe(0);
    expect(result.current.hasSavedState).toBe(false);
  });

  it('degrades quietly when the quota is exceeded', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useGridState(KEY));

    expect(() => act(() => result.current.savePageSize(10))).not.toThrow();
  });

  it('keeps every setter identity stable across saves, so effects do not resubscribe', () => {
    const { result } = renderHook(() => useGridState(KEY));
    const before = { ...result.current };

    act(() => result.current.savePageSize(10));
    act(() => result.current.saveSort([{ colId: 'x', sort: 'asc' }]));
    act(() => result.current.saveColumns({ order: [], hidden: [], widths: {}, pinned: {} }));

    expect(result.current.saveColumns).toBe(before.saveColumns);
    expect(result.current.saveSort).toBe(before.saveSort);
    expect(result.current.saveFilters).toBe(before.saveFilters);
    expect(result.current.savePageSize).toBe(before.savePageSize);
    expect(result.current.clear).toBe(before.clear);
    expect(result.current.initial).toBe(before.initial);
  });
});

describe('clear', () => {
  it('removes the record and resets hasSavedState', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved()));
    const { result } = renderHook(() => useGridState(KEY));

    act(() => result.current.clear());

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.hasSavedState).toBe(false);
  });

  it('leaves other grids alone', () => {
    window.localStorage.setItem('hxg:other', JSON.stringify(saved()));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved()));
    const { result } = renderHook(() => useGridState(KEY));

    act(() => result.current.clear());

    expect(window.localStorage.getItem('hxg:other')).not.toBeNull();
  });

  it('survives a localStorage that throws on remove', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const { result } = renderHook(() => useGridState(KEY));
    expect(() => act(() => result.current.clear())).not.toThrow();
  });

  it('is a no-op without a storageKey', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved()));
    const { result } = renderHook(() => useGridState(undefined));
    act(() => result.current.clear());
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});
