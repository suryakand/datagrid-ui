/**
 * Mock stock-market API for the datagrid example.
 *
 * Zero dependencies — plain node:http. It implements the same wire contract
 * the grid speaks to a real backend, so the server-side paging, sorting and
 * filtering you see in the browser is genuinely happening here, not in the
 * client.
 */

import { createServer } from 'node:http';
import { buildUniverse, tick, SECTORS, EXCHANGES, RATINGS } from './data.mjs';

const PORT = Number(process.env.PORT ?? 5174);
/** Artificial latency, so the grid's loading overlay is actually visible. */
const LATENCY_MS = Number(process.env.LATENCY_MS ?? 220);

const rows = buildUniverse();
const bySymbol = new Map(rows.map((row) => [row.symbol, row]));

// Live market. Prices move whether or not anyone is looking.
setInterval(() => tick(rows), 2000).unref?.();

/* -------------------------------------------------------------------------- */
/* Filtering                                                                  */
/* -------------------------------------------------------------------------- */

const isBlank = (value) => value === null || value === undefined || value === '';

function matchesText(value, model) {
  const haystack = isBlank(value) ? '' : String(value).toLowerCase();
  const needle = String(model.filter ?? '').toLowerCase();

  switch (model.type) {
    case 'contains':    return haystack.includes(needle);
    case 'notContains': return !haystack.includes(needle);
    case 'equals':      return haystack === needle;
    case 'notEqual':    return haystack !== needle;
    case 'startsWith':  return haystack.startsWith(needle);
    case 'endsWith':    return haystack.endsWith(needle);
    case 'blank':       return isBlank(value);
    case 'notBlank':    return !isBlank(value);
    default:            return true;
  }
}

function matchesNumber(value, model) {
  if (model.type === 'blank') return isBlank(value);
  if (model.type === 'notBlank') return !isBlank(value);
  if (isBlank(value)) return false;

  const actual = Number(value);
  const a = Number(model.filter);
  const b = Number(model.filterTo);

  switch (model.type) {
    case 'equals':             return actual === a;
    case 'notEqual':           return actual !== a;
    case 'lessThan':           return actual < a;
    case 'lessThanOrEqual':    return actual <= a;
    case 'greaterThan':        return actual > a;
    case 'greaterThanOrEqual': return actual >= a;
    case 'inRange':            return actual >= a && actual <= b;
    default:                   return true;
  }
}

function matchesDate(value, model) {
  if (model.type === 'blank') return isBlank(value);
  if (model.type === 'notBlank') return !isBlank(value);
  if (isBlank(value)) return false;

  // The grid sends calendar days (YYYY-MM-DD); compare on the day, not the
  // instant, or a same-day trade at 14:05 never equals its own date.
  const day = String(value).slice(0, 10);
  const from = model.dateFrom ? String(model.dateFrom).slice(0, 10) : undefined;
  const to = model.dateTo ? String(model.dateTo).slice(0, 10) : undefined;

  switch (model.type) {
    case 'equals':   return day === from;
    case 'notEqual': return day !== from;
    case 'before':   return from !== undefined && day < from;
    case 'after':    return from !== undefined && day > from;
    case 'inRange':  return from !== undefined && to !== undefined && day >= from && day <= to;
    default:         return true;
  }
}

function matchesSet(value, model) {
  const values = model.values ?? [];
  // An empty set filter is "no constraint", which is how the grid clears it.
  if (values.length === 0) return true;
  return values.includes(String(value));
}

function matches(row, filterModel) {
  return Object.entries(filterModel ?? {}).every(([field, model]) => {
    const value = row[field];
    switch (model?.filterType) {
      case 'text':   return matchesText(value, model);
      case 'number': return matchesNumber(value, model);
      case 'date':   return matchesDate(value, model);
      case 'set':    return matchesSet(value, model);
      default:       return true;
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Sorting                                                                    */
/* -------------------------------------------------------------------------- */

function compare(a, b) {
  if (isBlank(a) && isBlank(b)) return 0;
  // Nulls sort last in both directions, which is what traders expect.
  if (isBlank(a)) return 1;
  if (isBlank(b)) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

function applySort(list, sortModel) {
  if (!sortModel?.length) return list;

  // Multi-column: the first entry in the model wins ties in the next.
  return [...list].sort((left, right) => {
    for (const { colId, sort } of sortModel) {
      const direction = sort === 'desc' ? -1 : 1;
      const result = compare(left[colId], right[colId]) * direction;
      if (result !== 0) return result;
    }
    return 0;
  });
}

/* -------------------------------------------------------------------------- */
/* HTTP                                                                       */
/* -------------------------------------------------------------------------- */

const json = (res, status, body) => {
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  });
  res.end(JSON.stringify(body));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      // Nothing here should ever be large; refuse instead of buffering.
      if (raw.length > 1e6) reject(new Error('payload too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') return json(res, 204, null);

  /* Set-filter options, loaded on demand by the grid's filter popover. */
  if (req.method === 'GET' && url.pathname === '/api/meta') {
    return json(res, 200, { sectors: SECTORS, exchanges: EXCHANGES, ratings: RATINGS });
  }

  /* The grid's row request. */
  if (req.method === 'POST' && url.pathname === '/api/stocks') {
    let request;
    try {
      request = await readBody(req);
    } catch (error) {
      return json(res, 400, { message: error.message });
    }

    const { startRow = 0, endRow = 20, sortModel = [], filterModel = {} } = request;

    const filtered = rows.filter((row) => matches(row, filterModel));
    const sorted = applySort(filtered, sortModel);
    const page = sorted.slice(startRow, endRow);

    if (LATENCY_MS > 0) await new Promise((r) => setTimeout(r, LATENCY_MS));

    // `lastRow` is the total across all pages — it is what drives the grid's
    // pager, not the length of this slice.
    return json(res, 200, { rows: page, lastRow: filtered.length });
  }

  /* Inline row edits. */
  const editMatch = url.pathname.match(/^\/api\/stocks\/([A-Z]+)$/);
  if (req.method === 'PATCH' && editMatch) {
    const row = bySymbol.get(editMatch[1]);
    if (!row) return json(res, 404, { message: 'Unknown symbol' });

    let patch;
    try {
      patch = await readBody(req);
    } catch (error) {
      return json(res, 400, { message: error.message });
    }

    // Field-level validation, returned in the shape the grid renders against
    // the offending cells.
    const errors = {};
    if (patch.rating !== undefined && !RATINGS.includes(patch.rating)) {
      errors.rating = `Must be one of ${RATINGS.join(', ')}`;
    }
    if (typeof patch.notes === 'string' && patch.notes.length > 120) {
      errors.notes = 'Keep notes under 120 characters';
    }
    if (typeof patch.notes === 'string' && /\bTODO\b/i.test(patch.notes)) {
      errors.notes = 'Placeholder text is not allowed on a published note';
    }
    if (Object.keys(errors).length > 0) {
      return json(res, 422, { errors, message: 'Fix the highlighted fields' });
    }

    if (patch.rating !== undefined) row.rating = patch.rating;
    if (patch.notes !== undefined) row.notes = String(patch.notes);
    if (patch.onWatchlist !== undefined) row.onWatchlist = Boolean(patch.onWatchlist);
    if (patch.analyst !== undefined) row.analyst = String(patch.analyst);

    return json(res, 200, { row });
  }

  json(res, 404, { message: `No route for ${req.method} ${url.pathname}` });
});

server.listen(PORT, () => {
  console.log(`Mock market API on http://localhost:${PORT} (${rows.length} symbols)`);
});
