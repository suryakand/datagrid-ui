import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GridPagination } from '../GridPagination';

function setup(overrides: Partial<React.ComponentProps<typeof GridPagination>> = {}) {
  const onPageChange = vi.fn();
  const onPageSizeChange = vi.fn();
  render(
    <GridPagination
      page={0}
      pageSize={20}
      totalRows={100}
      pageSizeOptions={[10, 20, 50]}
      isLoading={false}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      {...overrides}
    />
  );
  return { onPageChange, onPageSizeChange, user: userEvent.setup() };
}

describe('range summary', () => {
  it('reports a one-based inclusive range for the current page', () => {
    setup({ page: 2, pageSize: 20, totalRows: 100 });
    expect(screen.getByText('41-60 of 100')).toBeInTheDocument();
  });

  it('clamps the upper bound on a partial last page', () => {
    setup({ page: 2, pageSize: 20, totalRows: 45 });
    expect(screen.getByText('41-45 of 45')).toBeInTheDocument();
  });

  it('reads 0-0 of 0 for an empty result set', () => {
    setup({ page: 0, totalRows: 0 });
    expect(screen.getByText('0-0 of 0')).toBeInTheDocument();
  });

  it('replaces the range with a loading note while a fetch is in flight', () => {
    setup({ isLoading: true });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText(/of 100/)).not.toBeInTheDocument();
  });
});

describe('page count', () => {
  it('rounds a partial last page up', () => {
    setup({ pageSize: 20, totalRows: 41 });
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('never reports fewer than one page, even with no rows', () => {
    setup({ totalRows: 0 });
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });
});

describe('navigation', () => {
  it('disables First and Prev on the first page', () => {
    setup({ page: 0 });
    expect(screen.getByRole('button', { name: '« First' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '‹ Prev' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next ›' })).toBeEnabled();
  });

  it('disables Next and Last on the final page', () => {
    setup({ page: 4, pageSize: 20, totalRows: 100 });
    expect(screen.getByRole('button', { name: 'Next ›' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Last »' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '‹ Prev' })).toBeEnabled();
  });

  it('disables every navigation control when there is a single page', () => {
    setup({ totalRows: 5, pageSize: 20 });
    for (const name of ['« First', '‹ Prev', 'Next ›', 'Last »']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });

  it('emits the correct zero-based index from each control', async () => {
    const { onPageChange, user } = setup({ page: 2, pageSize: 20, totalRows: 100 });

    await user.click(screen.getByRole('button', { name: '‹ Prev' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);

    await user.click(screen.getByRole('button', { name: 'Next ›' }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);

    await user.click(screen.getByRole('button', { name: '« First' }));
    expect(onPageChange).toHaveBeenLastCalledWith(0);

    await user.click(screen.getByRole('button', { name: 'Last »' }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
  });
});

describe('page size selector', () => {
  it('offers exactly the sizes it was given, with the current one selected', () => {
    setup({ pageSize: 50, pageSizeOptions: [10, 20, 50] });
    const select = screen.getByRole('combobox', { name: /rows/i }) as HTMLSelectElement;
    expect(select.value).toBe('50');
    expect([...select.options].map((o) => o.value)).toEqual(['10', '20', '50']);
  });

  it('emits the new size as a number, not a string', async () => {
    const { onPageSizeChange, user } = setup();
    await user.selectOptions(screen.getByRole('combobox', { name: /rows/i }), '50');
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});
