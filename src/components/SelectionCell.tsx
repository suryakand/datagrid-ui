export const SELECTION_COLUMN_WIDTH = 40;

export interface SelectionCellProps {
  checked: boolean;
  indeterminate?: boolean;
  onToggle: (shiftKey: boolean) => void;
  isHeader?: boolean;
  label?: string;
}

/**
 * Pinned to the left of every row. Kept out of the column model so it cannot be
 * hidden, reordered or exported by accident.
 */
export function SelectionCell({
  checked,
  indeterminate,
  onToggle,
  isHeader,
  label,
}: SelectionCellProps) {
  return (
    <div
      className={`sticky left-0 z-[3] flex h-full items-center justify-center border-r border-gray-200 dark:border-gray-700 ${
        isHeader
          ? 'bg-gray-100 dark:bg-gray-800'
          : 'bg-inherit'
      }`}
      style={{ width: SELECTION_COLUMN_WIDTH, minWidth: SELECTION_COLUMN_WIDTH }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        className="h-3.5 w-3.5 cursor-pointer accent-brand-500"
        checked={checked}
        aria-label={label ?? (isHeader ? 'Select all rows' : 'Select row')}
        ref={(node) => {
          if (node) node.indeterminate = indeterminate === true;
        }}
        onChange={() => undefined}
        onClick={(event) => onToggle(event.shiftKey)}
      />
    </div>
  );
}
