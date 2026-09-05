import {
  CheckboxEditor,
  DateEditor,
  NumberEditor,
  SelectEditor,
  TextEditor,
} from './BuiltinEditors';

/** Maps a `ColumnDef.editor` string to its component. */
export const BUILTIN_EDITORS = {
  text: TextEditor,
  number: NumberEditor,
  date: DateEditor,
  select: SelectEditor,
  checkbox: CheckboxEditor,
} as const;
