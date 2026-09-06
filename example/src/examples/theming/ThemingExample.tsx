import { useMemo, useState, type ReactNode } from 'react';
import { DataGrid, type HxRowsRequest } from '@helix-x/datagrid-ui';
import { fetchStocks } from '../../api';
import { ACCENTS, DENSITY, useTheme, type Density } from '../../theme';
import type { Stock } from '../../types';
import { themingColumns } from './columns';

/**
 * The grid ships no theme engine and takes no theme prop. It renders Tailwind
 * utilities, Tailwind v4 compiles those to `var(--color-…)`, and this panel
 * writes those variables onto <html>. That is the entire mechanism.
 */
export function ThemingExample() {
  const { mode, setMode, accent, setAccentId, density, setDensity, radius, setRadius } =
    useTheme();

  const [floatingFilter, setFloatingFilter] = useState(true);
  const [selectable, setSelectable] = useState(true);

  const dataSource = useMemo(
    () => ({
      getRows: (request: HxRowsRequest, signal: AbortSignal) =>
        fetchStocks(request, signal),
    }),
    []
  );

  const cssPreview = useMemo(
    () =>
      [
        ...Object.entries(accent.ramp).map(
          ([step, value]) => `  --color-brand-${step}: ${value};`
        ),
        `  --radius-lg: ${radius}px;`,
        `  --radius-md: ${Math.round(radius * 0.75)}px;`,
      ].join('\n'),
    [accent, radius]
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto lg:flex-row lg:overflow-hidden">
      {/* Controls */}
      <aside className="flex shrink-0 flex-col gap-5 lg:w-64 lg:overflow-y-auto lg:pr-1">
        <Field label="Accent">
          <div className="grid grid-cols-6 gap-1.5">
            {ACCENTS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                aria-pressed={preset.id === accent.id}
                onClick={() => setAccentId(preset.id)}
                style={{ background: preset.ramp[500] }}
                className={`h-7 rounded-md ring-offset-2 transition dark:ring-offset-gray-950 ${
                  preset.id === accent.id
                    ? 'ring-2 ring-gray-900 dark:ring-white'
                    : 'hover:scale-105'
                }`}
              />
            ))}
          </div>
        </Field>

        <Field label="Mode">
          <Segmented
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={mode}
            onChange={(value) => setMode(value as 'light' | 'dark')}
          />
        </Field>

        <Field label="Density">
          <Segmented
            options={(Object.keys(DENSITY) as Density[]).map((key) => ({
              value: key,
              label: DENSITY[key].label,
            }))}
            value={density}
            onChange={(value) => setDensity(value as Density)}
          />
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            Row {DENSITY[density].rowHeight}px · header {DENSITY[density].headerHeight}px
          </p>
        </Field>

        <Field label={`Corner radius — ${radius}px`}>
          <input
            type="range"
            min={0}
            max={16}
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
            className="w-full accent-brand-500"
            aria-label="Corner radius"
          />
          <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            Drives Tailwind's own <code className="font-mono">--radius-lg</code> /{' '}
            <code className="font-mono">--radius-md</code>, so the grid frame,
            popovers and panels all follow.
          </p>
        </Field>

        <Field label="Grid options">
          <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={floatingFilter}
              onChange={(event) => setFloatingFilter(event.target.checked)}
              className="accent-brand-500"
            />
            Floating filter row
          </label>
          <label className="mt-1.5 flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={selectable}
              onChange={(event) => setSelectable(event.target.checked)}
              className="accent-brand-500"
            />
            Selection column
          </label>
        </Field>

        <Field label="What that writes">
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-2.5 text-[10.5px] leading-relaxed text-gray-300 dark:bg-black/40">
            <code>{`:root {\n${cssPreview}\n}`}</code>
          </pre>
        </Field>
      </aside>

      {/* Live preview */}
      <div className="min-h-[380px] min-w-0 flex-1">
        <DataGrid<Stock>
          columns={themingColumns}
          dataSource={dataSource}
          getRowId={(row) => row.symbol}
          // No storageKey: this grid should always reflect the panel, not a
          // layout the visitor saved on a previous visit.
          height="100%"
          rowHeight={DENSITY[density].rowHeight}
          headerHeight={DENSITY[density].headerHeight}
          defaultPageSize={25}
          pageSizeOptions={[10, 25, 50]}
          selectable={selectable}
          floatingFilter={floatingFilter}
          exportFileName="themed"
          emptyMessage="Nothing to show."
          className="h-full shadow-sm"
          toolbar={() => (
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {accent.label} · {DENSITY[density].label} · {mode}
            </span>
          )}
        />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </h3>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-700">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-md px-2 py-1 text-xs transition-colors ${
            option.value === value
              ? 'bg-brand-500 font-medium text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
