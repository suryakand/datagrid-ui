import { useCallback, useRef, useState } from 'react';
import type { RowCommitResult } from '../types';
import type { RowId } from './useSelectionModel';

/**
 * The row currently being edited.
 *
 * @typeParam T - The row type.
 */
export interface EditState<T> {
  /** Which row is open. */
  rowId: RowId;
  /** The working copy, updated as the user types. */
  draft: T;
  /** The row as it was when editing started, for cancel and for the commit callback. */
  original: T;
  /** Server-supplied messages from the last rejected commit, keyed by column id. */
  errors: Record<string, string>;
  /** True while a commit is in flight. */
  isSaving: boolean;
}

/**
 * What {@link useEditModel} returns.
 *
 * @typeParam T - The row type.
 */
export interface UseEditModelResult<T> {
  /** The open row, or `null` when nothing is being edited. */
  edit: EditState<T> | null;
  /** Whether a given row is the one currently open. */
  isEditing: (rowId: RowId) => boolean;
  /** Open a row for editing, replacing any row already open. */
  start: (rowId: RowId, row: T) => void;
  /**
   * Write one field into the draft. Accepts a dotted path, creating
   * intermediate objects as needed.
   */
  setField: (field: string, value: unknown) => void;
  /** Close without saving, discarding the draft. */
  cancel: () => void;
  /** Run the commit callback. Keeps the row open if it returns `ok: false`. */
  commit: () => Promise<void>;
}

function setPath<T>(row: T, path: string, value: unknown): T {
  if (!path.includes('.')) {
    return { ...row, [path]: value };
  }
  const [head, ...rest] = path.split('.');
  const current = (row as Record<string, unknown>)[head];
  return {
    ...row,
    [head]: setPath(
      (current ?? {}) as Record<string, unknown>,
      rest.join('.'),
      value
    ),
  };
}

/**
 * Row-level editing against a draft copy.
 *
 * @typeParam T - The row type.
 * @param onCommit - Owns validation and persistence. Return
 * `{ ok: false, errors }` to keep the row open with per-field messages.
 * @returns The edit state and its mutators.
 *
 * @remarks
 * The draft never touches the data source, and editors never call an API — the
 * single commit callback owns both, so an app can plug in whatever schema
 * library it uses without the grid knowing about it.
 *
 * @see {@link RowCommitResult}
 */
export function useEditModel<T>(
  onCommit: (draft: T, original: T) => Promise<RowCommitResult> | RowCommitResult
): UseEditModelResult<T> {
  const [edit, setEdit] = useState<EditState<T> | null>(null);

  // A mirror of the state that is safe to read synchronously. `setState`
  // updaters are not guaranteed to run when they are dispatched (and may run
  // twice in StrictMode), so commit() reads the draft from here instead.
  const editRef = useRef<EditState<T> | null>(null);

  const apply = useCallback(
    (next: EditState<T> | null) => {
      editRef.current = next;
      setEdit(next);
    },
    []
  );

  const patch = useCallback((mutate: (current: EditState<T>) => EditState<T>) => {
    const current = editRef.current;
    if (!current) return;
    const next = mutate(current);
    editRef.current = next;
    setEdit(next);
  }, []);

  const isEditing = useCallback(
    (rowId: RowId) => edit?.rowId === rowId,
    [edit]
  );

  const start = useCallback(
    (rowId: RowId, row: T) => {
      apply({ rowId, draft: row, original: row, errors: {}, isSaving: false });
    },
    [apply]
  );

  const setField = useCallback(
    (field: string, value: unknown) => {
      patch((current) => {
        const errors = { ...current.errors };
        // Clear the error as soon as the field is touched; re-validation
        // happens on commit.
        delete errors[field];
        return { ...current, draft: setPath(current.draft, field, value), errors };
      });
    },
    [patch]
  );

  const cancel = useCallback(() => apply(null), [apply]);

  const commit = useCallback(async () => {
    const state = editRef.current;
    if (!state || state.isSaving) return;

    apply({ ...state, isSaving: true });

    try {
      const result = await onCommit(state.draft, state.original);
      if (result.ok) {
        apply(null);
        return;
      }
      patch((current) => ({ ...current, errors: result.errors, isSaving: false }));
    } catch (error) {
      patch((current) => ({
        ...current,
        isSaving: false,
        errors: {
          ...current.errors,
          __row__:
            error instanceof Error ? error.message : 'Failed to save the row.',
        },
      }));
    }
  }, [onCommit, apply, patch]);

  return { edit, isEditing, start, setField, cancel, commit };
}
