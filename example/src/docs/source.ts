/**
 * Code samples are extracted from the real files at build time, never
 * hand-copied, so a snippet on the page cannot drift from the code that runs.
 *
 * Each sample is delimited in its source file by:
 *
 *   // #region some-name
 *   ...
 *   // #endregion
 *
 * (CSS has no line comments, so those files use the block-comment form of the
 * same two markers.)
 *
 * The markers also give us the true line numbers, so the "View on GitHub" link
 * can deep-link to the exact lines.
 */

const SOURCES = import.meta.glob(
  ['/src/**/*.{ts,tsx,css}', '/server/**/*.mjs'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  }
) as Record<string, string>;

export const REPO = 'https://github.com/suryakand/datagrid-ui';
export const BRANCH = 'main';
/** The example app is a subdirectory of the repo. */
const REPO_PREFIX = 'example';

export interface Snippet {
  /** Path as written in the registry, e.g. `src/examples/live/columns.tsx`. */
  file: string;
  code: string;
  /** 1-indexed, inclusive, and pointing at the real file. */
  startLine: number;
  endLine: number;
  githubUrl: string;
  language: 'tsx' | 'ts' | 'js' | 'css';
}

function keyFor(file: string) {
  return file.startsWith('/') ? file : `/${file}`;
}

function languageFor(file: string): Snippet['language'] {
  if (file.endsWith('.tsx')) return 'tsx';
  if (file.endsWith('.ts')) return 'ts';
  if (file.endsWith('.css')) return 'css';
  return 'js';
}

export function githubUrl(file: string, startLine?: number, endLine?: number) {
  const base = `${REPO}/blob/${BRANCH}/${REPO_PREFIX}/${file}`;
  if (!startLine) return base;
  return `${base}#L${startLine}${endLine && endLine !== startLine ? `-L${endLine}` : ''}`;
}

/** Removes the shared leading indentation so a nested region reads flush-left. */
function dedent(lines: string[]) {
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const shortest = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(shortest));
}

export interface SourceFile {
  file: string;
  code: string;
  lineCount: number;
  githubUrl: string;
  language: Snippet['language'];
}

/**
 * A whole file, for the Code tab.
 *
 * The `#region` markers are stripped: they are scaffolding for this docs site,
 * not part of how the grid works, and leaving them in would put a comment
 * every few lines of every file. Because that shifts the numbering, the
 * GitHub link for a full file deliberately carries no line range.
 */
export function getFile(file: string): SourceFile {
  const source = SOURCES[keyFor(file)];
  if (source === undefined) {
    throw new Error(
      `No source for "${file}". Known files: ${Object.keys(SOURCES).join(', ')}`
    );
  }

  const isMarker = (line: string) => {
    const text = line.trim();
    return (
      text.startsWith('// #region') ||
      text.startsWith('/* #region') ||
      text === '// #endregion' ||
      text === '/* #endregion */'
    );
  };

  const lines = source.split('\n').filter((line) => !isMarker(line));

  return {
    file,
    code: lines.join('\n').replace(/\s+$/, ''),
    lineCount: lines.length,
    githubUrl: githubUrl(file),
    language: languageFor(file),
  };
}

export function getSnippet(file: string, region: string): Snippet {
  const source = SOURCES[keyFor(file)];
  if (source === undefined) {
    throw new Error(
      `No source for "${file}". Known files: ${Object.keys(SOURCES).join(', ')}`
    );
  }

  const lines = source.split('\n');
  const isStart = (line: string) =>
    line.trim() === `// #region ${region}` ||
    line.trim() === `/* #region ${region} */`;
  const isEnd = (line: string) =>
    line.trim() === '// #endregion' || line.trim() === '/* #endregion */';

  const start = lines.findIndex(isStart);
  if (start === -1) {
    throw new Error(`Region "${region}" not found in ${file}`);
  }
  const end = lines.findIndex((line, index) => index > start && isEnd(line));
  if (end === -1) {
    throw new Error(`Region "${region}" in ${file} is never closed`);
  }

  // Between the markers, exclusive.
  const body = lines.slice(start + 1, end);
  const startLine = start + 2;

  return {
    file,
    code: dedent(body).join('\n').replace(/\s+$/, ''),
    startLine,
    endLine: end,
    githubUrl: githubUrl(file, startLine, end),
    language: languageFor(file),
  };
}
