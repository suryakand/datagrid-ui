import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

/* -------------------------------------------------------------------------- */
/* jsdom gaps the grid depends on                                             */
/* -------------------------------------------------------------------------- */

// DataGrid measures its viewport with a ResizeObserver, which jsdom has no
// implementation of. The stub records observers so a test can push a size in
// (see `resizeTo` in ./helpers).
class ResizeObserverStub implements ResizeObserver {
  static instances: ResizeObserverStub[] = [];

  readonly targets = new Set<Element>();

  constructor(readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
    const index = ResizeObserverStub.instances.indexOf(this);
    if (index !== -1) ResizeObserverStub.instances.splice(index, 1);
  }
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
(globalThis as Record<string, unknown>).__ResizeObserverStub = ResizeObserverStub;

// jsdom implements no PointerEvent at all, so `fireEvent.pointerMove(el, {
// clientX })` would dispatch a bare Event and the handler would read
// `undefined` for the coordinate. Subclassing MouseEvent carries clientX/Y
// through and gives the pointer fields the resize handler reads.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? true;
    }
  }

  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

// Pointer capture is used by the column resize handle. jsdom implements neither
// side of it, and calling an undefined method would throw mid-drag.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function setPointerCapture() {
    /* no-op */
  };
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = function releasePointerCapture() {
    /* no-op */
  };
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function hasPointerCapture() {
    return false;
  };
}

// `downloadCsv` revokes the object URL it creates; jsdom ships neither method.
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:mock';
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => undefined;
}

/* -------------------------------------------------------------------------- */
/* Isolation between tests                                                    */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  ResizeObserverStub.instances.length = 0;
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});
