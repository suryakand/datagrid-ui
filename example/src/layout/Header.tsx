import { useTheme } from '../theme';
import { IconGithub, IconMenu, IconMoon, IconSun } from './icons';

const REPO = 'https://github.com/suryakand/datagrid-ui';

export function Header({ onToggleNav }: { onToggleNav: () => void }) {
  const { mode, toggleMode } = useTheme();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900">
      <button
        type="button"
        onClick={onToggleNav}
        aria-label="Toggle navigation"
        className="-ml-1 rounded-lg p-1.5 text-lg text-gray-600 hover:bg-gray-100 lg:hidden dark:text-gray-300 dark:hover:bg-white/5"
      >
        <IconMenu />
      </button>

      <a href="#/" className="flex items-center gap-2.5 no-underline">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-500 text-[13px] font-bold text-white">
          hx
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
            datagrid-ui
          </span>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">
            Examples
          </span>
        </span>
      </a>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={toggleMode}
          aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
          className="rounded-lg p-2 text-base text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
        >
          {mode === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <a
          href={REPO}
          target="_blank"
          rel="noreferrer"
          aria-label="Source on GitHub"
          title="Source on GitHub"
          className="rounded-lg p-2 text-base text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
        >
          <IconGithub />
        </a>
      </div>
    </header>
  );
}
