'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="
        relative p-2.5 min-h-[44px] min-w-[44px] 
        border-2 transition-all duration-200
        flex items-center justify-center
        dark:border-white dark:bg-[#0a0a0a] dark:text-white dark:hover:bg-white dark:hover:text-black
        light:border-black light:bg-white light:text-black light:hover:bg-black light:hover:text-white
      "
      style={{ 
        boxShadow: theme === 'dark' ? '2px 2px 0px 0px #fff' : '2px 2px 0px 0px #000',
      }}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}

// Compact version for smaller spaces
export function ThemeToggleCompact() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="
        relative p-2 min-h-[40px] min-w-[40px]
        border-2 transition-all duration-200
        flex items-center justify-center
        dark:border-white dark:bg-[#0a0a0a] dark:text-white
        light:border-black light:bg-white light:text-black
      "
      style={{ 
        boxShadow: theme === 'dark' ? '2px 2px 0px 0px #fff' : '2px 2px 0px 0px #000',
      }}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
