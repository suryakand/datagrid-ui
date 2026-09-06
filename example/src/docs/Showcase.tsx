import { useMemo, useState, type ReactNode } from 'react';
import { CodeBlock, CopyButton, GithubLink } from './CodeBlock';
import { getFile } from './source';

type Mode = 'preview' | 'code';

/**
 * The demo and its source in one card, behind a Preview / Code toggle.
 *
 * The preview stays mounted while Code is showing — hidden, not unmounted — so
 * switching tabs does not refetch the grid, drop the live stream, or throw away
 * the visitor's sort and scroll position. The grid re-measures itself on the
 * way back because its ResizeObserver fires when the box becomes visible again.
 */
export function Showcase({
  preview,
  files,
  height,
}: {
  preview: ReactNode;
  /** Shown in the Code tab, main file first. */
  files: string[];
  /** Applied to both panels, so toggling never jumps the page. */
  height: string;
}) {
  const [mode, setMode] = useState<Mode>('preview');
  const [activeFile, setActiveFile] = useState(files[0]);

  const source = useMemo(() => {
    try {
      return { ok: true as const, value: getFile(activeFile) };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }, [activeFile]);

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-100 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-800/60">
        <div
          role="tablist"
          aria-label="Preview or source"
          className="flex rounded-md border border-gray-300 p-0.5 dark:border-gray-700"
        >
          {(['preview', 'code'] as Mode[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={`rounded px-2.5 py-0.5 text-[11px] font-medium capitalize transition-colors ${
                mode === value
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10'
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        {mode === 'code' && (
          <code className="min-w-0 truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">
            {source.ok ? `${source.value.lineCount} lines` : ''}
          </code>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {source.ok && <CopyButton code={source.value.code} />}
          {source.ok && (
            <GithubLink url={source.value.githubUrl} title={`${activeFile} on GitHub`} />
          )}
        </div>
      </header>

      {/* File switcher, only meaningful in the Code tab. */}
      {mode === 'code' && files.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-900/60">
          {files.map((file) => (
            <button
              key={file}
              type="button"
              onClick={() => setActiveFile(file)}
              className={`rounded px-2 py-0.5 font-mono text-[11px] transition-colors ${
                file === activeFile
                  ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
              }`}
            >
              {file.split('/').slice(-1)[0]}
            </button>
          ))}
        </div>
      )}

      {/*
        Hidden with a class rather than unmounted — see the note above. Both
        panels get the same height so the page does not jump on toggle.
      */}
      <div
        className={`p-3 ${mode === 'preview' ? '' : 'hidden'}`}
        style={{ height }}
        role="tabpanel"
      >
        {preview}
      </div>

      <div
        className={mode === 'code' ? '' : 'hidden'}
        style={{ height }}
        role="tabpanel"
      >
        {source.ok ? (
          <CodeBlock code={source.value.code} className="h-full" />
        ) : (
          <p className="p-3 text-xs text-error-600 dark:text-error-400">{source.message}</p>
        )}
      </div>
    </section>
  );
}
