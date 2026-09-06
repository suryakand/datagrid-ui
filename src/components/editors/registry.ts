import {
  CheckboxEditor,
  DateEditor,
  NumberEditor,
  SelectEditor,
  TextEditor,
} from './BuiltinEditors';

/**
 * Maps a {@link BuiltinEditor} name to its component.
 *
 * Look one up to reuse it inside a custom editor, or to check which names are
 * available.
 *
 * @example
 * ```tsx
 * const Base = BUILTIN_EDITORS.text;
 * const UppercaseEditor: EditorComponent<Row> = (params) => (
 *   <Base {...params} onChange={(v) => params.onChange(String(v).toUpperCase())} />
 * );
 * ```
 */
export const BUILTIN_EDITORS = {
  /** Single-line text input. See {@link TextEditor}. */
  text: TextEditor,
  /** Numeric input that writes `null` when cleared. See {@link NumberEditor}. */
  number: NumberEditor,
  /** Native date input over `YYYY-MM-DD`. See {@link DateEditor}. */
  date: DateEditor,
  /** Dropdown over `editorParams.options`. See {@link SelectEditor}. */
  select: SelectEditor,
  /** Boolean checkbox. See {@link CheckboxEditor}. */
  checkbox: CheckboxEditor,
} as const;
