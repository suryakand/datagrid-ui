import { useCallback, useRef, useState } from 'react';
import {
  GRID_STATE_VERSION,
  type FilterModelMap,
  type PersistedGridState,
  type SortModelItem,
} from '../types';

const PREFIX = 'hxg:';

function read(storageKey: string): PersistedGridState | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(PREFIX + storageKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as PersistedGridState;
    // A shape from an older version is dropped rather than migrated: the state
    // is a convenience, and a bad restore is worse than starting from defaults.
    if (!parsed || parsed.v !== GRID_STATE_VERSION) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function write(storageKey: string, state: PersistedGridState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + storageKey, JSON.stringify(state));
  } catch {
    // Quota or a privacy mode: persistence is best-effort.
  }
}

export interface UseGridStateResult {
  /** Read once on mount; never re-read, so it is safe as an initial value. */
  initial: PersistedGridState | undefined;
  saveColumns: (columns: PersistedGridState['columns']) => void;
  saveSort: (sort: SortModelItem[]) => void;
  saveFilters: (filters: FilterModelMap) => void;
  savePageSize: (pageSize: number) => void;
  clear: () => void;
  hasSavedState: boolean;
}

/** Versioned, lean localStorage persistence for one grid. */
export function useGridState(storageKey: string | undefined): UseGridStateResult {
  const initialRef = useRef<PersistedGridState | undefined>(
    storageKey ? read(storageKey) : undefined
  );
  const [hasSavedState, setHasSavedState] = useState(() => initialRef.current != null);

  // The live copy the setters mutate; kept in a ref so saving never re-renders.
  const currentRef = useRef<PersistedGridState>(
    initialRef.current ?? {
      v: GRID_STATE_VERSION,
      columns: { order: [], hidden: [], widths: {}, pinned: {} },
      sort: [],
      filters: {},
      pagination: { pageSize: 20 },
    }
  );

  const persist = useCallback(
    (patch: Partial<PersistedGridState>) => {
      if (!storageKey) return;
      currentRef.current = { ...currentRef.current, ...patch, v: GRID_STATE_VERSION };
      write(storageKey, currentRef.current);
      setHasSavedState(true);
    },
    [storageKey]
  );

  const saveColumns = useCallback(
    (columns: PersistedGridState['columns']) => persist({ columns }),
    [persist]
  );
  const saveSort = useCallback((sort: SortModelItem[]) => persist({ sort }), [persist]);
  const saveFilters = useCallback(
    (filters: FilterModelMap) => persist({ filters }),
    [persist]
  );
  const savePageSize = useCallback(
    (pageSize: number) => persist({ pagination: { pageSize } }),
    [persist]
  );

  const clear = useCallback(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(PREFIX + storageKey);
    } catch {
      // ignore
    }
    setHasSavedState(false);
  }, [storageKey]);

  return {
    initial: initialRef.current,
    saveColumns,
    saveSort,
    saveFilters,
    savePageSize,
    clear,
    hasSavedState,
  };
}
