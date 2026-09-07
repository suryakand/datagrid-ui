import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useServerDataSource } from '../useServerDataSource';
import type { FilterModelMap, HxDataSource, SortModelItem } from '../../types';
import { controllableDataSource, makePeople, stubDataSource, type Person } from '../../test/helpers';

const NO_SORT: SortModelItem[] = [];
const NO_FILTER: FilterModelMap = {};

interface Props {
  dataSource: HxDataSource<Person>;
  page?: number;
  pageSize?: number;
  sortModel?: SortModelItem[];
  filterModel?: FilterModelMap;
  maxCachedBlocks?: number;
  onError?: (error: unknown) => void;
}

function render(initial: Props) {
  return renderHook(
    (props: Props) =>
      useServerDataSource<Person>({
        dataSource: props.dataSource,
        page: props.page ?? 0,
        pageSize: props.pageSize ?? 10,
        sortModel: props.sortModel ?? NO_SORT,
        filterModel: props.filterModel ?? NO_FILTER,
        maxCachedBlocks: props.maxCachedBlocks,
        onError: props.onError,
      }),
    { initialProps: initial }
  );
}

describe('the request it builds', () => {
  it('asks for the requested page as a half-open [startRow, endRow) range', async () => {
    const people = makePeople(100);
    const source = stubDataSource(people);
    const { result } = render({ dataSource: source, page: 2, pageSize: 10 });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(source.requests[0]).toMatchObject({ startRow: 20, endRow: 30 });
    expect(result.current.rows.map((row) => row.id)).toEqual([
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    ]);
  });

  it('forwards the sort and filter models verbatim', async () => {
    const sortModel: SortModelItem[] = [{ colId: 'name', sort: 'desc' }];
    const filterModel: FilterModelMap = {
      age: { filterType: 'number', type: 'greaterThan', filter: 30 },
    };
    const source = stubDataSource(makePeople(5));
    const { result } = render({ dataSource: source, sortModel, filterModel });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(source.requests[0].sortModel).toEqual(sortModel);
    expect(source.requests[0].filterModel).toEqual(filterModel);
  });

  it('sends the ag-grid compatibility fields empty on every request', async () => {
    // These exist only so backends written for ag-grid's server-side row model
    // do not fall over. They are deliberately never populated.
    const source = stubDataSource(makePeople(5));
    const { result } = render({ dataSource: source });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(source.requests[0]).toMatchObject({
      rowGroupCols: [],
      valueCols: [],
      pivotCols: [],
      pivotMode: false,
      groupKeys: [],
    });
  });

  it('passes an AbortSignal to the data source', async () => {
    const { dataSource, calls } = controllableDataSource<Person>();
    render({ dataSource });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
    expect(calls[0].signal.aborted).toBe(false);
  });
});

describe('the response it accepts', () => {
  it('takes totalRows from lastRow, not from rows.length', async () => {
    const source = stubDataSource(makePeople(200), { lastRow: 4321 });
    const { result } = render({ dataSource: source, pageSize: 10 });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rows).toHaveLength(10);
    expect(result.current.totalRows).toBe(4321);
  });

  it('falls back to rows.length when lastRow is absent', async () => {
    const { dataSource, calls } = controllableDataSource<Person>();
    const { result } = render({ dataSource });

    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => {
      calls[0].deferred.resolve({
        rows: makePeople(3),
      } as unknown as { rows: Person[]; lastRow: number });
    });

    expect(result.current.totalRows).toBe(3);
  });

  it('preserves a lastRow of -1, the documented "unknown total"', async () => {
    const source = stubDataSource(makePeople(10), { lastRow: -1 });
    const { result } = render({ dataSource: source });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalRows).toBe(-1);
  });

  it('starts with an empty page and no rows before the first response lands', () => {
    const { dataSource } = controllableDataSource<Person>();
    const { result } = render({ dataSource });

    expect(result.current.rows).toEqual([]);
    expect(result.current.totalRows).toBe(0);
    expect(result.current.error).toBeNull();
  });
});

describe('the sequence number and abort guard', () => {
  it('ignores a stale response that lands after a newer one', async () => {
    const { dataSource, calls } = controllableDataSource<Person>();
    const { result, rerender } = render({ dataSource, page: 0 });

    await waitFor(() => expect(calls).toHaveLength(1));

    // Supersede request 0 before it has answered.
    rerender({ dataSource, page: 1 });
    await waitFor(() => expect(calls).toHaveLength(2));

    await act(async () => {
      calls[1].deferred.resolve({ rows: makePeople(1, 900), lastRow: 50 });
    });
    expect(result.current.rows.map((r) => r.id)).toEqual([900]);

    // The superseded request answers late. It must not overwrite anything.
    await act(async () => {
      calls[0].deferred.resolve({ rows: makePeople(1, 100), lastRow: 999 });
    });

    expect(result.current.rows.map((r) => r.id)).toEqual([900]);
    expect(result.current.totalRows).toBe(50);
  });

  it('aborts the in-flight request when the query changes', async () => {
    const { dataSource, calls } = controllableDataSource<Person>();
    const { rerender } = render({ dataSource, sortModel: [] });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].signal.aborted).toBe(false);

    rerender({ dataSource, sortModel: [{ colId: 'name', sort: 'asc' }] });

    await waitFor(() => expect(calls[0].signal.aborted).toBe(true));
  });

  it('aborts the in-flight request on unmount', async () => {
    const { dataSource, calls } = controllableDataSource<Person>();
    const { unmount } = render({ dataSource });

    await waitFor(() => expect(calls).toHaveLength(1));
    unmount();

    expect(calls[0].signal.aborted).toBe(true);
  });

  it('does not report an aborted request as an error', async () => {
    const onError = vi.fn();
    const { dataSource, calls } = controllableDataSource<Person>();
    const { result, rerender } = render({ dataSource, page: 0, onError });

    await waitFor(() => expect(calls).toHaveLength(1));
    rerender({ dataSource, page: 1, onError });
    await waitFor(() => expect(calls[0].signal.aborted).toBe(true));

    await act(async () => {
      calls[0].deferred.reject(
        Object.assign(new Error('aborted'), { name: 'AbortError' })
      );
    });

    expect(onError).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });
});

