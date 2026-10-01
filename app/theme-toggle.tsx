'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const KEY = 'openmri-theme';

// The theme lives on <html data-theme>. Light is the default; the scan area
// stays black in both themes (elements marked `.mri-stage`).
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const current = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
function setTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark');
  listeners.forEach((listener) => listener());
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribe,
    current,
    () => 'light' as const,
  );
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === 'dark' && current() !== 'dark')
        setTheme('dark');
    } catch {
      /* Local storage is optional. */
    }
  }, []);
  const next: Theme = theme === 'light' ? 'dark' : 'light';
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={`Switch to the ${next} theme`}
      title={`Switch to the ${next} theme`}
      onClick={() => {
        setTheme(next);
        try {
          localStorage.setItem(KEY, next);
        } catch {
          /* Local storage is optional. */
        }
      }}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
