import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';

const KEY = 'folium:theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function apply(pref: ThemePref): boolean {
  const dark = pref === 'dark' || (pref === 'system' && media.matches);
  document.documentElement.classList.toggle('dark', dark);
  return dark;
}

interface ThemeValue {
  pref: ThemePref;
  isDark: boolean;
  setPref: (pref: ThemePref) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<ThemePref>(
    () => (localStorage.getItem(KEY) as ThemePref | null) ?? 'system',
  );
  const [isDark, setIsDark] = useState(() => apply(pref));

  useEffect(() => {
    setIsDark(apply(pref));
    localStorage.setItem(KEY, pref);
    if (pref !== 'system') return;
    const onChange = () => setIsDark(apply('system'));
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [pref]);

  const value: ThemeValue = {
    pref,
    isDark,
    setPref,
    toggle: () => setPref(isDark ? 'light' : 'dark'),
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
