import { C, type DocSection } from '../docs/DocSections';

/**
 * The written half of each example. Kept beside the registry rather than
 * inside it so the registry stays a short table of contents.
 */

export const MARKET_DOCS: DocSection[] = [
  {
    title: 'The data source is a single function',
    body: (
      <>
        <p>
          The grid never decides what a page, a sort or a filter <em>means</em> —
          it hands you a request and expects rows back. That request is
          structurally identical to ag-grid's server-side row model, so an
          endpoint written for that model works unchanged.
        </p>
        <p>
          Two details matter. The <C>AbortSignal</C> must be passed through to{' '}
          <C>fetch</C>: it is what lets the grid cancel a slow response for a
          sort the user has already changed, so a stale page can never overwrite
          a fresh one. And <C>lastRow</C> is the total across <em>all</em> pages,
          not the length of this slice — it is what drives the pager.
        </p>
        <p>
          Memoising on <C>[]</C> keeps local component state from triggering a
          refetch every time it changes.
        </p>
      </>
    ),
    snippet: { file: 'src/examples/market/MarketExample.tsx', region: 'data-source' },
  },
  {
    title: 'A set filter that loads its own options',
    body: (
      <>
        <p>
          <C>filterParams.values</C> takes either a static array or a function
          returning a promise. Given a function, the filter popover calls it the
          first time it opens and shows a loading state until it resolves — so
          the list of sectors lives on the server, where it belongs, instead of
          being duplicated in the client.
        </p>
        <p>
          The column still declares <C>filter: 'set'</C>; nothing else about it
          changes.
        </p>
      </>
    ),
    snippet: { file: 'src/examples/market/columns.tsx', region: 'set-filter-async' },
  },
  {
    title: 'Editing, with the server holding the rules',
    body: (
      <>
        <p>
          <C>onRowCommit</C> is called with the edited draft and decides the
          outcome. Returning <C>{'{ ok: true }'}</C> closes the row; returning{' '}
          <C>{'{ ok: false, errors }'}</C> keeps it open and paints each message
          onto the cell whose column id it is keyed by.
        </p>
        <p>
          That means validation does not have to be mirrored in the client. Here
          the API rejects a note containing <C>TODO</C> with a 422, the fetch
          wrapper turns that into a <C>ValidationError</C>, and the errors map
          goes straight back to the grid.
        </p>
      </>
    ),
    snippet: { file: 'src/examples/market/MarketExample.tsx', region: 'row-commit' },
  },
  {
    title: 'Built-in editors',
    body: (
      <>
        <p>
          <C>editor</C> accepts one of five built-ins — <C>text</C>,{' '}
          <C>number</C>, <C>select</C>, <C>date</C>, <C>checkbox</C> — or your
          own component. A <C>select</C> takes its choices from{' '}
          <C>editorParams.options</C>.
        </p>
        <p>
          <C>editable</C> can also be a predicate over the row, if only some
          rows should be editable.
        </p>
      </>
    ),
    snippet: { file: 'src/examples/market/columns.tsx', region: 'editable-select' },
  },
];

export const PORTFOLIO_DOCS: DocSection[] = [
  {
    title: 'An image that cannot shift the row',
    body: (
      <>
        <p>
          Rows are a fixed height and absolutely positioned — that is what makes
          virtualization cheap. An image that arrives without a reserved box
          would reflow its cell mid-scroll, so every logo gets an explicit width
          and height in <em>both</em> the attributes and the style, before it has
          loaded anything.
        </p>
        <p>
          <C>loading="lazy"</C> matters more here than on an ordinary page:
          without it, scrolling a few hundred rows fires a few hundred requests
          at once. <C>decoding="async"</C> keeps decode work off the scroll path,
          and <C>onError</C> swaps in initials so one bad URL cannot leave a hole
          in the column.
        </p>
      </>
    ),
    snippet: { file: 'src/examples/portfolio/CompanyLogo.tsx', region: 'logo-img' },
  },
  {
    title: 'A composite cell that still sorts on the server',
    body: (
      <>
        <p>
          A <C>cellRenderer</C> changes only what is <em>drawn</em>. The column
          keeps <C>field: 'name'</C>, so sorting and filtering still send{' '}
          <C>name</C> to the server and behave exactly as they would for a plain
          text column — even though the cell paints a logo and two lines of text.
        </p>
        <p>
          Because the rendered cell is markup, <C>exportValue</C> supplies the
          flat string that CSV and clipboard copies should use instead.
        </p>
      </>
    ),
    snippet: { file: 'src/examples/portfolio/columns.tsx', region: 'identity-cell' },
  },
];

