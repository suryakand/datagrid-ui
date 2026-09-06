# Stock Market — `@helix-x/datagrid-ui` example

A Vite + React app showing the grid against a realistic server-side backend:
480 stock symbols, paged, sorted and filtered **on the server**, with live
prices and inline editing.

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>. One command starts both processes:

| Process | Port | What it is |
| --- | --- | --- |
| `dev:web` | 5173 | Vite dev server for the React app |
| `dev:server` | 5174 | Mock market API (`node server/index.mjs`, zero deps) |

Vite proxies `/api` to 5174, so there is no CORS setup and no base URL to
configure.

## What it demonstrates

- **Server-side everything.** Paging, multi-column sorting and all four filter
  kinds are executed in `server/index.mjs`. The client never holds more than
  one page. Watch the terminal — every sort click is a round trip.
- **Filter kinds.** Text (Company), number (Last, Change %, Volume, P/E), date
  (Last trade) and set (Sector, Exchange, Rating). Sector and Exchange load
  their options from `/api/meta` the first time the popover opens, via a
  `filterParams.values` function.
- **Blank / not-blank.** ~8% of symbols have a null P/E, so the blank filters
  on that column match something real.
- **Inline editing with server validation.** Rating, Watch and Notes are
  editable. The server rejects notes over 120 characters or containing the word
  `TODO`; the error comes back keyed by field and is painted onto the cell,
  keeping the row in edit mode. **Try typing `TODO` into a note.**
- **Cell renderers.** Coloured change %, rating pills, and a 52-week range
  sparkline built from a `valueGetter` on a column with no `field` at all.
- **`context` instead of rebuilt columns.** The watchlist star needs live
  in-flight state. That lives in `context`, so `columns` is a module constant
  that never rebuilds — see the note in the root README about memoising columns.
- **Imperative API.** The toolbar buttons call `api.refresh({ purge: true })`
  and `api.setFilterModel(...)`. The watchlist star calls `api.updateRows()` to
  patch a row in place with no refetch and no scroll jump.
- **Persisted preferences.** Column order, widths, hidden columns, sort, filters
  and page size are saved under the `stock-market-grid` storage key. Rearrange
  the columns and reload.
- **Export.** The grid's built-in CSV button respects `exportValue`, so the
  rendered `▲ 1.24%` exports as `1.24`.

## Layout

```
example/
├── server/
│   ├── data.mjs      seeded 480-symbol universe + the live price tick
│   └── index.mjs     HTTP API: rows, edits, filter metadata
└── src/
    ├── api.ts        fetch wrappers; turns 422s into field errors
    ├── columns.tsx   every column definition — start here
    ├── types.ts      the Stock row shape
    └── App.tsx       wires the data source, context and commit handler
```

`columns.tsx` is the interesting file.

## Notes

Prices drift every 2 seconds whether or not anyone is looking, so **Refresh
prices** always shows movement. The API also sleeps 220ms per request so the
loading overlay is actually visible — set `LATENCY_MS=0` to turn that off.

All edits are in-memory: restart the server and it is a fresh universe.

The app consumes the grid through `"@helix-x/datagrid-ui": "file:.."`, so it
builds against the checkout it lives in rather than the published package. That
symlink is why `vite.config.ts` sets `resolve.dedupe` — without it Node can
resolve a second copy of React from inside the linked package and hooks break.
To test the published package instead, `npm install @helix-x/datagrid-ui`.

Tailwind needs to be pointed at the grid's shipped bundle explicitly
(`@source` in `src/index.css`) because it skips `node_modules` when detecting
content. Without that line the grid renders unstyled.
