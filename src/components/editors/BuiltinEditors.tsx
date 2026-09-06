/**
 * The five editors that ship with the grid.
 *
 * Each one writes into the row draft through `onChange` and never touches the
 * network — {@link DataGridProps.onRowCommit} owns persistence. Enter commits
 * the row, Escape abandons it.
 */

import type { EditorParams } from '../../types';

const INPUT_CLASS =
  'h-7 w-full rounded border px-1.5 text-xs outline-none ' +
  'border-gray-300 bg-white text-gray-800 ' +
  'focus:border-brand-500 focus:ring-1 focus:ring-brand-500 ' +
  'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

const ERROR_CLASS = '!border-error-500 focus:!border-error-500 focus:!ring-error-500';

function className(error?: string): string {
  return error ? `${INPUT_CLASS} ${ERROR_CLASS}` : INPUT_CLASS;
}

/** Enter commits the row, Escape abandons it -- shared by every editor. */
function keyHandler(params: { onCommit: () => void; onCancel: () => void }) {
  return (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      params.onCommit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      params.onCancel();
    }
  };
}

/**
 * Single-line text input. The default editor when a column sets
 * `editable: true` without naming one.
 *
 * Reads `editorParams.placeholder`.
 */
export function TextEditor<T, C>({
  value,
  onChange,
  onCommit,
  onCancel,
  error,
  autoFocus,
  column,
}: EditorParams<T, C>) {
  return (
    <input
      type="text"
      className={className(error)}
      value={value == null ? '' : String(value)}
      autoFocus={autoFocus}
      placeholder={column.editorParams?.placeholder}
      title={error}
      aria-invalid={error ? true : undefined}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={keyHandler({ onCommit, onCancel })}
    />
  );
}

/**
 * Numeric input. Writes a `number`, or `null` when the field is cleared, so an
 * empty cell is never stored as `NaN` or `''`.
 *
 * Reads `editorParams.placeholder`.
 */
export function NumberEditor<T, C>({
  value,
  onChange,
  onCommit,
  onCancel,
  error,
  autoFocus,
}: EditorParams<T, C>) {
  return (
    <input
      type="number"
      className={className(error)}
      value={value == null ? '' : String(value)}
      autoFocus={autoFocus}
      title={error}
      aria-invalid={error ? true : undefined}
      onChange={(event) =>
        onChange(event.target.value === '' ? null : Number(event.target.value))
      }
      onKeyDown={keyHandler({ onCommit, onCancel })}
    />
  );
}

/**
 * Native date input. Reads and writes `YYYY-MM-DD` strings, matching
 * {@link DateFilterModel}.
 */
export function DateEditor<T, C>({
  value,
  onChange,
  onCommit,
  onCancel,
  error,
  autoFocus,
}: EditorParams<T, C>) {
  // Normalise whatever the row holds (ISO string, Date, timestamp) to the
  // `YYYY-MM-DD` a native date input requires.
  const asInputValue = (() => {
    if (value == null || value === '') return '';
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  })();

  return (
    <input
      type="date"
      className={className(error)}
      value={asInputValue}
      autoFocus={autoFocus}
      title={error}
      aria-invalid={error ? true : undefined}
      onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      onKeyDown={keyHandler({ onCommit, onCancel })}
    />
  );
}

/**
 * Dropdown over `editorParams.options`. Values round-trip by identity, so a
 * non-string option value is preserved rather than stringified.
 */
export function SelectEditor<T, C>({
  value,
  onChange,
  onCommit,
  onCancel,
  error,
  autoFocus,
  column,
}: EditorParams<T, C>) {
  const options = column.editorParams?.options ?? [];
  const selectedIndex = options.findIndex((option) => option.value === value);

  return (
    <select
      className={className(error)}
      value={selectedIndex === -1 ? '' : String(selectedIndex)}
      autoFocus={autoFocus}
      title={error}
      aria-invalid={error ? true : undefined}
      onChange={(event) => {
        const index = Number(event.target.value);
        onChange(Number.isNaN(index) ? null : options[index]?.value ?? null);
      }}
      onKeyDown={keyHandler({ onCommit, onCancel })}
    >
      <option value="">--</option>
      {options.map((option, index) => (
        <option key={`${String(option.value)}-${index}`} value={index}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Boolean checkbox. Writes `true` or `false`, never `undefined`. */
export function CheckboxEditor<T, C>({
  value,
  onChange,
  onCommit,
  onCancel,
  autoFocus,
}: EditorParams<T, C>) {
  return (
    <input
      type="checkbox"
      className="h-4 w-4 accent-brand-500"
      checked={value === true}
      autoFocus={autoFocus}
      onChange={(event) => onChange(event.target.checked)}
      onKeyDown={keyHandler({ onCommit, onCancel })}
    />
  );
}