export const LIVE_DOCS: DocSection[] = [
  {
    title: 'Patching rows in place, never refetching',
    body: (
      <>
        <p>
          The feed hands us whole rows. <C>api.updateRows()</C> matches them
          against the rows currently loaded, by the same <C>getRowId</C> the grid
          uses everywhere else, and replaces the ones it finds.
        </p>
        <p>
          Nothing else moves: no request is made, the page is not re-sorted,
          and scroll position, selection and any open editor survive untouched.
          Symbols that are not on the current page are simply ignored, so the
          stream can be a firehose without the client filtering it first.
        </p>
      </>
    ),
    snippet: { file: 'src/examples/live/LiveExample.tsx', region: 'sse-subscribe' },
  },
  {
    title: 'Flashing a cell without rebuilding a column',
    body: (
      <>
        <p>
          Column definitions should be module constants. Anything that changes
          several times a second — like which symbols just repriced — belongs in{' '}
          <C>context</C>, which is passed to every renderer and can be swapped
          freely.
        </p>
        <p>
          So the flash map lives in <C>context</C>, the price renderer reads{' '}
          <C>context.flash[row.symbol]</C>, and a tick repaints cells without a
          single column definition being rebuilt. Had the direction been baked
          into the column instead, every tick would rebuild all of them.
        </p>
      </>
    ),
    snippet: { file: 'src/examples/live/columns.tsx', region: 'flash-cell' },
  },
];

export const THEMING_DOCS: DocSection[] = [
  {
    title: 'Why this works at all',
    body: (
      <>
        <p>
          Tailwind v4 does not inline colour values into utilities. A{' '}
          <C>@theme</C> block declares custom properties, and every utility that
          uses one compiles to a reference:{' '}
          <C>{'.bg-brand-500 { background-color: var(--color-brand-500) }'}</C>.
        </p>
        <p>
          The grid renders those utilities and nothing else — it has no theme
          prop and no style API. So overriding the variables is not a workaround;
          it is the supported surface.
        </p>
      </>
    ),
    snippet: { file: 'src/index.css', region: 'theme-tokens' },
  },
  {
    title: 'Re-theming at runtime is six assignments',
    body: (
      <>
        <p>
          Setting those same properties on <C>document.documentElement</C>{' '}
          overrides the <C>:root</C> values from the stylesheet. Every element
          using them repaints on the next frame — the grid's selection
          highlight, pager, focus rings, filter chrome and the toolbar.
        </p>
        <p>
          No rebuild, no re-render, and the grid is not even aware it happened.
        </p>
      </>
    ),
    snippet: { file: 'src/theme.tsx', region: 'apply-accent' },
  },
  {
    title: 'The same trick for corners',
    body: (
      <>
        <p>
          Tailwind's radius scale is variable-driven too, so writing{' '}
          <C>--radius-lg</C> reshapes every <C>rounded-lg</C> in the grid: its
          outer frame, the filter popovers, the columns panel and the toolbar
          buttons.
        </p>
        <p>
          The limit is worth knowing — bare <C>rounded</C> and{' '}
          <C>rounded-full</C> compile to literal values and do not follow.
        </p>
      </>
    ),
    snippet: { file: 'src/theme.tsx', region: 'apply-radius' },
  },
  {
    title: 'One line of setup you cannot skip',
    body: (
      <>
        <p>
          Tailwind only emits classes it can see, and it skips{' '}
          <C>node_modules</C> during automatic content detection. The grid's
          classes live in its shipped bundle, so that path has to be named
          explicitly with <C>@source</C>.
        </p>
        <p>
          Leave it out and the grid renders completely unstyled — the single
          most common setup mistake. On Tailwind v3, add the same path to{' '}
          <C>content</C> in <C>tailwind.config.js</C>.
        </p>
        <p>
          v3 has a second step. Row backgrounds are opaque colours mixed at
          runtime from <C>--color-white</C>, <C>--color-gray-50</C>,{' '}
          <C>--color-gray-900</C> and <C>--color-brand-500</C>, which v4 emits
          and v3 does not. Define those four on <C>:root</C> — with{' '}
          <C>theme(colors.gray.50)</C> and so on — or the rows render without a
          background.
        </p>
      </>
    ),
    snippet: { file: 'src/index.css', region: 'tailwind-source' },
  },
];
