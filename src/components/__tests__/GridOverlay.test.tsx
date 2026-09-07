import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GridOverlay } from '../GridOverlay';

describe('GridOverlay', () => {
  it('shows the default loading message with a spinner', () => {
    const { container } = render(<GridOverlay kind="loading" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('does not intercept pointer events while loading, so the grid stays usable', () => {
    const { container } = render(<GridOverlay kind="loading" />);
    expect(container.firstElementChild?.className).toContain('pointer-events-none');
  });

  it('shows the default error message', () => {
    render(<GridOverlay kind="error" />);
    expect(
      screen.getByText('Something went wrong loading this grid.')
    ).toBeInTheDocument();
  });

  it('shows the default empty message', () => {
    render(<GridOverlay kind="empty" />);
    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('renders a supplied message in place of each default', () => {
    const { rerender } = render(<GridOverlay kind="loading" message="Fetching page 3" />);
    expect(screen.getByText('Fetching page 3')).toBeInTheDocument();

    rerender(<GridOverlay kind="error" message="HTTP 500" />);
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();

    rerender(<GridOverlay kind="empty" message="Nothing matches that filter" />);
    expect(screen.getByText('Nothing matches that filter')).toBeInTheDocument();
  });

  it('accepts a node, not just a string', () => {
    render(<GridOverlay kind="empty" message={<button type="button">Clear filters</button>} />);
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('overlays rather than replaces, so the header keeps its place', () => {
    const { container } = render(<GridOverlay kind="error" />);
    expect(container.firstElementChild?.className).toContain('absolute');
    expect(container.firstElementChild?.className).toContain('inset-0');
  });
});
