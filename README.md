# @helix-x/datagrid-ui

A dependency-free React data grid: virtualized rows, server-side paging /
sorting / filtering, inline row editing, multi-select, CSV + clipboard export
and persisted column preferences.

Its only runtime requirement is React. Styling is plain Tailwind utility
classes, so there is no CSS file to import and no theme engine to configure.

## Install

The package is a standalone module — it can be installed from a registry, a
tarball, a git URL, or a relative path:

```bash
npm install @helix-x/datagrid-ui
# or, consuming it from a checkout next to your app:
npm install file:../helix-x-datagrid
```

React 18 or 19 must already be present; it is a peer dependency and is never
bundled into the output.

### Tailwind

The grid renders Tailwind utility classes. Tailwind only generates classes it
can see, and it skips `node_modules` during automatic content detection, so
point it at the shipped bundle explicitly:

```css
/* your Tailwind v4 entry point */
@import "tailwindcss";
@source "../node_modules/@helix-x/datagrid-ui/dist/index.js";
```

On Tailwind v3, add the same path to `content` in `tailwind.config.js`.

### Theme requirements

The grid uses the `brand`, `gray` and `error` colour families and the
class-based `dark` variant. If your project does not already define them:

```css
@custom-variant dark (&:is(.dark *));

@theme {
  --color-brand-25:  #f2f7ff;
  --color-brand-50:  #ecf3ff;
  --color-brand-200: #c2d6ff;
  --color-brand-400: #7592ff;
  --color-brand-500: #465fff;
  --color-brand-600: #3641f5;

  --color-error-50:  #fef3f2;
  --color-error-300: #fda29b;
  --color-error-500: #f04438;
  --color-error-600: #d92d20;
  --color-error-700: #b42318;
}
```

## Usage

```tsx
import { DataGrid, type ColumnDef, type GridApi } from '@helix-x/datagrid-ui';

const columns: ColumnDef<Person, Ctx>[] = [
  { field: 'id', header: 'ID', width: 90, filter: 'number' },
  { field: 'name', header: 'Name', flex: 1, filter: 'text', editable: true },
  { field: 'status', header: 'Status', filter: 'set',
    filterParams: { values: ['ACTIVE', 'CLOSED'] },
    editable: true, editor: 'select',
    editorParams: { options: [{ label: 'Active', value: 'ACTIVE' }] } },
];

<DataGrid
  columns={columns}
  getRowId={(row) => row.id}
  dataSource={{ getRows: (request, signal) => api.list(request, signal) }}
  storageKey="people"
  context={{ onEdit }}
  onRowCommit={async (draft) => {
    const parsed = schema.safeParse(draft);
    if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error) };
    await api.save(draft);
    return { ok: true };
  }}
  apiRef={apiRef}
/>
```

### Server contract

`getRows` receives a request that is structurally identical to ag-grid's
server-side row model request, so an endpoint written for that model works
unchanged:

```ts
{ startRow, endRow, sortModel: [{ colId, sort }], filterModel,
  rowGroupCols: [], valueCols: [], pivotCols: [], pivotMode: false, groupKeys: [] }
```

and returns `{ rows, lastRow }`. Filter models use the same four shapes
(`text`, `number`, `date`, `set`) that ag-grid emits.

### Performance note

Column definitions should be memoised on `[]`. Anything volatile — in-flight
ids, permission checks, event handlers — belongs in `context`, which is passed
to every `cellRenderer`. Changing `context` re-renders cells without rebuilding
a single column definition.

## Local development

```bash
npm install       # build toolchain only; React comes from the host app
npm run build     # dist/ — ESM, CJS and .d.ts
npm run dev       # rebuild on change
npm run typecheck
```

When an app consumes this package through a relative path or `npm link`, npm
creates a symlink and Node can resolve a *second* copy of React from the
package's own tree. Nothing here installs React (`.npmrc` sets
`legacy-peer-deps` so the peer range is not auto-installed), but bundlers
should still be told to dedupe:

```ts
// vite.config.ts
resolve: { dedupe: ['react', 'react-dom'] }
```

## Packaging

`npm pack` produces an installable tarball; `prepack` rebuilds `dist/` first,
so the published artifact is never stale.

## Not in this version

Row grouping, pivoting, tree data, master/detail, variable row heights, and
`.xlsx` output (CSV with a BOM opens natively in Excel).
