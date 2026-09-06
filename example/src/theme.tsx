import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/*
 * Tailwind v4 compiles every colour utility down to `var(--color-…)`, so the
 * grid can be re-themed at runtime by writing those custom properties onto
 * <html>. No rebuild, no CSS-in-JS, and the grid itself needs no theme prop —
 * it just uses `bg-brand-500` and inherits whatever the variable says.
 */

export type ThemeMode = 'light' | 'dark';
export type Density = 'compact' | 'cozy' | 'comfortable';

/** The six brand steps the grid actually references. */
export interface AccentRamp {
  25: string;
  50: string;
  200: string;
  400: string;
  500: string;
  600: string;
}

export interface AccentPreset {
  id: string;
  label: string;
  ramp: AccentRamp;
}

export const ACCENTS: AccentPreset[] = [
  {
    id: 'indigo',
    label: 'Indigo',
    ramp: { 25: '#f2f7ff', 50: '#ecf3ff', 200: '#c2d6ff', 400: '#7592ff', 500: '#465fff', 600: '#3641f5' },
  },
  {
    id: 'emerald',
    label: 'Emerald',
    ramp: { 25: '#f0fdf6', 50: '#dcfce9', 200: '#a7f3cd', 400: '#34d399', 500: '#10b981', 600: '#059669' },
  },
  {
    id: 'amber',
    label: 'Amber',
    ramp: { 25: '#fffbeb', 50: '#fef3c7', 200: '#fde68a', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
  },
  {
    id: 'rose',
    label: 'Rose',
    ramp: { 25: '#fff1f2', 50: '#ffe4e6', 200: '#fecdd3', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48' },
  },
  {
    id: 'violet',
    label: 'Violet',
    ramp: { 25: '#f5f3ff', 50: '#ede9fe', 200: '#ddd6fe', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed' },
  },
  {
    id: 'teal',
    label: 'Teal',
    ramp: { 25: '#f0fdfa', 50: '#ccfbf1', 200: '#99f6e4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488' },
  },
];

/** Row and header heights per density step. */
export const DENSITY: Record<Density, { rowHeight: number; headerHeight: number; label: string }> = {
  compact: { rowHeight: 28, headerHeight: 30, label: 'Compact' },
  cozy: { rowHeight: 36, headerHeight: 36, label: 'Cozy' },
  comfortable: { rowHeight: 48, headerHeight: 42, label: 'Comfortable' },
};

interface ThemeValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  accent: AccentPreset;
  setAccentId: (id: string) => void;
  density: Density;
  setDensity: (density: Density) => void;
  radius: number;
  setRadius: (radius: number) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const STORAGE_KEY = 'datagrid-example-theme';

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(readStored, []);

  const [mode, setMode] = useState<ThemeMode>(stored.mode === 'light' ? 'light' : 'dark');
  const [accentId, setAccentId] = useState<string>(stored.accentId ?? 'indigo');
  const [density, setDensity] = useState<Density>(stored.density ?? 'cozy');
  const [radius, setRadius] = useState<number>(
    typeof stored.radius === 'number' ? stored.radius : 8
  );

  const accent = useMemo(
    () => ACCENTS.find((preset) => preset.id === accentId) ?? ACCENTS[0],
    [accentId]
  );

  /* The grid keys its dark styles off `.dark` on an ancestor. */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  /* This is the whole theming mechanism: six custom properties. */
  // #region apply-accent
  useEffect(() => {
    const root = document.documentElement;
    for (const [step, value] of Object.entries(accent.ramp)) {
      root.style.setProperty(`--color-brand-${step}`, value);
    }
  }, [accent]);
  // #endregion

  /*
   * Tailwind's own radius scale is variable-driven too, so the same trick
   * reshapes every `rounded-lg` / `rounded-md` in the grid: its outer frame,
   * the filter popovers, the columns panel and the toolbar buttons. (Bare
   * `rounded` and `rounded-full` compile to literals and do not follow.)
   */
  // #region apply-radius
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--radius-lg', `${radius}px`);
    root.style.setProperty('--radius-md', `${Math.round(radius * 0.75)}px`);
  }, [radius]);
  // #endregion

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode, accentId, density, radius })
      );
    } catch {
      // Private browsing. Preferences just do not persist.
    }
  }, [mode, accentId, density, radius]);

  const toggleMode = useCallback(
    () => setMode((current) => (current === 'dark' ? 'light' : 'dark')),
    []
  );

  const value = useMemo(
    () => ({
      mode, setMode, toggleMode,
      accent, setAccentId,
      density, setDensity,
      radius, setRadius,
    }),
    [mode, toggleMode, accent, density, radius]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
