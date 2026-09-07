import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CheckboxEditor,
  DateEditor,
  NumberEditor,
  SelectEditor,
  TextEditor,
} from '../BuiltinEditors';
import { BUILTIN_EDITORS } from '../registry';
import type { ColumnDef, EditorParams } from '../../../types';

interface Row {
  id: number;
  name: string;
}

const row: Row = { id: 1, name: 'Ada' };
const column: ColumnDef<Row, unknown> = { field: 'name', header: 'Name' };

function params(overrides: Partial<EditorParams<Row, unknown>> = {}) {
  return {
    value: '',
    row,
    column,
    context: undefined as unknown,
    onChange: vi.fn(),
    onCommit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  } as EditorParams<Row, unknown>;
}

describe('the editor registry', () => {
  it('maps every documented name to its component', () => {
    expect(BUILTIN_EDITORS).toEqual({
      text: TextEditor,
      number: NumberEditor,
      date: DateEditor,
      select: SelectEditor,
      checkbox: CheckboxEditor,
    });
  });
});

describe('TextEditor', () => {
  it('shows the current value', () => {
    render(<TextEditor {...params({ value: 'Ada' })} />);
    expect(screen.getByRole('textbox')).toHaveValue('Ada');
  });

  it('renders null and undefined as an empty field rather than the word "null"', () => {
    const { rerender } = render(<TextEditor {...params({ value: null })} />);
    expect(screen.getByRole('textbox')).toHaveValue('');
    rerender(<TextEditor {...params({ value: undefined })} />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('emits each keystroke as a string', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TextEditor {...params({ value: '', onChange })} />);

    await user.type(screen.getByRole('textbox'), 'A');
    expect(onChange).toHaveBeenLastCalledWith('A');
  });

  it('reads its placeholder from editorParams', () => {
    render(
      <TextEditor
        {...params({
          column: { ...column, editorParams: { placeholder: 'Full name' } },
        })}
      />
    );
    expect(screen.getByPlaceholderText('Full name')).toBeInTheDocument();
  });

  it('marks itself invalid and surfaces the message as a tooltip', () => {
    render(<TextEditor {...params({ error: 'Required' })} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('title', 'Required');
    expect(input.className).toContain('border-error-500');
  });

  it('is not marked invalid without an error', () => {
    render(<TextEditor {...params()} />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });

  it('autofocuses only when asked', () => {
    const { unmount } = render(<TextEditor {...params({ autoFocus: true })} />);
    expect(screen.getByRole('textbox')).toHaveFocus();
    unmount();

    render(<TextEditor {...params()} />);
    expect(screen.getByRole('textbox')).not.toHaveFocus();
  });
});

describe('keyboard contract, shared by every editor', () => {
  it('commits on Enter and cancels on Escape', async () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<TextEditor {...params({ onCommit, onCancel, autoFocus: true })} />);

    await user.keyboard('{Enter}');
    expect(onCommit).toHaveBeenCalledOnce();

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('stops Enter propagating, so an enclosing form does not also submit', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onOuterKeyDown = vi.fn();
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit} onKeyDown={onOuterKeyDown}>
        <TextEditor {...params({ autoFocus: true })} />
      </form>
    );

    await user.keyboard('{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOuterKeyDown).not.toHaveBeenCalled();
  });

  it('applies the same contract to the number, date, select and checkbox editors', async () => {
    const user = userEvent.setup();
    for (const Editor of [NumberEditor, DateEditor, SelectEditor, CheckboxEditor]) {
      const onCommit = vi.fn();
      const onCancel = vi.fn();
      const view = render(<Editor {...params({ onCommit, onCancel, autoFocus: true })} />);

      await user.keyboard('{Enter}');
      await user.keyboard('{Escape}');

      expect(onCommit, Editor.name).toHaveBeenCalledOnce();
      expect(onCancel, Editor.name).toHaveBeenCalledOnce();
      view.unmount();
    }
  });
});

describe('NumberEditor', () => {
  it('emits a number, not the raw string', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NumberEditor {...params({ value: null, onChange })} />);

    await user.type(screen.getByRole('spinbutton'), '4');
    expect(onChange).toHaveBeenLastCalledWith(4);
    expect(onChange.mock.calls[0][0]).toBeTypeOf('number');
  });

  it('emits the whole field, not just the new digit, as the draft grows', async () => {
    // Controlled input: the parent feeds the accumulated value back in.
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<NumberEditor {...params({ value: 4, onChange })} />);

    await user.type(screen.getByRole('spinbutton'), '2');
    expect(onChange).toHaveBeenLastCalledWith(42);

    rerender(<NumberEditor {...params({ value: 42, onChange })} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(42);
  });

  it('emits null when cleared, so an empty cell is never stored as NaN', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<NumberEditor {...params({ value: 7, onChange })} />);

    await user.clear(screen.getByRole('spinbutton'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('shows zero rather than an empty field', () => {
    render(<NumberEditor {...params({ value: 0 })} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(0);
  });
});

describe('DateEditor', () => {
  function dateInput(container: HTMLElement) {
    return container.querySelector('input[type="date"]') as HTMLInputElement;
  }

  it('accepts a YYYY-MM-DD string unchanged', () => {
    const { container } = render(<DateEditor {...params({ value: '2024-05-17' })} />);
    expect(dateInput(container).value).toBe('2024-05-17');
  });

  it('normalises a Date instance to YYYY-MM-DD', () => {
    const { container } = render(
      <DateEditor {...params({ value: new Date(Date.UTC(2024, 4, 17)) })} />
    );
    expect(dateInput(container).value).toBe('2024-05-17');
  });

  it('normalises a full ISO timestamp', () => {
    const { container } = render(
      <DateEditor {...params({ value: '2024-05-17T13:45:00.000Z' })} />
    );
    expect(dateInput(container).value).toBe('2024-05-17');
  });

  it('falls back to an empty field for null, empty and unparseable values', () => {
    for (const value of [null, undefined, '', 'not a date']) {
      const { container, unmount } = render(<DateEditor {...params({ value })} />);
      expect(dateInput(container).value, String(value)).toBe('');
      unmount();
    }
  });
});

describe('SelectEditor', () => {
  const options = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 42, label: 'Forty-two' },
    { value: false, label: 'Off' },
  ];
  const selectColumn: ColumnDef<Row, unknown> = {
    ...column,
    editorParams: { options },
  };

  it('lists a blank choice plus every option label', () => {
    render(<SelectEditor {...params({ column: selectColumn })} />);
    const labels = [...(screen.getByRole('combobox') as HTMLSelectElement).options].map(
      (option) => option.textContent
    );
    expect(labels).toEqual(['--', 'Active', 'Forty-two', 'Off']);
  });

  it('preselects the option matching the current value by identity', () => {
    render(<SelectEditor {...params({ value: 42, column: selectColumn })} />);
    expect(screen.getByRole('combobox')).toHaveValue('1');
  });

  it('preselects a falsy option value rather than falling back to blank', () => {
    // `false` is a legitimate option value; index lookup is what makes it work.
    render(<SelectEditor {...params({ value: false, column: selectColumn })} />);
    expect(screen.getByRole('combobox')).toHaveValue('2');
  });

  it('shows blank when the current value matches no option', () => {
    render(<SelectEditor {...params({ value: 'UNKNOWN', column: selectColumn })} />);
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('emits the option value with its original type, not a string', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SelectEditor {...params({ column: selectColumn, onChange })} />);

    await user.selectOptions(screen.getByRole('combobox'), '1');
    expect(onChange).toHaveBeenLastCalledWith(42);

    await user.selectOptions(screen.getByRole('combobox'), '2');
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  // KNOWN DEFECT. The blank "--" choice carries value="", and `Number('')` is 0
  // rather than NaN, so the `Number.isNaN` guard never fires and the editor
  // emits `options[0].value` instead of null. The result is that a select cell
  // cannot be cleared: picking "--" silently sets the first option.
  // Fix: guard on the raw string (`event.target.value === '' ? null : ...`).
  // Delete `.fails` once that lands -- the assertion below is the intended
  // behaviour, matching NumberEditor's "emits null when cleared".
  it.fails('emits null when the blank choice is picked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SelectEditor {...params({ value: 42, column: selectColumn, onChange })} />);

    await user.selectOptions(screen.getByRole('combobox'), '');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('currently emits the first option when the blank choice is picked', async () => {
    // Pins the defect above so a fix is a deliberate, visible change.
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SelectEditor {...params({ value: 42, column: selectColumn, onChange })} />);

    await user.selectOptions(screen.getByRole('combobox'), '');
    expect(onChange).toHaveBeenLastCalledWith('ACTIVE');
  });

  it('renders just the blank choice when no options are configured', () => {
    render(<SelectEditor {...params()} />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).options).toHaveLength(1);
  });
});

describe('CheckboxEditor', () => {
  it('is checked only for a literal true', () => {
    for (const [value, expected] of [
      [true, true],
      [false, false],
      [null, false],
      ['true', false],
      [1, false],
    ] as const) {
      const { unmount } = render(<CheckboxEditor {...params({ value })} />);
      expect(screen.getByRole('checkbox'), String(value)).toHaveProperty(
        'checked',
        expected
      );
      unmount();
    }
  });

  it('emits true then false, never undefined', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<CheckboxEditor {...params({ value: false, onChange })} />);

    await user.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith(true);

    rerender(<CheckboxEditor {...params({ value: true, onChange })} />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});
