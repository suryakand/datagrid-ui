import { useEffect, useState } from 'react';
import { DocSections } from './docs/DocSections';
import { Showcase } from './docs/Showcase';
import { DEFAULT_EXAMPLE, findExample } from './examples/registry';
import { Header } from './layout/Header';
import { Sidebar } from './layout/Sidebar';
import { useHashRoute } from './router';
import { ThemeProvider } from './theme';

export function App() {
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}

function Shell() {
  const route = useHashRoute(DEFAULT_EXAMPLE);
  const example = findExample(route);
  const [navOpen, setNavOpen] = useState(false);

  // Keep the tab title in step with the visible example.
  useEffect(() => {
    document.title = `${example.title} — @helix-x/datagrid-ui`;
  }, [example.title]);

  const Example = example.Component;

  return (
    <div className="flex h-full flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Header onToggleNav={() => setNavOpen((open) => !open)} />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          current={example.id}
          open={navOpen}
          onNavigate={() => setNavOpen(false)}
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 p-4 lg:p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold">{example.title}</h1>
                {example.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-white/10 dark:text-gray-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {example.description}
              </p>
            </div>

            {/*
              `key` remounts on navigation so an example's streams, timers and
              grid state never leak into the next one.
            */}
            <Showcase
              key={example.id}
              preview={<Example />}
              files={example.source}
              height="clamp(420px, calc(100vh - 19rem), 900px)"
            />

            <DocSections
              key={`${example.id}-docs`}
              sections={example.docs}
              sourceDir={example.sourceDir}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
