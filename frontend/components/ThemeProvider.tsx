'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'soft';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isSoft: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'soft' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    // Use requestAnimationFrame to avoid synchronous setState warning
    requestAnimationFrame(() => {
      setMounted(true);
    });

    const stored = localStorage.getItem('trende-theme') as Theme | null;
    if (stored) {
      requestAnimationFrame(() => {
        setThemeState(stored);
      });
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      requestAnimationFrame(() => {
        setThemeState('light');
      });
    }
  }, []);

  // Apply theme class to document
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    root.classList.remove('dark', 'light', 'soft');
    root.classList.add(theme);

    console.log('[ThemeProvider] Applied theme:', theme);
    localStorage.setItem('trende-theme', theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setThemeState((prev) => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'soft';
      return 'dark';
    });
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const isSoft = theme === 'soft';

  // Prevent flash of wrong theme
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isSoft }}>
      {children}
    </ThemeContext.Provider>
  );
}
