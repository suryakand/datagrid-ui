import { useMemo, useState } from 'react';
import { TOKEN_CLASS, tokenize } from './highlight';

/** The highlighted `<pre>`, shared by the snippet cards and the Code tab. */
export function CodeBlock({ code, className = '' }: { code: string; className?: string }) {
  // A whole file can be a few hundred lines; do not re-tokenize it because a
  // sibling tab changed.
  const tokens = useMemo(() => tokenize(code), [code]);

  return (
    <pre
      className={`m-0 overflow-auto bg-gray-900 p-3 text-[11.5px] leading-[1.65] dark:bg-black/40 ${className}`}
    >
      <code className="font-mono">
        {tokens.map((token, index) => (
          <span key={index} className={TOKEN_CLASS[token.kind]}>
            {token.text}
          </span>
        ))}
      </code>
    </pre>
  );
}

export const ACTION_CLASS =
  'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-gray-600 ' +
  'no-underline hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10';

export function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={ACTION_CLASS}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard is unavailable over plain http in some browsers.
        }
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function ExternalIcon() {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

export function GithubLink({ url, title }: { url: string; title: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" title={title} className={ACTION_CLASS}>
      View on GitHub
      <ExternalIcon />
    </a>
  );
}
