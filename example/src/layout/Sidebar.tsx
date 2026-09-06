import { EXAMPLES } from '../examples/registry';
import { navigate } from '../router';

export function Sidebar({
  current,
  open,
  onNavigate,
}: {
  current: string;
  /** Controls the slide-in drawer below `lg`. */
  open: boolean;
  onNavigate: () => void;
}) {
  return (
    <>
      {/* Scrim, mobile only. */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onNavigate}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <nav
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white transition-transform duration-200 dark:border-gray-800 dark:bg-gray-900 lg:static lg:z-auto lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-gray-200 px-4 py-3 lg:hidden dark:border-gray-800">
          <span className="text-sm font-semibold">Examples</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <h2 className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Examples
          </h2>
          <ul className="flex flex-col gap-0.5">
            {EXAMPLES.map((example) => {
              const active = example.id === current;
              const Icon = example.icon;
              return (
                <li key={example.id}>
                  <a
                    href={`#/${example.id}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(example.id);
                      onNavigate();
                    }}
                    className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className={`mt-0.5 text-base ${active ? '' : 'text-gray-400 dark:text-gray-500'}`}>
                      <Icon />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium leading-tight">
                        {example.title}
                      </span>
                      <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                        {example.blurb}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-gray-200 p-3 text-[11px] leading-relaxed text-gray-500 dark:border-gray-800 dark:text-gray-400">
          Data comes from the mock server in{' '}
          <code className="font-mono">server/</code> on port 5174.
        </div>
      </nav>
    </>
  );
}
