import { useMemo } from 'react';
import { CodeBlock, CopyButton, GithubLink } from './CodeBlock';
import { getSnippet } from './source';

/** One extracted region, with its own copy and deep GitHub link. */
export function CodeSnippet({ file, region }: { file: string; region: string }) {
  // A missing region is an authoring mistake, not a user-facing error —
  // surface it loudly in place rather than blanking the page.
  const snippet = useMemo(() => {
    try {
      return { ok: true as const, value: getSnippet(file, region) };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }, [file, region]);

  if (!snippet.ok) {
    return (
      <p className="rounded-lg border border-error-300 bg-error-50 px-3 py-2 text-xs text-error-700 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-300">
        {snippet.message}
      </p>
    );
  }

  const { code, githubUrl, startLine, endLine } = snippet.value;

  return (
    <figure className="m-0 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
      <figcaption className="flex items-center gap-2 border-b border-gray-200 bg-gray-100 px-3 py-1.5 dark:border-gray-800 dark:bg-gray-800/60">
        <code className="min-w-0 truncate font-mono text-[11px] text-gray-600 dark:text-gray-300">
          {file}
        </code>
        <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
          L{startLine}–L{endLine}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <CopyButton code={code} />
          <GithubLink url={githubUrl} title={`${file} lines ${startLine}–${endLine} on GitHub`} />
        </div>
      </figcaption>
      <CodeBlock code={code} />
    </figure>
  );
}
