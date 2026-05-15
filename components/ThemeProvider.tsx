'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'dim' | 'blue' | 'light';

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'dark', setTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('gf-theme') as Theme | null;
    const valid: Theme[] = ['dark', 'dim', 'blue', 'light'];
    if (saved && valid.includes(saved)) setThemeState(saved);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gf-theme', theme);
  }, [theme, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}
