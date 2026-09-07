import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEditModel } from '../useEditModel';
import type { RowCommitResult } from '../../types';
import { deferred } from '../../test/helpers';

interface Row {
  id: number;
  name: string;
  customer?: { businessName?: string; address?: { city?: string } };
}

const row: Row = { id: 1, name: 'Ada' };

function render(
  onCommit: (draft: Row, original: Row) => Promise<RowCommitResult> | RowCommitResult = () => ({
    ok: true,
  })
) {
  return renderHook(() => useEditModel<Row>(onCommit));
}

describe('opening and closing', () => {
  it('starts closed', () => {
    const { result } = render();
    expect(result.current.edit).toBeNull();
    expect(result.current.isEditing(1)).toBe(false);
  });

  it('opens a row with the draft and original both pointing at it', () => {
    const { result } = render();
    act(() => result.current.start(1, row));

    expect(result.current.edit).toMatchObject({
      rowId: 1,
      draft: row,
      original: row,
      errors: {},
      isSaving: false,
    });
    expect(result.current.isEditing(1)).toBe(true);
    expect(result.current.isEditing(2)).toBe(false);
  });

  it('replaces the open row when start is called again', () => {
    const { result } = render();
    act(() => result.current.start(1, row));
    act(() => result.current.setField('name', 'edited'));
    act(() => result.current.start(2, { id: 2, name: 'Bob' }));

    expect(result.current.edit?.rowId).toBe(2);
    expect(result.current.edit?.draft.name).toBe('Bob');
  });

  it('cancel discards the draft entirely', () => {
    const { result } = render();
    act(() => result.current.start(1, row));
    act(() => result.current.setField('name', 'edited'));
    act(() => result.current.cancel());

    expect(result.current.edit).toBeNull();
  });
});

describe('setField', () => {
  it('writes a flat field without mutating the original', () => {
    const { result } = render();
    act(() => result.current.start(1, row));
    act(() => result.current.setField('name', 'Grace'));

    expect(result.current.edit?.draft.name).toBe('Grace');
    expect(result.current.edit?.original.name).toBe('Ada');
    expect(row.name).toBe('Ada');
  });

  it('writes through a dotted path, preserving sibling keys', () => {
    const nested: Row = { id: 1, name: 'Ada', customer: { businessName: 'Acme' } };
    const { result } = render();
    act(() => result.current.start(1, nested));
    act(() => result.current.setField('customer.businessName', 'Globex'));

    expect(result.current.edit?.draft.customer?.businessName).toBe('Globex');
    expect(nested.customer?.businessName).toBe('Acme');
  });

  it('creates intermediate objects for a path that does not exist yet', () => {
    const { result } = render();
    act(() => result.current.start(1, row));
    act(() => result.current.setField('customer.address.city', 'Berlin'));

    expect(result.current.edit?.draft.customer?.address?.city).toBe('Berlin');
  });

  it('applies several writes in sequence', () => {
    const { result } = render();
    act(() => result.current.start(1, row));
    act(() => result.current.setField('name', 'A'));
    act(() => result.current.setField('name', 'AB'));

    expect(result.current.edit?.draft.name).toBe('AB');
  });

  it('is a no-op when no row is open', () => {
    const { result } = render();
    act(() => result.current.setField('name', 'x'));
    expect(result.current.edit).toBeNull();
  });
});

