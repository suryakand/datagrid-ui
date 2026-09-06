/**
 * A ~50 line tokenizer, in place of a syntax-highlighting dependency.
 *
 * It is a single ordered pass — each token is matched once and never
 * re-scanned — so unlike the usual chain of `String.replace` calls it cannot
 * corrupt code by highlighting inside a string or a comment.
 */

export type TokenKind =
  | 'comment'
  | 'string'
  | 'keyword'
  | 'number'
  | 'tag'
  | 'attr'
  | 'plain';

export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'of', 'in',
  'while', 'switch', 'case', 'break', 'continue', 'new', 'try', 'catch',
  'finally', 'throw', 'typeof', 'instanceof', 'await', 'async', 'class',
  'extends', 'import', 'from', 'export', 'default', 'interface', 'type',
  'implements', 'as', 'void', 'null', 'undefined', 'true', 'false', 'this',
  'readonly', 'delete', 'yield', 'satisfies',
]);

/*
 * Order is the whole design: comments and strings are consumed before
 * anything can match inside them.
 */
const PATTERN = new RegExp(
  [
    '(?<comment>\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*)',
    '(?<string>`(?:\\\\.|[^`\\\\])*`|\'(?:\\\\.|[^\'\\\\\\n])*\'|"(?:\\\\.|[^"\\\\\\n])*")',
    // JSX element names, including the closing slash and dotted members.
    '(?<tag><\\/?[A-Za-z][\\w.]*)',
    '(?<number>\\b\\d[\\d_]*(?:\\.\\d+)?\\b)',
    '(?<word>[A-Za-z_$][\\w$]*)',
  ].join('|'),
  'g'
);

export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const match of code.matchAll(PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      tokens.push({ kind: 'plain', text: code.slice(cursor, index) });
    }

    const groups = match.groups ?? {};
    const text = match[0];

    if (groups.comment) tokens.push({ kind: 'comment', text });
    else if (groups.string) tokens.push({ kind: 'string', text });
    else if (groups.tag) tokens.push({ kind: 'tag', text });
    else if (groups.number) tokens.push({ kind: 'number', text });
    else if (groups.word) {
      tokens.push({ kind: KEYWORDS.has(text) ? 'keyword' : 'plain', text });
    }

    cursor = index + text.length;
  }

  if (cursor < code.length) {
    tokens.push({ kind: 'plain', text: code.slice(cursor) });
  }
  return tokens;
}

/** Code blocks are always dark, so one palette covers both themes. */
export const TOKEN_CLASS: Record<TokenKind, string> = {
  comment: 'text-gray-500 italic',
  string: 'text-emerald-300',
  keyword: 'text-violet-300',
  number: 'text-amber-300',
  tag: 'text-sky-300',
  attr: 'text-sky-200',
  plain: 'text-gray-200',
};
