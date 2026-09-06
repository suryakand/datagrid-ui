import type { HxRowsRequest, HxRowsResponse } from '@helix-x/datagrid-ui';
import type { Stock } from './types';

/** Vite proxies /api to the mock market server on :5174. */
const BASE = '/api';

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly errors: Record<string, string>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * The grid hands us its request verbatim and expects `{ rows, lastRow }` back.
 * Passing the AbortSignal through is what lets the grid cancel a slow response
 * for a sort the user has already changed.
 */
export async function fetchStocks(
  request: HxRowsRequest,
  signal: AbortSignal
): Promise<HxRowsResponse<Stock>> {
  const response = await fetch(`${BASE}/stocks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Market API responded ${response.status}`);
  }
  return response.json();
}

/** Saves one inline edit. Field errors come back keyed by column. */
export async function saveStock(
  symbol: string,
  patch: Partial<Stock>
): Promise<Stock> {
  const response = await fetch(`${BASE}/stocks/${symbol}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });

  const body = await response.json();

  if (response.status === 422) {
    throw new ValidationError(body.message ?? 'Invalid', body.errors ?? {});
  }
  if (!response.ok) {
    throw new Error(body.message ?? `Save failed (${response.status})`);
  }
  return body.row;
}

export async function fetchSectors(): Promise<string[]> {
  const response = await fetch(`${BASE}/meta`);
  if (!response.ok) throw new Error('Could not load sectors');
  return (await response.json()).sectors;
}

export async function fetchExchanges(): Promise<string[]> {
  const response = await fetch(`${BASE}/meta`);
  if (!response.ok) throw new Error('Could not load exchanges');
  return (await response.json()).exchanges;
}