describe('commit', () => {
  it('closes the row on a successful commit', async () => {
    const onCommit = vi.fn().mockResolvedValue({ ok: true } as RowCommitResult);
    const { result } = render(onCommit);
    act(() => result.current.start(1, row));
    act(() => result.current.setField('name', 'Grace'));

    await act(async () => {
      await result.current.commit();
    });

    expect(onCommit).toHaveBeenCalledWith({ id: 1, name: 'Grace' }, row);
    expect(result.current.edit).toBeNull();
  });

  it('reads the draft synchronously, so a commit right after a keystroke sees it', async () => {
    // `setField` mirrors into a ref precisely so `commit` does not have to wait
    // for the state update to flush.
    const onCommit = vi.fn().mockResolvedValue({ ok: true } as RowCommitResult);
    const { result } = render(onCommit);
    act(() => result.current.start(1, row));

    await act(async () => {
      result.current.setField('name', 'typed-then-entered');
      await result.current.commit();
    });

    expect(onCommit.mock.calls[0][0]).toEqual({ id: 1, name: 'typed-then-entered' });
  });

  it('flags isSaving while the commit is in flight', async () => {
    const gate = deferred<RowCommitResult>();
    const { result } = render(() => gate.promise);
    act(() => result.current.start(1, row));

    act(() => {
      void result.current.commit();
    });
    expect(result.current.edit?.isSaving).toBe(true);

    await act(async () => {
      gate.resolve({ ok: true });
      await gate.promise;
    });
    await waitFor(() => expect(result.current.edit).toBeNull());
  });

  it('ignores a second commit while one is already in flight', async () => {
    const gate = deferred<RowCommitResult>();
    const onCommit = vi.fn(() => gate.promise);
    const { result } = render(onCommit);
    act(() => result.current.start(1, row));

    act(() => {
      void result.current.commit();
      void result.current.commit();
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    await act(async () => {
      gate.resolve({ ok: true });
      await gate.promise;
    });
  });

  it('is a no-op when no row is open', async () => {
    const onCommit = vi.fn().mockResolvedValue({ ok: true } as RowCommitResult);
    const { result } = render(onCommit);
    await act(async () => {
      await result.current.commit();
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('accepts a synchronous result as well as a promise', async () => {
    const { result } = render(() => ({ ok: true }) as RowCommitResult);
    act(() => result.current.start(1, row));
    await act(async () => {
      await result.current.commit();
    });
    expect(result.current.edit).toBeNull();
  });
});

describe('rejected commits', () => {
  it('keeps the row open and paints the per-field errors', async () => {
    const { result } = render(() => ({
      ok: false,
      errors: { name: 'Name is taken' },
    }));
    act(() => result.current.start(1, row));
    act(() => result.current.setField('name', 'Grace'));

    await act(async () => {
      await result.current.commit();
    });

    expect(result.current.edit).not.toBeNull();
    expect(result.current.edit?.errors).toEqual({ name: 'Name is taken' });
    expect(result.current.edit?.isSaving).toBe(false);
    // The draft survives, so the user does not retype.
    expect(result.current.edit?.draft.name).toBe('Grace');
  });

  it('clears a field error as soon as that field is touched again', async () => {
    const { result } = render(() => ({
      ok: false,
      errors: { name: 'Name is taken', id: 'Bad id' },
    }));
    act(() => result.current.start(1, row));
    await act(async () => {
      await result.current.commit();
    });

    act(() => result.current.setField('name', 'Grace'));

    expect(result.current.edit?.errors).toEqual({ id: 'Bad id' });
  });

  it('records a thrown error under __row__ and keeps the row open', async () => {
    const { result } = render(() => {
      throw new Error('Network unreachable');
    });
    act(() => result.current.start(1, row));

    await act(async () => {
      await result.current.commit();
    });

    expect(result.current.edit?.errors.__row__).toBe('Network unreachable');
    expect(result.current.edit?.isSaving).toBe(false);
  });

  it('uses a generic message when the thrown value is not an Error', async () => {
    const { result } = render(() => Promise.reject('nope'));
    act(() => result.current.start(1, row));

    await act(async () => {
      await result.current.commit();
    });

    expect(result.current.edit?.errors.__row__).toBe('Failed to save the row.');
  });

  it('allows a retry after a rejection', async () => {
    let attempt = 0;
    const { result } = render(() =>
      attempt++ === 0
        ? ({ ok: false, errors: { name: 'nope' } } as RowCommitResult)
        : ({ ok: true } as RowCommitResult)
    );
    act(() => result.current.start(1, row));

    await act(async () => {
      await result.current.commit();
    });
    expect(result.current.edit?.errors.name).toBe('nope');

    await act(async () => {
      await result.current.commit();
    });
    expect(result.current.edit).toBeNull();
  });
});
