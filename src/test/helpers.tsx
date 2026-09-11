import { act } from '@testing-library/react';
import { vi } from 'vitest';
import type {
  ColumnDef,
  HxDataSource,
  HxRowsRequest,
  HxRowsResponse,
} from '../types';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/** The row shape every test in this suite uses. */
export interface Person {
  id: number;
  name: string;
  email: string;
  age: number;
  active: boolean;
  joined: string;
  customer: { businessName: string };
}

/**
 * Builds `count` deterministic people, ids starting at `startId`.
 *
 * Deterministic on purpose: a test that asserts on row 7 must get the same
 * row 7 on every run.
 */
export function makePeople(count: number, startId = 1): Person[] {
  return Array.from({ length: count }, (_, index) => {
    const id = startId + index;
    return {
      id,
      name: `Person ${id}`,
      email: `person${id}@example.com`,
      age: 20 + (id % 40),
      active: id % 2 === 0,
      joined: `2024-0${(id % 9) + 1}-15`,
      customer: { businessName: `Acme ${id}` },
    };
  });
}

/** A small, stable column set: one of every kind the grid supports. */
export const personColumns: ColumnDef<Person>[] = [
  { field: 'name', header: 'Name', width: 160, filter: 'text', editable: true },
  { field: 'email', header: 'Email', width: 200, filter: 'text' },
  { field: 'age', header: 'Age', width: 80, filter: 'number', align: 'right' },
  { field: 'active', header: 'Active', width: 80, filter: 'set' },
];

/* -------------------------------------------------------------------------- */
/* Data sources                                                               */
/* -------------------------------------------------------------------------- */

/** A data source that resolves immediately, plus the spy on `getRows`. */
export interface StubDataSource<T> extends HxDataSource<T> {
  /** Every request the grid has issued, oldest first. */
  readonly requests: HxRowsRequest[];
  /** The `getRows` spy, for call counts and argument assertions. */
  getRows: HxDataSource<T>['getRows'] & { mock: { calls: unknown[][] } };
}

/**
 * Serves `rows` out of memory, honouring `startRow`/`endRow` only — sorting and
 * filtering stay the server's business, so tests assert on the *request* rather
 * than on reordered output.
 */
export function stubDataSource<T>(
  rows: T[],
  options: {
    /** Total to report, independent of how many rows are served. */
    lastRow?: number;
    /** Delay before answering, for observing the in-flight state. */
    delayMs?: number;
    /**
     * A total that can change between requests -- for the case where a filter
     * shrinks the result set out from under the current page. When given, it
     * caps the served slice as well as the reported total.
     */
    total?: () => number;
  } = {}
): StubDataSource<T> {
  const requests: HxRowsRequest[] = [];

  const getRows = vi.fn(
    async (request: HxRowsRequest): Promise<HxRowsResponse<T>> => {
      requests.push(request);
      if (options.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
      if (options.total) {
        const total = options.total();
        return {
          rows: rows.slice(request.startRow, Math.min(request.endRow, total)),
          lastRow: total,
        };
      }
      return {
        rows: rows.slice(request.startRow, request.endRow),
        lastRow: options.lastRow ?? rows.length,
      };
    }
  );

  return { getRows, requests } as unknown as StubDataSource<T>;
}

/**
 * The most recent request a stub received.
 *
 * A plain index rather than `Array.prototype.at`, which the library's ES2020
 * `lib` setting does not declare.
 */
export function lastRequest<T>(source: StubDataSource<T>): HxRowsRequest {
  return source.requests[source.requests.length - 1];
}

/** A promise whose settlement the test controls. */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

/** Creates a manually-settled promise, for driving race conditions. */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * A data source whose every call is settled by hand.
 *
 * `calls[n]` exposes the request, the signal and the deferred response, so a
 * test can resolve request 2 before request 1 and assert which one lands.
 */
export function controllableDataSource<T>() {
  const calls: Array<{
    request: HxRowsRequest;
    signal: AbortSignal;
    deferred: Deferred<HxRowsResponse<T>>;
  }> = [];

  const getRows = vi.fn((request: HxRowsRequest, signal: AbortSignal) => {
    const entry = { request, signal, deferred: deferred<HxRowsResponse<T>>() };
    calls.push(entry);
    return entry.deferred.promise;
  });

  return { dataSource: { getRows } as HxDataSource<T>, calls, getRows };
}

/* -------------------------------------------------------------------------- */
/* jsdom driving                                                              */
/* -------------------------------------------------------------------------- */

interface ResizeObserverStubShape {
  instances: Array<{
    callback: ResizeObserverCallback;
    targets: Set<Element>;
  }>;
}

/**
 * Fires every live `ResizeObserver` with the given box.
 *
 * The grid renders no rows until it has been measured — `viewportHeight` starts
 * at 0, which makes the virtual window empty — so an integration test must call
 * this before looking for cells.
 */
export function resizeViewport(width = 800, height = 400): void {
  const stub = (globalThis as unknown as Record<string, ResizeObserverStubShape>)
    .__ResizeObserverStub;

  act(() => {
    for (const instance of stub.instances) {
      const entries = [...instance.targets].map(
        (target) =>
          ({
            target,
            contentRect: { width, height } as DOMRectReadOnly,
          }) as ResizeObserverEntry
      );
      instance.callback(entries, instance as unknown as ResizeObserver);
    }
  });
}

/**
 * Lets React finish the renders a settled fetch kicks off.
 *
 * The row window is applied by an effect that runs *after* the render which
 * cleared `aria-busy`, so waiting on the busy flag alone can observe a grid
 * that has its rows but has not painted them yet.
 */
export async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/**
 * Runs the queued `requestAnimationFrame` callbacks.
 *
 * `useVirtualRows` coalesces scroll handling into one frame, so a scroll is not
 * observable until the frame has run.
 */
export async function flushFrames(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

/** An element's horizontal box, in viewport px. */
export interface FakeBox {
  left: number;
  width: number;
}

/**
 * Gives elements the horizontal geometry jsdom never computes.
 *
 * `boxOf` is asked for each element that is measured; returning `undefined`
 * leaves it 0 wide. It is consulted on every measurement, so a test moves
 * things by changing what it returns. A `translateX(...)` in an element's
 * inline `transform` moves its box, as it would in a browser. Undone by
 * `restoreMocks`.
 */
export function fakeHorizontalLayout(boxOf: (element: HTMLElement) => FakeBox | undefined) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const box = boxOf(this) ?? { left: 0, width: 0 };
      const shift = Number(/translateX\((-?[\d.]+)px\)/.exec(this.style.transform)?.[1] ?? 0);
      const left = box.left + shift;
      return {
        left,
        right: left + box.width,
        width: box.width,
        x: left,
        top: 0,
        bottom: 0,
        height: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    }
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    function (this: HTMLElement) {
      return boxOf(this)?.width ?? 0;
    }
  );
}

/** Dispatches a scroll on `element` after setting its `scrollTop`. */
export function scrollTo(element: HTMLElement, scrollTop: number): void {
  Object.defineProperty(element, 'scrollTop', {
    value: scrollTop,
    writable: true,
    configurable: true,
  });
  element.dispatchEvent(new Event('scroll', { bubbles: false }));
}
