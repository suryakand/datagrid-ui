export const SELECTION_COLUMN_WIDTH = 40;

export interface SelectionCellProps {
  checked: boolean;
  indeterminate?: boolean;
  onToggle: (shiftKey: boolean) => void;
  isHeader?: boolean;
  label?: string;
  /**
   * Nothing here can be selected. A body row shows a padlock in place of its
   * box; the header keeps its box, greyed out and inert.
   */
  disabled?: boolean;
}

/**
 * Pinned to the left of every row. Kept out of the column model so it cannot be
 * hidden, reordered or exported by accident.
 *
 * In a body row it inherits the row's background (stripe, selection, hover),
 * which `GridRow` keeps opaque so scrolled cells never show through it.
 *
 * Its z-index is inline, like every other sticky cell's: 3 keeps it above the
 * left-pinned body cells (2) that slide underneath it.
 */
export function SelectionCell({
  checked,
  indeterminate,
  onToggle,
  isHeader,
  label,
  disabled,
}: SelectionCellProps) {
  return (
    <div
      className={`sticky left-0 flex h-full items-center justify-center border-r border-gray-200 dark:border-gray-700 ${
        isHeader
          ? 'bg-gray-100 dark:bg-gray-800'
          : 'bg-inherit'
      }`}
      style={{ width: SELECTION_COLUMN_WIDTH, minWidth: SELECTION_COLUMN_WIDTH, zIndex: 3 }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {disabled && !isHeader ? (
        // A row that cannot be selected is locked, not broken: a padlock says
        // so where a greyed-out box only looks inert. Inline, because the
        // package carries no icon dependency.
        <svg
          role="img"
          aria-label="Row cannot be selected"
          viewBox="0 0 448 512"
          className="h-3 w-3 fill-current text-gray-400 dark:text-gray-500"
        >
          <title>Row cannot be selected</title>
          <path d="M400 224h-24v-72C376 68.2 307.8 0 224 0S72 68.2 72 152v72H48c-26.5 0-48 21.5-48 48v192c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V272c0-26.5-21.5-48-48-48zm-104 0H152v-72c0-39.7 32.3-72 72-72s72 32.3 72 72v72z" />
        </svg>
      ) : (
        <input
          type="checkbox"
          className={`h-3.5 w-3.5 accent-brand-500 ${
            disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
          }`}
          checked={checked}
          disabled={disabled}
          aria-label={label ?? (isHeader ? 'Select all rows' : 'Select row')}
          ref={(node) => {
            if (node) node.indeterminate = indeterminate === true;
          }}
          onChange={() => undefined}
          onClick={(event) => onToggle(event.shiftKey)}
        />
      )}
    </div>
  );
}
