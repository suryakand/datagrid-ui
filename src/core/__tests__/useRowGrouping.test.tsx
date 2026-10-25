import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRowGrouping, type GroupedDisplayRow } from '../useRowGrouping';
import type {
  ColumnDef,
  FilterModelMap,
  HxColumnVO,
  HxDataSource,
  SortModelItem,
} from '../../types';
import { controllableDataSource, makePeople, stubDataSource, type Person } from '../../test/helpers';

const NO_SORT: SortModelItem[] = [];
const NO_FILTER: FilterModelMap = {};
const activeColumn: ColumnDef<Person, never> = { field: 'active', header: 'Active' };
const GROUP_COLS: HxColumnVO[] = [{ id: 'active', displayName: 'Active', field: 'active' }];
const VALUE_COLS: HxColumnVO[] = [{ id: 'age', displayName: 'Age', field: 'age', aggFunc: 'sum' }];

const groupRows = [
  { active: true, childCount: 3 },
  { active: false, childCount: 2 },
] as unknown as Person[];

interface Props {
  dataSource: HxDataSource<Person>;
  rows?: Person[];
  grouped?: boolean;
  sortModel?: SortModelItem[];
  filterModel?: FilterModelMap;
  blockSize?: number;
  onError?: (error: unknown) => void;
}

function render(initial: Props) {
  return renderHook(
    (props: Props) =>
      useRowGrouping<Person>({
        dataSource: props.dataSource,
        rows: props.rows ?? groupRows,
        groupColumn: props.grouped === false ? null : activeColumn,
        rowGroupCols: props.grouped === false ? [] : GROUP_COLS,
        valueCols: props.grouped === false ? [] : VALUE_COLS,
        sortModel: props.sortModel ?? NO_SORT,
        filterModel: props.filterModel ?? NO_FILTER,
        blockSize: props.blockSize,
        onError: props.onError,
      }),
    { initialProps: initial }
  );
}

const kinds = (rows: GroupedDisplayRow<Person>[]) =>
  rows.map((row) => (row.kind === 'status' ? `status:${row.status}` : row.kind));

describe('not grouped', () => {
  it('passes the page through as leaf rows and fetches nothing', () => {
    const source = stubDataSource(makePeople(3));
    const people = makePeople(3);
    const { result } = render({ dataSource: source, rows: people, grouped: false });

    expect(kinds(result.current.displayRows)).toEqual(['leaf', 'leaf', 'leaf']);
    expect(result.current.leafRows).toBe(people);
    expect(source.getRows).not.toHaveBeenCalled();
  });
});

describe('group rows', () => {
  it('keys each group by its value as a string and reads childCount', () => {
    const { result } = render({ dataSource: stubDataSource<Person>([]) });

    expect(result.current.displayRows).toEqual([
      expect.objectContaining({ kind: 'group', groupKey: 'true', childCount: 3, expanded: false }),
      expect.objectContaining({ kind: 'group', groupKey: 'false', childCount: 2, expanded: false }),
    ]);
    expect(result.current.leafRows).toEqual([]);
  });
});

