# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two separate npm projects:

- **root** — the `@helix-x/datagrid-ui` library (published to npm)
- **`example/`** — a Vite gallery app that consumes the library via `"@helix-x/datagrid-ui": "file:.."`, plus a zero-dependency mock API in `example/server/`

## Commands

```bash
# library (root)
npm run build          # tsup -> dist/ (ESM, CJS, .d.ts)
npm run dev            # tsup --watch
npm run typecheck      # tsc --noEmit
npm test               # vitest run
npm run test:watch     # vitest
npm run test:coverage  # vitest run --coverage
npm run docs           # typedoc -> docs/
npm run clean          # rm -rf dist docs

# example
cd example
npm run dev            # concurrently: Vite on :5173 + mock API on :5174
npm run build          # tsc -b && vite build
```

**There is no linter in either project**, and the example has no tests. The
library's checks are `npm test`, `npm run typecheck` (root) and `tsc -b`
(example).

### Tests

Vitest + Testing Library, jsdom environment, specs in `src/**/__tests__/`.
Shared fixtures and the jsdom gap-fillers live in `src/test/`:

- `setup.ts` supplies what jsdom lacks and the grid needs — `ResizeObserver`,
  `PointerEvent`, pointer capture, object URLs.
- `helpers.tsx` has the row fixtures, three data-source stubs
  (`stubDataSource`, `controllableDataSource` for driving races by hand,
  `deferred`), and the jsdom drivers. jsdom computes no layout, so anything
  that measures elements (the header popups' `useKeepInView`) is tested with
  `fakeHorizontalLayout`. Tailwind classes carry no CSS in jsdom either: give
  a clipping container an inline `overflowX` if the code under test must see it.

Two things to know before writing a grid test:

1. **The grid renders no rows until it has been measured.** `viewportHeight`
   starts at 0, so the virtual window is empty. Call `resizeViewport()` after
   rendering.
2. **`aria-busy` going false is not "settled".** The row window is applied by an
   effect that runs *after* the render which cleared the flag, so the grid has
   its rows but has not painted them. Follow the `waitFor` with
   `flushEffects()`.

A handful of specs are `it.fails(...)`: they assert the *intended* behaviour of
a known defect, and each is paired with a plain test pinning what the code does
today. The comment above each one names the fix. When you fix one, delete the
`.fails` and the pinning test together.

### Working on library code

The example resolves the library to **`dist/`**, not `src/` — Vite serves `/@fs/<repo>/dist/index.js`. Editing `src/` alone will not change what the example renders. Run `npm run dev` (tsup watch) at the root alongside `example`'s dev server.

After changing `src/`, verify with all four: root `npm test`, root `npm run typecheck`, root `npm run build`, and `cd example && npx tsc -b`.

## Architecture

### The server owns the data

The grid holds one page at a time and never sorts or filters locally. `DataGrid` composes hooks from `src/core/`, each owning one concern: `useServerDataSource` (paging + block cache), `useColumnState` (order/width/visibility/pinning), `useSelectionModel`, `useEditModel`, `useVirtualRows`, `useGridState` (localStorage).

`HxRowsRequest` / `HxFilterModel` in `src/types.ts` are **deliberately wire-compatible with ag-grid's server-side row model** — the empty `rowGroupCols`/`valueCols`/`pivotCols`/`groupKeys` fields exist only so backends written for that model do not fall over. Do not "clean them up".

`lastRow` in the response is the total across all pages, not `rows.length`; it drives the pager.

Every request carries an `AbortController` and a sequence number so a slow response for a superseded sort can never overwrite a newer one. The block cache is dropped wholesale when the query changes.

### Two invariants that are easy to break

1. **Column definitions must be static.** Anything volatile — in-flight ids, handlers, per-tick state — goes in the `context` prop, which reaches every `cellRenderer` without rebuilding a single definition. Putting volatile data in a column rebuilds all of them on every change.

2. **Fixed row heights only.** This is what makes the visible range O(1) and removes the measure-then-reflow pass. Variable heights are out of scope, along with grouping, pivoting, tree data and master/detail.

### Styling

No stylesheet ships. The grid renders Tailwind utility classes directly, against the `brand`, `gray` and `error` colour families and the class-based `dark` variant. Consumers must add `@source "../node_modules/@helix-x/datagrid-ui/dist/index.js"` because Tailwind skips `node_modules` — omitting it is the single most common setup failure, and the grid renders completely unstyled.

Because Tailwind v4 compiles utilities to `var(--color-…)`, theming is done by overriding those custom properties at runtime. There is no theme prop and no theme engine — see `example/src/theme.tsx`.

The README still promises Tailwind v3, so classes must compile on both. Tailwind IntelliSense's "can be written as" suggestions are v4-only and must not be applied blindly: `z-[3]` → `z-3` and `!hidden` → `hidden!` both break v3. Sticky and pinned cells therefore set their z-index inline (`style={{ zIndex }}`). The full order: pinned body cells 2, checkbox column and pinned header/filter cells 3, overlay 5, floating filter row 9, header 10, popups 30. Row backgrounds must stay opaque (the sticky checkbox column copies them via `bg-inherit`), so they are `color-mix` values over `var(--color-…)`, and v3 consumers have to define those variables themselves; the README says which.

### React must not be duplicated

`react`, `react-dom` and `react/jsx-runtime` are tsup externals, and `.npmrc` sets `legacy-peer-deps` so the peer range is never auto-installed. When an app consumes the library through a symlink (`file:..` or `npm link`), Node resolves peer deps from the *real* path and can load a second copy of React, which breaks hooks. `example/vite.config.ts` sets `resolve.dedupe` for exactly this reason. Bare Node/SSR consumers hit the same trap and need their own dedupe.

## Adding a public export

The docs build is strict (`typedoc.json` enables `notExported`, `invalidLink`, `notDocumented`; CI runs `--treatWarningsAsErrors`). A new export needs **both**:

1. a re-export from `src/index.ts` — including the `Props`/`Options`/`Result` types it references, or TypeDoc fails with "referenced but not included"
2. a doc comment on it and on each of its members

Otherwise the docs workflow fails after a release. Verify locally with `npx typedoc --treatWarningsAsErrors`.

## Every library change ships with docs and an example

Documentation and example coverage are part of the change, not follow-up work. A `src/` change is not done until both are in the same commit.

**1. API documentation.** Every public API you add or change — components, hooks, types, interfaces, props and their individual members — carries a TSDoc comment saying what it does, not what it is named. Use `@param`, `@returns`, `@defaultValue`, `@example` and `@deprecated` where they apply, and describe units, invariants and what "server-owned" means for the value. When you change behaviour, update the existing comment in the same edit; a stale doc comment is worse than none because the published docs site is generated from it. TypeDoc's `notDocumented` check only sees exported symbols, so an undocumented internal that later becomes public will fail CI at release time, not at edit time.

**2. An example.** Every new capability must be demonstrated in `example/`, and every changed capability must have its demonstration updated:

- extend an existing page under `example/src/examples/<name>/` when the feature belongs to that story, or add a new directory when it does not
- a new page is registered in `example/src/examples/registry.tsx` (`source`, `sourceDir`, `docs`, `Component`) and its prose lives in `example/src/examples/docs.tsx`
- wrap the code the docs point at in `// #region` markers as described below — snippets are extracted from the real source, so the example must actually run the code being documented
- if a change makes an existing example's pattern obsolete, fix the example rather than leaving the gallery showing an API the library no longer supports

Verify the whole set before calling it done: root `npm test`, root `npm run typecheck`, root `npm run build`, `npx typedoc --treatWarningsAsErrors`, and `cd example && npx tsc -b`.

## The example's docs system

Each example page pairs a live demo with prose and code. Snippets are **extracted from the real source at build time**, never hand-copied: `example/src/docs/source.ts` reads files via `import.meta.glob(..., '?raw')` and slices out regions delimited by

```ts
// #region name
...
// #endregion
```

(CSS files use the block-comment form.) The markers also yield real line numbers, which become the deep "View on GitHub" links.

When editing example source, keep regions wrapping **syntactically complete** code — a region that ends mid-block produces a malformed snippet on the page. A missing or unterminated region renders a visible error card rather than failing the build. Region names are referenced from `example/src/examples/docs.tsx`.

## Release

Two workflows, deliberately separate:

- `.github/workflows/publish.yml` — on push to `main`: typecheck, build, publish, tag `v<version>`, create the release, then commit the **next** version bump with `[skip ci]`. So `main` always carries the next unpublished version; a normal push publishes whatever is currently in `package.json`. Release notes come from `.github/scripts/release-notes.mjs` (commits since the previous `v*` tag, Conventional Commit prefixes grouped, `[skip ci]` bumps dropped) and are written **before** `npm publish`: once a version is on npm every later step is skipped on re-run, so anything that can fail belongs ahead of the publish where possible. Commit subjects become the published notes — write them for users.
- `.github/workflows/docs.yml` — triggered by the publish workflow completing, via `workflow_run`. **Not `on: release`**: the publish job creates its release with the default `GITHUB_TOKEN`, and events raised by that token do not trigger further workflows, so an `on: release` trigger would never fire. It checks out the publish run's `head_sha` so docs describe the released code, not the bump commit.

Requires an `NPM_TOKEN` secret, Actions write permission, and Pages source set to "GitHub Actions".
