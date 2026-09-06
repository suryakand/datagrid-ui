import type { ComponentType, ReactNode } from 'react';
import type { DocSection } from '../docs/DocSections';
import { LIVE_DOCS, MARKET_DOCS, PORTFOLIO_DOCS, THEMING_DOCS } from './docs';
import { IconImage, IconPalette, IconPulse, IconTable } from '../layout/icons';
import { MarketExample } from './market/MarketExample';
import { PortfolioExample } from './portfolio/PortfolioExample';
import { LiveExample } from './live/LiveExample';
import { ThemingExample } from './theming/ThemingExample';

export interface Example {
  id: string;
  title: string;
  /** One line for the sidebar. */
  blurb: string;
  /** Shown under the page title. */
  description: ReactNode;
  icon: ComponentType;
  tags: string[];
  /** Files shown in the Code tab, main file first. */
  source: string[];
  /** Repo-relative directory, for the "browse on GitHub" link. */
  sourceDir: string;
  /** Explained code samples shown under the demo. */
  docs: DocSection[];
  Component: ComponentType;
}

export const EXAMPLES: Example[] = [
  {
    id: 'market',
    title: 'Server-side market data',
    blurb: 'Paging, sorting, filtering, editing',
    description: (
      <>
        480 symbols with every page, sort and filter resolved on the server. Four
        filter kinds, inline editing with server-side validation, CSV export and
        persisted column layout. Try typing <code className="rounded bg-gray-100 px-1 font-mono text-[11px] dark:bg-white/10">TODO</code>{' '}
        into a note to see a rejected commit.
      </>
    ),
    icon: IconTable,
    tags: ['server-side', 'filters', 'editing'],
    source: [
      'src/examples/market/MarketExample.tsx',
      'src/examples/market/columns.tsx',
      'server/index.mjs',
    ],
    sourceDir: 'src/examples/market',
    docs: MARKET_DOCS,
    Component: MarketExample,
  },
  {
    id: 'portfolio',
    title: 'Images in rows',
    blurb: 'Logos, avatars, composite cells',
    description: (
      <>
        Company logos and analyst avatars fetched as real SVGs, with reserved
        boxes so rows never reflow, native lazy loading, and a fallback for
        images that fail. The identity column packs a logo and two lines of text
        into one cell while still sorting and filtering server-side on{' '}
        <code className="rounded bg-gray-100 px-1 font-mono text-[11px] dark:bg-white/10">name</code>.
      </>
    ),
    icon: IconImage,
    tags: ['cell renderers', 'images', 'row height'],
    source: [
      'src/examples/portfolio/PortfolioExample.tsx',
      'src/examples/portfolio/columns.tsx',
      'src/examples/portfolio/CompanyLogo.tsx',
    ],
    sourceDir: 'src/examples/portfolio',
    docs: PORTFOLIO_DOCS,
    Component: PortfolioExample,
  },
  {
    id: 'live',
    title: 'Live updates',
    blurb: 'Streaming ticks, flashing cells',
    description: (
      <>
        A server-sent event feed repricing symbols several times a second.
        Updates arrive as whole rows and are patched in place with{' '}
        <code className="rounded bg-gray-100 px-1 font-mono text-[11px] dark:bg-white/10">api.updateRows()</code>{' '}
        — no refetch, and scroll position, sort and selection all survive.
      </>
    ),
    icon: IconPulse,
    tags: ['SSE', 'updateRows', 'context'],
    source: [
      'src/examples/live/LiveExample.tsx',
      'src/examples/live/columns.tsx',
      'server/index.mjs',
    ],
    sourceDir: 'src/examples/live',
    docs: LIVE_DOCS,
    Component: LiveExample,
  },
  {
    id: 'theming',
    title: 'Theme customization',
    blurb: 'Accent, density, dark mode',
    description: (
      <>
        The grid has no theme prop. It renders Tailwind utilities, Tailwind v4
        compiles those to <code className="rounded bg-gray-100 px-1 font-mono text-[11px] dark:bg-white/10">var(--color-…)</code>,
        and this panel rewrites six custom properties on{' '}
        <code className="rounded bg-gray-100 px-1 font-mono text-[11px] dark:bg-white/10">&lt;html&gt;</code>.
        Change the accent and watch the selection, pager and focus rings follow.
      </>
    ),
    icon: IconPalette,
    tags: ['theming', 'CSS variables', 'density'],
    source: [
      'src/examples/theming/ThemingExample.tsx',
      'src/theme.tsx',
      'src/index.css',
    ],
    sourceDir: 'src/examples/theming',
    docs: THEMING_DOCS,
    Component: ThemingExample,
  },
];

export const DEFAULT_EXAMPLE = EXAMPLES[0].id;

export function findExample(id: string): Example {
  return EXAMPLES.find((example) => example.id === id) ?? EXAMPLES[0];
}
