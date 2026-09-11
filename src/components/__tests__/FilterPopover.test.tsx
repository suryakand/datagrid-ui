import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterPopover, type FilterPopoverProps } from '../FilterPopover';
import { fakeHorizontalLayout } from '../../test/helpers';

function setup(overrides: Partial<FilterPopoverProps> = {}) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <FilterPopover
      kind="text"
      value={undefined}
      onApply={onApply}
      onClose={onClose}
      {...overrides}
    />
  );
  return { ...view, onApply, onClose, user: userEvent.setup() };
}

const operatorSelect = () => screen.getAllByRole('combobox')[0];
const applyButton = () => screen.getByRole('button', { name: 'Apply' });
const clearButton = () => screen.getByRole('button', { name: 'Clear' });

describe('text filters', () => {
  it('opens on the first text operator and offers all of them', () => {
    setup({ kind: 'text' });
    expect(operatorSelect()).toHaveValue('contains');
    expect([...(operatorSelect() as HTMLSelectElement).options].map((o) => o.value)).toEqual([
      'contains',
      'notContains',
      'equals',
      'notEqual',
      'startsWith',
      'endsWith',
      'blank',
      'notBlank',
    ]);
  });

  it('labels each operator in prose', () => {
    setup({ kind: 'text' });
    expect(screen.getByRole('option', { name: 'Does not contain' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Is not empty' })).toBeInTheDocument();
  });

  it('emits the wire-format filter on Apply', async () => {
    const { onApply, user } = setup({ kind: 'text' });

    await user.type(screen.getByPlaceholderText('Value'), 'acme');
    await user.click(applyButton());

    expect(onApply).toHaveBeenCalledWith({
      filterType: 'text',
      type: 'contains',
      filter: 'acme',
    });
  });

  it('applies on Enter as well as on the button', async () => {
    const { onApply, user } = setup({ kind: 'text' });
    await user.type(screen.getByPlaceholderText('Value'), 'acme{Enter}');
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'acme', type: 'contains' })
    );
  });

  it('emits null for a blank term, which clears the column', async () => {
    const { onApply, user } = setup({ kind: 'text' });
    await user.click(applyButton());
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('hides the operand field for a unary operator', async () => {
    const { onApply, user } = setup({ kind: 'text' });

    await user.selectOptions(operatorSelect(), 'blank');
    expect(screen.queryByPlaceholderText('Value')).not.toBeInTheDocument();

    await user.click(applyButton());
    expect(onApply).toHaveBeenCalledWith({ filterType: 'text', type: 'blank' });
  });

  it('seeds the operator and operand from an existing filter', () => {
    setup({
      kind: 'text',
      value: { filterType: 'text', type: 'startsWith', filter: 'ac' },
    });
    expect(operatorSelect()).toHaveValue('startsWith');
    expect(screen.getByPlaceholderText('Value')).toHaveValue('ac');
  });

  it('clears both fields and emits null on Clear', async () => {
    const { onApply, user } = setup({
      kind: 'text',
      value: { filterType: 'text', type: 'contains', filter: 'acme' },
    });

    await user.click(clearButton());

    expect(onApply).toHaveBeenCalledWith(null);
    expect(screen.getByPlaceholderText('Value')).toHaveValue('');
  });
});

describe('number filters', () => {
  it('opens on equals and uses a numeric input', () => {
    const { container } = setup({ kind: 'number' });
    expect(operatorSelect()).toHaveValue('equals');
    expect(container.querySelector('input[type="number"]')).not.toBeNull();
  });

  it('emits a number, not the typed string', async () => {
    const { onApply, user } = setup({ kind: 'number' });
    await user.type(screen.getByPlaceholderText('Value'), '42');
    await user.click(applyButton());
    expect(onApply).toHaveBeenCalledWith({
      filterType: 'number',
      type: 'equals',
      filter: 42,
    });
  });

  it('reveals a second field for inRange and sends both bounds', async () => {
    const { onApply, user } = setup({ kind: 'number' });

    await user.selectOptions(operatorSelect(), 'inRange');
    await user.type(screen.getByPlaceholderText('Value'), '10');
    await user.type(screen.getByPlaceholderText('To'), '100');
    await user.click(applyButton());

    expect(onApply).toHaveBeenCalledWith({
      filterType: 'number',
      type: 'inRange',
      filter: 10,
      filterTo: 100,
    });
  });

  it('emits null for an incomplete range rather than a half filter', async () => {
    const { onApply, user } = setup({ kind: 'number' });
    await user.selectOptions(operatorSelect(), 'inRange');
    await user.type(screen.getByPlaceholderText('Value'), '10');
    await user.click(applyButton());
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('seeds both bounds from an existing range filter', () => {
    setup({
      kind: 'number',
      value: { filterType: 'number', type: 'inRange', filter: 5, filterTo: 9 },
    });
    expect(screen.getByPlaceholderText('Value')).toHaveValue(5);
    expect(screen.getByPlaceholderText('To')).toHaveValue(9);
  });
});

describe('date filters', () => {
  it('uses native date inputs', () => {
    const { container } = setup({ kind: 'date' });
    expect(container.querySelector('input[type="date"]')).not.toBeNull();
  });

  it('emits YYYY-MM-DD strings', async () => {
    const { onApply, user } = setup({ kind: 'date' });
    await user.type(screen.getByPlaceholderText('Value'), '2024-05-17');
    await user.click(applyButton());
    expect(onApply).toHaveBeenCalledWith({
      filterType: 'date',
      type: 'equals',
      dateFrom: '2024-05-17',
    });
  });

  it('sends both bounds for a range', async () => {
    const { onApply, user } = setup({ kind: 'date' });
    await user.selectOptions(operatorSelect(), 'inRange');
    await user.type(screen.getByPlaceholderText('Value'), '2024-01-01');
    await user.type(screen.getByPlaceholderText('To'), '2024-12-31');
    await user.click(applyButton());

    expect(onApply).toHaveBeenCalledWith({
      filterType: 'date',
      type: 'inRange',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
    });
  });

  it('seeds from an existing date filter', () => {
    setup({
      kind: 'date',
      value: { filterType: 'date', type: 'before', dateFrom: '2024-05-17' },
    });
    expect(operatorSelect()).toHaveValue('before');
    expect(screen.getByPlaceholderText('Value')).toHaveValue('2024-05-17');
  });
});

describe('set filters', () => {
  const values = ['ACTIVE', 'PENDING', 'ARCHIVED'];

  it('lists a static value list with a checkbox each', () => {
    setup({ kind: 'set', setValues: values });
    for (const value of values) {
      expect(screen.getByRole('checkbox', { name: value })).toBeInTheDocument();
    }
  });

  it('preselects the values already in the filter', () => {
    setup({
      kind: 'set',
      setValues: values,
      value: { filterType: 'set', values: ['PENDING'] },
    });
    expect(screen.getByRole('checkbox', { name: 'PENDING' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'ACTIVE' })).not.toBeChecked();
  });

  it('emits the selected values on Apply', async () => {
    const { onApply, user } = setup({ kind: 'set', setValues: values });

    await user.click(screen.getByRole('checkbox', { name: 'ACTIVE' }));
    await user.click(screen.getByRole('checkbox', { name: 'ARCHIVED' }));
    await user.click(applyButton());

    expect(onApply).toHaveBeenCalledWith({
      filterType: 'set',
      values: ['ACTIVE', 'ARCHIVED'],
    });
  });

  it('emits null when nothing is selected', async () => {
    const { onApply, user } = setup({ kind: 'set', setValues: values });
    await user.click(applyButton());
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('unticks a value that is clicked twice', async () => {
    const { onApply, user } = setup({ kind: 'set', setValues: values });
    await user.click(screen.getByRole('checkbox', { name: 'ACTIVE' }));
    await user.click(screen.getByRole('checkbox', { name: 'ACTIVE' }));
    await user.click(applyButton());
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('clears the ticks and the column on Clear', async () => {
    const { onApply, user } = setup({
      kind: 'set',
      setValues: values,
      value: { filterType: 'set', values: ['ACTIVE'] },
    });

    await user.click(clearButton());

    expect(onApply).toHaveBeenCalledWith(null);
    expect(screen.getByRole('checkbox', { name: 'ACTIVE' })).not.toBeChecked();
  });

  it('narrows the list as the search box is typed into', async () => {
    const { user } = setup({ kind: 'set', setValues: values });

    await user.type(screen.getByPlaceholderText('Search values...'), 'arch');

    expect(screen.getByRole('checkbox', { name: 'ARCHIVED' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'ACTIVE' })).not.toBeInTheDocument();
  });

  it('searches case-insensitively and reports when nothing matches', async () => {
    const { user } = setup({ kind: 'set', setValues: values });
    await user.type(screen.getByPlaceholderText('Search values...'), 'ZZZ');
    expect(screen.getByText('No values.')).toBeInTheDocument();
  });

  it('keeps a value selected even after the search hides it', async () => {
    const { onApply, user } = setup({ kind: 'set', setValues: values });

    await user.click(screen.getByRole('checkbox', { name: 'ACTIVE' }));
    await user.type(screen.getByPlaceholderText('Search values...'), 'arch');
    await user.click(screen.getByRole('checkbox', { name: 'ARCHIVED' }));
    await user.click(applyButton());

    expect(onApply).toHaveBeenCalledWith({
      filterType: 'set',
      values: ['ACTIVE', 'ARCHIVED'],
    });
  });

  it('shows a loading note, then the values, for an async loader', async () => {
    const setValues = vi.fn().mockResolvedValue(['A', 'B']);
    setup({ kind: 'set', setValues });

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'A' })).toBeInTheDocument()
    );
    expect(setValues).toHaveBeenCalledOnce();
  });

  it('degrades to an empty list when the loader rejects', async () => {
    const setValues = vi.fn().mockRejectedValue(new Error('offline'));
    setup({ kind: 'set', setValues });
    await waitFor(() => expect(screen.getByText('No values.')).toBeInTheDocument());
  });

  it('shows no operator dropdown, since a set filter has only one operator', () => {
    setup({ kind: 'set', setValues: values });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('dismissal', () => {
  it('closes on an outside mousedown', async () => {
    const { onClose } = setup();
    await userEvent.setup().click(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('stays open for a click inside itself', async () => {
    const { onClose, user } = setup();
    await user.click(screen.getByPlaceholderText('Value'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const { onClose, user } = setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('detaches its document listeners on unmount', async () => {
    const { onClose, unmount } = setup();
    unmount();
    await userEvent.setup().click(document.body);
    expect(onClose).not.toHaveBeenCalled();
  });
});

// Exported for custom surfaces, so it must keep itself in view wherever it is
// mounted, not only inside the grid header.
describe('placement', () => {
  it('slides back inside a clipping container it would overhang', () => {
    // A 240px popover right-aligned to an anchor ending at x=150, inside a
    // scroller that starts at x=50: it would begin 40px left of the scroller.
    fakeHorizontalLayout((element) => {
      if (element.dataset.testid === 'scroller') return { left: 50, width: 600 };
      if (element.parentElement?.dataset.testid === 'anchor') return { left: 150 - 240, width: 240 };
      return undefined;
    });
    render(
      <div data-testid="scroller" style={{ overflowX: 'auto' }}>
        <div data-testid="anchor" style={{ position: 'relative' }}>
          <FilterPopover kind="text" value={undefined} onApply={vi.fn()} onClose={vi.fn()} />
        </div>
      </div>
    );

    const popover = screen.getByTestId('anchor').firstElementChild as HTMLElement;
    expect(popover.getBoundingClientRect().left).toBe(54);
  });
});
