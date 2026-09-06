import type { ReactNode } from 'react';
import { CodeSnippet } from './CodeSnippet';
import { githubUrl } from './source';

export interface DocSection {
  title: string;
  /** Prose explaining the customization the snippet demonstrates. */
  body: ReactNode;
  snippet?: { file: string; region: string };
}

export function DocSections({
  sections,
  sourceDir,
}: {
  sections: DocSection[];
  /** Repo-relative directory holding this example, for the footer link. */
  sourceDir: string;
}) {
  return (
    <section className="mt-2 border-t border-gray-200 pt-6 dark:border-gray-800">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        How it works
      </h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Every snippet below is extracted from the running source at build time,
        so it cannot drift from the code on this page.
      </p>

      <div className="mt-5 flex flex-col gap-7">
        {sections.map((section) => (
          <article key={section.title}>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {section.title}
            </h3>
            <div className="mt-1.5 space-y-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {section.body}
            </div>
            {section.snippet && (
              <div className="mt-3">
                <CodeSnippet {...section.snippet} />
              </div>
            )}
          </article>
        ))}
      </div>

      <a
        href={githubUrl(sourceDir)}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 no-underline hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
      >
        Browse this example on GitHub
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          strokeLinejoin="round" aria-hidden
        >
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </a>
    </section>
  );
}

/** Inline code, used throughout the doc prose. */
export function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11.5px] text-gray-800 dark:bg-white/10 dark:text-gray-200">
      {children}
    </code>
  );
}