describe('expanding a group', () => {
  it('asks for that group with groupKeys, the query and the first block', async () => {
    const source = stubDataSource(makePeople(3));
    const sortModel: SortModelItem[] = [{ colId: 'age', sort: 'desc' }];
    const { result } = render({ dataSource: source, sortModel, blockSize: 50 });

    act(() => result.current.toggleGroup('true'));

    await waitFor(() => expect(source.getRows).toHaveBeenCalledTimes(1));
    expect(source.requests[0]).toMatchObject({
      startRow: 0,
      endRow: 50,
      sortModel,
      rowGroupCols: GROUP_COLS,
      valueCols: VALUE_COLS,
      groupKeys: ['true'],
    });
  });

  it('shows a loading line, then the rows under their group', async () => {
    const { dataSource, calls } = controllableDataSource<Person>();
    const { result } = render({ dataSource });

    act(() => result.current.toggleGroup('true'));
    expect(kinds(result.current.displayRows)).toEqual(['group', 'status:loading', 'group']);

    await act(async () => calls[0].deferred.resolve({ rows: makePeople(3), lastRow: 3 }));

    expect(kinds(result.current.displayRows)).toEqual(['group', 'leaf', 'leaf', 'leaf', 'group']);
    expect(result.current.leafRows.map((row) => row.id)).toEqual([1, 2, 3]);
    const leaf = result.current.displayRows[2];
    expect(leaf).toMatchObject({ kind: 'leaf', groupKey: 'true', leafIndex: 1 });
  });

  it('offers more while the group is not exhausted, and appends the next block', async () => {
    const source = stubDataSource(makePeople(5));
    const { result } = render({ dataSource: source, blockSize: 2 });

    act(() => result.current.toggleGroup('true'));
    await waitFor(() => expect(result.current.leafRows).toHaveLength(2));
    expect(result.current.displayRows[3]).toMatchObject({
      kind: 'status',
      status: 'more',
      loaded: 2,
      total: 5,
    });

    act(() => result.current.loadMore('true'));
    await waitFor(() => expect(result.current.leafRows).toHaveLength(4));
    expect(source.requests[1]).toMatchObject({ startRow: 2, endRow: 4, groupKeys: ['true'] });
  });

  it('stops offering more after a short block, whatever lastRow claimed', async () => {
    const { dataSource, calls } = controllableDataSource<Person>();
    const { result } = render({ dataSource, blockSize: 10 });

    act(() => result.current.toggleGroup('true'));
    await act(async () => calls[0].deferred.resolve({ rows: makePeople(3), lastRow: -1 }));

    expect(kinds(result.current.displayRows)).toEqual(['group', 'leaf', 'leaf', 'leaf', 'group']);
  });

  it('keeps loaded rows when collapsed, so reopening does not refetch', async () => {
    const source = stubDataSource(makePeople(3));
    const { result } = render({ dataSource: source });

    act(() => result.current.toggleGroup('true'));
    await waitFor(() => expect(result.current.leafRows).toHaveLength(3));

    act(() => result.current.toggleGroup('true'));
    expect(kinds(result.current.displayRows)).toEqual(['group', 'group']);
    expect(result.current.leafRows).toEqual([]);

    act(() => result.current.toggleGroup('true'));
    expect(result.current.leafRows).toHaveLength(3);
    expect(source.getRows).toHaveBeenCalledTimes(1);
  });
});

describe('errors', () => {
  it('shows an error line, reports it, and retries through loadMore', async () => {
    const { dataSource, calls } = controllableDataSource<Person>();
    const onError = vi.fn();
    const { result } = render({ dataSource, onError });

    act(() => result.current.toggleGroup('false'));
    const failure = new Error('boom');
    await act(async () => calls[0].deferred.reject(failure));

    expect(result.current.displayRows[2]).toMatchObject({ kind: 'status', status: 'error', error: failure });
    expect(onError).toHaveBeenCalledWith(failure);

    act(() => result.current.loadMore('false'));
    await act(async () => calls[1].deferred.resolve({ rows: makePeople(2), lastRow: 2 }));
    expect(result.current.leafRows).toHaveLength(2);
  });
});

describe('query changes', () => {
  it('collapse every group and discard a response for the old query', async () => {
    const { dataSource, calls } = controllableDataSource<Person>();
    const { result, rerender } = render({ dataSource });

    act(() => result.current.toggleGroup('true'));
    const filterModel: FilterModelMap = { name: { filterType: 'text', type: 'contains', filter: 'x' } };
    rerender({ dataSource, filterModel });
    await waitFor(() => expect(calls[0].signal.aborted).toBe(true));

    await act(async () => calls[0].deferred.resolve({ rows: makePeople(3), lastRow: 3 }));

    expect(kinds(result.current.displayRows)).toEqual(['group', 'group']);
    expect(result.current.leafRows).toEqual([]);
  });

  it('reset() closes groups and drops what was loaded', async () => {
    const source = stubDataSource(makePeople(3));
    const { result } = render({ dataSource: source });

    act(() => result.current.toggleGroup('true'));
    await waitFor(() => expect(result.current.leafRows).toHaveLength(3));

    act(() => result.current.reset());
    expect(kinds(result.current.displayRows)).toEqual(['group', 'group']);

    act(() => result.current.toggleGroup('true'));
    await waitFor(() => expect(source.getRows).toHaveBeenCalledTimes(2));
  });
});

describe('patchRows', () => {
  it('replaces loaded rows by id without a request', async () => {
    const source = stubDataSource(makePeople(3));
    const { result } = render({ dataSource: source });

    act(() => result.current.toggleGroup('true'));
    await waitFor(() => expect(result.current.leafRows).toHaveLength(3));

    const renamed = { ...makePeople(1, 2)[0], name: 'Renamed' };
    act(() => result.current.patchRows([renamed], (row) => row.id));

    expect(result.current.leafRows[1].name).toBe('Renamed');
    expect(source.getRows).toHaveBeenCalledTimes(1);
  });
});
