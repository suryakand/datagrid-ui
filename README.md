# @helix-x/datagrid-ui

A dependency-free React data grid: virtualized rows, server-side paging /
sorting / filtering, inline row editing, multi-select, CSV + clipboard export
and persisted column preferences.

Its only runtime requirement is React. Styling is plain Tailwind utility
classes, so there is no CSS file to import and no theme engine to configure.

## Example

A runnable Vite gallery with a mock stock-market API lives in
[`example/`](https://github.com/suryakand/datagrid-ui/tree/main/example):

```bash
cd example
npm install
npm run dev
```

Four examples, all against a real server-side backend:

| | |
| --- | --- |
| **Server-side market data** | 480 symbols; paging, sorting and all four filter kinds resolved on the server, plus inline editing with server-side validation |
| **Images in rows** | company logos and analyst avatars, lazy-loaded with reserved boxes and error fallbacks |
| **Live updates** | an SSE feed patched in with `api.updateRows()` — no refetch, no lost scroll position |
| **Theme customization** | accent, density and dark mode driven entirely by CSS custom properties |

Each example sits behind a **Preview / Code** toggle — the running grid, or its
real source — and is followed by a **How it works** section pairing the
explanation with the code that implements it, deep-linked to the exact lines on
GitHub. Every snippet is extracted from the source files at build time, so none
of it can drift.

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

On Tailwind v3, add the same path to `content` in `tailwind.config.js`, and
define the four colour variables below as well. Row backgrounds (stripe,
selection, editing, hover) are opaque colours mixed at runtime from
`var(--color-…)`, so the sticky checkbox column never shows the cells scrolling
underneath it. v4 emits those variables for you; v3 emits none, and without
them rows render with no background at all:

```css
/* Tailwind v3 only */
:root {
  --color-white: theme(colors.white);
  --color-gray-50: theme(colors.gray.50);
  --color-gray-900: theme(colors.gray.900);
  --color-brand-500: theme(colors.brand.500);
}
```

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

## API documentation

Full generated reference: **<https://suryakand.github.io/datagrid-ui/>**

Every exported symbol carries a doc comment — parameters, return values,
defaults, and runnable examples on the types you actually write
([`ColumnDef`][cd], [`DataGridProps`][dgp], [`HxDataSource`][ds],
[`GridApi`][api]). The comments ship inside `dist/index.d.ts` too, so they
appear on hover in any editor without visiting the site.

[cd]: https://suryakand.github.io/datagrid-ui/interfaces/ColumnDef.html
[dgp]: https://suryakand.github.io/datagrid-ui/interfaces/DataGridProps.html
[ds]: https://suryakand.github.io/datagrid-ui/interfaces/HxDataSource.html
[api]: https://suryakand.github.io/datagrid-ui/interfaces/GridApi.html

Build it locally:

```bash
npm run docs         # -> docs/
npm run docs:watch
```

The generator is [TypeDoc][td], not JSDoc. It reads the same `/** ... */`
comments but takes parameter and return types from TypeScript itself, so
signatures cannot drift from the code the way hand-written `@param {Type}`
annotations do.

[td]: https://typedoc.org

`typedoc.json` turns on link, export and coverage validation, and CI builds with
`--treatWarningsAsErrors`. A broken `{@link}`, a type referenced from the public
API but never exported, or a new export with no doc comment fails the docs build
rather than shipping a gap.

## Local development

```bash
npm install       # build toolchain only; React comes from the host app
npm run build     # dist/ — ESM, CJS and .d.ts
npm run dev       # rebuild on change
npm run typecheck
npm run docs      # docs/ — generated API reference
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

## Releasing

Two workflows, deliberately separate:

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `.github/workflows/publish.yml` | push to `main` | typecheck, build, publish to npm, tag `v<version>`, create the GitHub release, then commit the next version bump |
| `.github/workflows/docs.yml` | the publish workflow completing successfully | rebuild the API reference at the released commit and deploy it to GitHub Pages |

The docs workflow keys off `workflow_run` rather than `on: release`. The publish
job creates its release with the default `GITHUB_TOKEN`, and events raised by
that token deliberately do not trigger further workflows — an `on: release`
trigger would never fire. It also checks out the publish run's `head_sha`, so
the documentation describes the code that was actually released rather than the
version-bump commit pushed on top of it.

**Repository settings this needs:** Pages source set to **GitHub Actions**
(Settings → Pages), and an `NPM_TOKEN` secret for the publish workflow.

## Packaging

`npm pack` produces an installable tarball; `prepack` rebuilds `dist/` first,
so the published artifact is never stale.

## Not in this version

Row grouping, pivoting, tree data, master/detail, variable row heights, and
`.xlsx` output (CSV with a BOM opens natively in Excel).
