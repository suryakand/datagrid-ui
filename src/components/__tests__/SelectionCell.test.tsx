import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SELECTION_COLUMN_WIDTH, SelectionCell } from '../SelectionCell';

describe('SelectionCell', () => {
  it('renders an unchecked row checkbox with a default label', () => {
    render(<SelectionCell checked={false} onToggle={() => undefined} />);
    const box = screen.getByRole('checkbox', { name: 'Select row' });
    expect(box).not.toBeChecked();
  });

  it('renders the header variant with its own default label', () => {
    render(<SelectionCell isHeader checked={false} onToggle={() => undefined} />);
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBeInTheDocument();
  });

  it('prefers an explicit label over both defaults', () => {
    render(
      <SelectionCell
        isHeader
        checked={false}
        onToggle={() => undefined}
        label="Select all rows on this page"
      />
    );
    expect(
      screen.getByRole('checkbox', { name: 'Select all rows on this page' })
    ).toBeInTheDocument();
  });

  it('reflects the checked prop', () => {
    render(<SelectionCell checked onToggle={() => undefined} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('sets the indeterminate DOM property, which has no HTML attribute', () => {
    render(<SelectionCell checked={false} indeterminate onToggle={() => undefined} />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).indeterminate).toBe(true);
  });

  it('is not indeterminate when the flag is absent', () => {
    render(<SelectionCell checked={false} onToggle={() => undefined} />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).indeterminate).toBe(false);
  });

  it('reports whether shift was held, which is what drives range selection', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<SelectionCell checked={false} onToggle={onToggle} />);

    await user.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenLastCalledWith(false);

    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('checkbox'));
    await user.keyboard('{/Shift}');
    expect(onToggle).toHaveBeenLastCalledWith(true);
  });

  it('swallows the click so the row underneath does not also react', async () => {
    const onRowClick = vi.fn();
    const onRowDoubleClick = vi.fn();
    const user = userEvent.setup();
    render(
      <div onClick={onRowClick} onDoubleClick={onRowDoubleClick}>
        <SelectionCell checked={false} onToggle={() => undefined} />
      </div>
    );

    await user.dblClick(screen.getByRole('checkbox'));

    expect(onRowClick).not.toHaveBeenCalled();
    expect(onRowDoubleClick).not.toHaveBeenCalled();
  });

  it('exports the fixed width the header and rows both reserve', () => {
    expect(SELECTION_COLUMN_WIDTH).toBe(40);
  });
});