describe('the block cache', () => {
  it('serves a page it has already fetched without a second request', async () => {
    const source = stubDataSource(makePeople(100));
    const { result, rerender } = render({ dataSource: source, page: 0, pageSize: 10 });

    await waitFor(() => expect(result.current.rows).toHaveLength(10));
    rerender({ dataSource: source, page: 1, pageSize: 10 });
    await waitFor(() => expect(result.current.rows[0].id).toBe(11));

    rerender({ dataSource: source, page: 0, pageSize: 10 });
    await waitFor(() => expect(result.current.rows[0].id).toBe(1));

    expect(source.getRows).toHaveBeenCalledTimes(2);
  });

  it('drops every cached block when the sort changes', async () => {
    const source = stubDataSource(makePeople(100));
    const sortA: SortModelItem[] = [];
    const sortB: SortModelItem[] = [{ colId: 'name', sort: 'asc' }];

    const { result, rerender } = render({
      dataSource: source,
      page: 0,
      sortModel: sortA,
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(10));

    rerender({ dataSource: source, page: 0, sortModel: sortB });
    await waitFor(() => expect(source.getRows).toHaveBeenCalledTimes(2));

    // Back to the original sort: the block must be refetched, not resurrected.
    rerender({ dataSource: source, page: 0, sortModel: sortA });
    await waitFor(() => expect(source.getRows).toHaveBeenCalledTimes(3));
  });

  it('drops every cached block when the page size changes', async () => {
    const source = stubDataSource(makePeople(100));
    const { result, rerender } = render({ dataSource: source, page: 0, pageSize: 10 });
    await waitFor(() => expect(result.current.rows).toHaveLength(10));

    rerender({ dataSource: source, page: 0, pageSize: 20 });
    await waitFor(() => expect(result.current.rows).toHaveLength(20));

    rerender({ dataSource: source, page: 0, pageSize: 10 });
    await waitFor(() => expect(source.getRows).toHaveBeenCalledTimes(3));
  });

  it('evicts oldest-first once maxCachedBlocks is exceeded', async () => {
    const source = stubDataSource(makePeople(100));
    const props = { dataSource: source, pageSize: 10, maxCachedBlocks: 2 };
    const { result, rerender } = render({ ...props, page: 0 });

    await waitFor(() => expect(result.current.rows[0].id).toBe(1));
    rerender({ ...props, page: 1 });
    await waitFor(() => expect(result.current.rows[0].id).toBe(11));
    rerender({ ...props, page: 2 });
    await waitFor(() => expect(result.current.rows[0].id).toBe(21));

    expect(source.getRows).toHaveBeenCalledTimes(3);

    // Page 0 was the oldest block, so it has been evicted and refetches.
    rerender({ ...props, page: 0 });
    await waitFor(() => expect(source.getRows).toHaveBeenCalledTimes(4));

    // Page 2 is still cached.
    rerender({ ...props, page: 2 });
    await waitFor(() => expect(result.current.rows[0].id).toBe(21));
    expect(source.getRows).toHaveBeenCalledTimes(4);
  });

  it('does not refetch when the caller rebuilds an equal filter object', async () => {
    // The query key is the serialised model, so an unmemoised but equal object
    // re-runs the effect and hits the cache rather than the network.
    const source = stubDataSource(makePeople(100));
    const { result, rerender } = render({ dataSource: source, filterModel: {} });
    await waitFor(() => expect(result.current.rows).toHaveLength(10));

    rerender({ dataSource: source, filterModel: {} });
    rerender({ dataSource: source, filterModel: {} });

    expect(source.getRows).toHaveBeenCalledTimes(1);
  });
});

describe('refresh', () => {
  it('refetches the current page and purges the cache by default', async () => {
    const source = stubDataSource(makePeople(100));
    const { result } = render({ dataSource: source, page: 0 });
    await waitFor(() => expect(result.current.rows).toHaveLength(10));

    act(() => result.current.refresh());
    await waitFor(() => expect(source.getRows).toHaveBeenCalledTimes(2));
  });

  it('purges on refresh({ purge: true }) too', async () => {
    const source = stubDataSource(makePeople(100));
    const { result } = render({ dataSource: source });
    await waitFor(() => expect(result.current.rows).toHaveLength(10));

    act(() => result.current.refresh({ purge: true }));
    await waitFor(() => expect(source.getRows).toHaveBeenCalledTimes(2));
  });

  it('keeps neighbouring blocks on refresh({ purge: false })', async () => {
    const source = stubDataSource(makePeople(100));
    const props = { dataSource: source, pageSize: 10 };
    const { result, rerender } = render({ ...props, page: 0 });
    await waitFor(() => expect(result.current.rows[0].id).toBe(1));
    rerender({ ...props, page: 1 });
    await waitFor(() => expect(result.current.rows[0].id).toBe(11));

    act(() => result.current.refresh({ purge: false }));
    await waitFor(() => expect(source.getRows).toHaveBeenCalledTimes(2));

    // Page 0's block survived the non-purging refresh.
    rerender({ ...props, page: 0 });
    await waitFor(() => expect(result.current.rows[0].id).toBe(1));
    expect(source.getRows).toHaveBeenCalledTimes(2);
  });

  it('keeps a stable identity across renders', async () => {
    const source = stubDataSource(makePeople(10));
    const { result, rerender } = render({ dataSource: source });
    const first = result.current.refresh;
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({ dataSource: source });
    expect(result.current.refresh).toBe(first);
  });
});

describe('patchRows', () => {
  it('replaces loaded rows matched by id', async () => {
    const source = stubDataSource(makePeople(10));
    const { result } = render({ dataSource: source, pageSize: 10 });
    await waitFor(() => expect(result.current.rows).toHaveLength(10));

    act(() => {
      result.current.patchRows(
        [{ ...makePeople(1, 3)[0], name: 'PATCHED' }],
        (row) => row.id
      );
    });

    expect(result.current.rows[2].name).toBe('PATCHED');
    expect(result.current.rows[1].name).toBe('Person 2');
    expect(source.getRows).toHaveBeenCalledTimes(1);
  });

  it('ignores ids that are not on the loaded page', async () => {
    const source = stubDataSource(makePeople(10));
    const { result } = render({ dataSource: source });
    await waitFor(() => expect(result.current.rows).toHaveLength(10));
    const before = result.current.rows;

    act(() => {
      result.current.patchRows([{ ...makePeople(1, 999)[0] }], (row) => row.id);
    });

    // Nothing matched, so the array identity is preserved.
    expect(result.current.rows).toBe(before);
  });

  it('does nothing for an empty patch', async () => {
    const source = stubDataSource(makePeople(10));
    const { result } = render({ dataSource: source });
    await waitFor(() => expect(result.current.rows).toHaveLength(10));
    const before = result.current.rows;

    act(() => result.current.patchRows([], (row) => row.id));
    expect(result.current.rows).toBe(before);
  });

  it('patches the cache too, so paging away and back does not resurrect the old row', async () => {
    const source = stubDataSource(makePeople(100));
    const props = { dataSource: source, pageSize: 10 };
    const { result, rerender } = render({ ...props, page: 0 });
    await waitFor(() => expect(result.current.rows[0].id).toBe(1));

    act(() => {
      result.current.patchRows(
        [{ ...makePeople(1, 1)[0], name: 'PATCHED' }],
        (row) => row.id
      );
    });

    rerender({ ...props, page: 1 });
    await waitFor(() => expect(result.current.rows[0].id).toBe(11));
    rerender({ ...props, page: 0 });
    await waitFor(() => expect(result.current.rows[0].id).toBe(1));

    expect(result.current.rows[0].name).toBe('PATCHED');
  });
});

describe('error handling', () => {
  it('exposes the error, stops loading and calls onError', async () => {
    const onError = vi.fn();
    const failure = new Error('boom');
    const dataSource: HxDataSource<Person> = { getRows: () => Promise.reject(failure) };
    const { result } = render({ dataSource, onError });

    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.isLoading).toBe(false);
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('clears a previous error once a later request succeeds', async () => {
    const failure = new Error('boom');
    let shouldFail = true;
    const dataSource: HxDataSource<Person> = {
      getRows: async () => {
        if (shouldFail) throw failure;
        return { rows: makePeople(3), lastRow: 3 };
      },
    };
    const { result } = render({ dataSource });
    await waitFor(() => expect(result.current.error).toBe(failure));

    shouldFail = false;
    act(() => result.current.refresh());

    // The error is cleared when the request *starts*, so wait on the rows --
    // that is the only signal the retry actually landed.
    await waitFor(() => expect(result.current.rows).toHaveLength(3));
    expect(result.current.error).toBeNull();
  });

  it('uses the latest onError without resubscribing the effect', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const dataSource: HxDataSource<Person> = {
      getRows: () => Promise.reject(new Error('boom')),
    };
    const { rerender, result } = render({ dataSource, onError: first });
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));

    rerender({ dataSource, onError: second });
    act(() => result.current.refresh());

    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
    expect(first).toHaveBeenCalledTimes(1);
  });
});
