# `@helix-x/datagrid-ui` examples

A Vite + React gallery of four examples, each driven by a zero-dependency mock
stock-market API.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. One command starts both processes:

| Process | Port | What it is |
| --- | --- | --- |
| `dev:web` | 5173 | Vite dev server for the React app |
| `dev:server` | 5174 | Mock market API (`node server/`, no dependencies) |

Vite proxies `/api` to 5174, so there is no CORS setup and no base URL to
configure. Examples are hash-routed — `#/live` links straight to one.

## The examples

### 1. Server-side market data — `#/market`

480 symbols with every page, sort and filter resolved on the server.

- All four filter kinds: text (Company), number (Last, Volume, P/E), date (Last
  trade) and set (Sector, Exchange, Rating).
- Sector and Exchange load their options from `/api/meta` the first time the
  popover opens, via a `filterParams.values` function.
- ~8% of symbols have a null P/E, so the blank / not-blank filters match
  something real.
- Inline editing with **server-side** validation: the API rejects notes over 120
  characters or containing `TODO`, and the error is painted onto the cell with
  the row still open. **Try typing `TODO` into a note.**
- A 52-week range sparkline built with `valueGetter` on a column with no
  `field` at all.

### 2. Images in rows — `#/portfolio`

Company logos and analyst avatars, served as real SVGs over HTTP.

- Every `<img>` gets an explicit box, so rows never reflow as images arrive —
  which matters more than usual in a virtualized grid.
- `loading="lazy"` keeps scrolling from firing hundreds of requests at once.
- Each image falls back to initials on error. `/api/logo/ZZZZ.svg` 404s on
  purpose, so that path is reachable from the browser.
- The identity column packs a logo and two lines of text into one cell while
  still sorting and filtering server-side on `name`, and `exportValue` keeps the
  CSV clean.
- A row-height slider, because images are the usual reason to want taller rows.

### 3. Live updates — `#/live`

A server-sent event feed repricing symbols several times a second.

- Ticks arrive as whole rows and are patched in with `api.updateRows()` — no
  refetch. Scroll position, sort, filters and selection all survive.
- Symbols not on the current page are ignored, so the feed can be a firehose.
- Cells flash green or red on reprice. The flash map lives in `context`, so a
  tick repaints cells **without rebuilding a single column definition** — the
  pattern the root README recommends.
- Pause the feed, sort by Last, or open a filter and watch updates keep landing
  underneath.

### 4. Theme customization — `#/theming`

The grid ships no theme engine and takes no theme prop.

It renders Tailwind utilities, Tailwind v4 compiles those to
`var(--color-…)`, and the panel rewrites those custom properties on `<html>`.
That is the whole mechanism — six variables for the accent, plus Tailwind's own
`--radius-lg` / `--radius-md` for corners.

Switch the accent and the grid's selection highlight, pager, focus rings and
filter chrome all follow. Density maps to `rowHeight` / `headerHeight`; the
mode toggle flips the `dark` class the grid keys its dark styles off.

## Preview and code

Every example sits in a card with a **Preview / Code** toggle, alongside
*Copy* and *View on GitHub*. Preview holds the running grid; Code shows the
example's real source, with a file switcher when it spans more than one file.

The preview is hidden rather than unmounted when Code is showing, so switching
tabs does not refetch, drop the live stream, or throw away the visitor's sort
and scroll position — the grid re-measures itself on the way back because its
`ResizeObserver` fires when the box becomes visible again. Both panels share a
height so toggling never jumps the page.

Full files have their `#region` markers stripped, since those are scaffolding
for this site rather than part of how the grid works. That shifts the
numbering, so a full-file GitHub link deliberately carries no line range — only
the extracted snippets below deep-link to specific lines.

## Code samples

Under each demo is a **How it works** section: prose explaining the
customization, next to the code that implements it, with a *View on GitHub*
link that deep-links to the exact lines.

Those snippets are never hand-copied. Each is delimited in its real source file
by a pair of markers:

```tsx
// #region flash-cell
field: 'price',
header: 'Last',
cellRenderer: ({ row, context }) => {
  ...
},
// #endregion
```

`src/docs/source.ts` reads the files through `import.meta.glob(..., '?raw')`,
slices out the region and records its line numbers — so a snippet on the page
cannot drift from the code that runs, and the GitHub link always points at the
right lines. CSS files use the block-comment form of the same markers.

To add one: wrap a region in the source, then reference it from
`src/examples/docs.tsx` as `{ file, region }`. A missing or unterminated region
renders as a visible error in place of the snippet rather than failing silently.

Highlighting is a ~50 line tokenizer in `src/docs/highlight.ts` rather than a
dependency. It is a single ordered pass, so unlike a chain of `String.replace`
calls it cannot highlight inside a string or a comment.

## Layout

```
example/
├── server/
│   ├── data.mjs      seeded 480-symbol universe + the live price tick
│   ├── logo.mjs      deterministic SVG logos and avatars
│   └── index.mjs     rows, edits, images, SSE stream, filter metadata
└── src/
    ├── api.ts        fetch wrappers; turns 422s into field errors
    ├── theme.tsx     accent / density / mode, applied as CSS variables
    ├── router.ts     six lines of hash routing, so there is no router dep
    ├── layout/       header, sidebar, icons
    ├── docs/
    │   ├── source.ts        extracts snippets and whole files from source
    │   ├── highlight.ts     dependency-free tokenizer
    │   ├── CodeBlock.tsx    the highlighted <pre>, copy + GitHub actions
    │   ├── Showcase.tsx     the Preview / Code card holding each demo
    │   ├── CodeSnippet.tsx  one snippet card + its GitHub deep link
    │   └── DocSections.tsx  the "How it works" section
    └── examples/
        ├── registry.tsx      the sidebar's source of truth
        ├── docs.tsx          the written explanation for each example
        ├── market/           server-side everything
        ├── portfolio/        images in rows
        ├── live/             SSE + updateRows
        └── theming/          CSS-variable theming
```

`examples/*/columns.tsx` is where the interesting per-example code lives.

## Mock API

| Route | Purpose |
| --- | --- |
| `POST /api/stocks` | The grid's row request → `{ rows, lastRow }` |
| `PATCH /api/stocks/:symbol` | Inline edits; 422 with per-field errors |
| `GET /api/meta` | Set-filter options |
| `GET /api/logo/:symbol.svg` | Company logo |
| `GET /api/avatar.svg?name=` | Analyst avatar |
| `GET /api/stream` | SSE price ticks |

Prices drift every 2 seconds whether or not anyone is looking, and the stream
reprices a handful of symbols every 700ms. Row requests sleep 220ms so the
loading overlay is visible — set `LATENCY_MS=0` to turn that off.

All edits are in memory: restart the server and it is a fresh universe.

## Notes

The app consumes the grid through `"@helix-x/datagrid-ui": "file:.."`, so it
builds against the checkout it lives in rather than the published package. That
symlink is why `vite.config.ts` sets `resolve.dedupe` — without it Node can
resolve a second copy of React from inside the linked package and hooks break.
To test the published package instead, `npm install @helix-x/datagrid-ui`.

Tailwind must be pointed at the grid's shipped bundle explicitly (`@source` in
`src/index.css`) because it skips `node_modules` when detecting content.
Without that line the grid renders unstyled.

Shipping the app's own source for the code samples costs roughly 38 KB gzipped.
That is a deliberate trade for a docs site — the snippets render instantly with
no loading state and cannot go stale — but it is why this bundle is larger than
the grid it demonstrates.
