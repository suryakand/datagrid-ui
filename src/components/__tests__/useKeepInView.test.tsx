import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { fakeHorizontalLayout, type FakeBox } from '../../test/helpers';
import { useKeepInView } from '../useKeepInView';

function Popup() {
  const ref = useRef<HTMLDivElement>(null);
  useKeepInView(ref);
  return <div data-testid="popup" ref={ref} />;
}

/** A popup inside a clipping box, the way a header popup sits in the grid viewport. */
function setup(boxes: { clip?: FakeBox; popup: FakeBox }, { strict = false } = {}) {
  fakeHorizontalLayout((element) => boxes[element.dataset.testid as 'clip' | 'popup']);
  const tree = boxes.clip ? (
    <div data-testid="clip" style={{ overflowX: 'auto' }}>
      <Popup />
    </div>
  ) : (
    <Popup />
  );
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return { boxes, popup: screen.getByTestId('popup') };
}

describe('useKeepInView', () => {
  it('leaves a popup that already fits where it is', () => {
    const { popup } = setup({ clip: { left: 0, width: 800 }, popup: { left: 300, width: 240 } });
    expect(popup.style.transform).toBe('');
  });

  it('slides a popup that starts left of the clipping ancestor back inside it', () => {
    // The narrow-first-column case: right-aligned under a 100px column, the
    // 240px popup would start 120px left of the viewport.
    const { popup } = setup({ clip: { left: 100, width: 800 }, popup: { left: -20, width: 240 } });
    expect(popup.style.transform).toBe('translateX(124px)');
  });

  it('slides a popup that runs past the right edge back inside it', () => {
    const { popup } = setup({ clip: { left: 0, width: 300 }, popup: { left: 200, width: 240 } });
    expect(popup.style.transform).toBe('translateX(-144px)');
  });

  it('keeps the left edge in view when the popup is wider than the space', () => {
    const { popup } = setup({ clip: { left: 100, width: 200 }, popup: { left: 150, width: 240 } });
    expect(popup.getBoundingClientRect().left).toBe(104);
  });

  it('stays inside the window when nothing else clips it', () => {
    const { popup } = setup({ popup: { left: -30, width: 240 } });
    expect(popup.style.transform).toBe('translateX(34px)');
  });

  it('re-fits when the clipping ancestor scrolls', () => {
    const { boxes, popup } = setup({
      clip: { left: 0, width: 800 },
      popup: { left: 300, width: 240 },
    });
    expect(popup.style.transform).toBe('');

    // Scrolling right carries the popup's column toward the left edge.
    boxes.popup = { left: -50, width: 240 };
    act(() => {
      fireEvent.scroll(screen.getByTestId('clip'));
    });
    expect(popup.style.transform).toBe('translateX(54px)');

    // And back: the shift is undone rather than stacked.
    boxes.popup = { left: 300, width: 240 };
    act(() => {
      fireEvent.scroll(screen.getByTestId('clip'));
    });
    expect(popup.style.transform).toBe('');
  });

  // StrictMode replays the layout effect straight after the first run. The
  // replay must see the shift the first run applied, not stack a second one.
  it('does not double the shift when the effect is replayed', () => {
    const { popup } = setup(
      { clip: { left: 100, width: 800 }, popup: { left: -20, width: 240 } },
      { strict: true }
    );
    expect(popup.style.transform).toBe('translateX(124px)');
  });

  it('does nothing for a popup that has not been laid out', () => {
    const { popup } = setup({ clip: { left: 100, width: 800 }, popup: { left: 0, width: 0 } });
    expect(popup.style.transform).toBe('');
  });
});
