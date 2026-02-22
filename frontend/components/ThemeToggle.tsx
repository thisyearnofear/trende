'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon, Sparkles } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative p-2.5 min-h-[44px] min-w-[44px] 
        border-2 transition-all duration-200
        flex items-center justify-center
        ${theme === 'dark' ? 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)]' : 
          theme === 'light' ? 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)]' :
          'soft-ui-button border-transparent text-[var(--text-primary)]'}
      `}
      style={{ 
        boxShadow: theme === 'dark' ? '2px 2px 0px 0px var(--shadow-color)' : 
                   theme === 'light' ? '2px 2px 0px 0px var(--shadow-color)' : 'var(--soft-shadow-out)',
      }}
      aria-label={theme === 'dark' ? 'Switch to light mode' : theme === 'light' ? 'Switch to soft mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : theme === 'light' ? (
        <Moon className="w-5 h-5" />
      ) : (
        <Sparkles className="w-5 h-5" />
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
      className={`
        relative p-2 min-h-[40px] min-w-[40px]
        border-2 transition-all duration-200
        flex items-center justify-center
        ${theme === 'dark' ? 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]' : 
          theme === 'light' ? 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]' :
          'soft-ui-button border-transparent text-[var(--text-primary)]'}
      `}
      style={{ 
        boxShadow: theme === 'dark' ? '2px 2px 0px 0px var(--shadow-color)' : 
                   theme === 'light' ? '2px 2px 0px 0px var(--shadow-color)' : 'var(--soft-shadow-out)',
      }}
      aria-label={theme === 'dark' ? 'Switch to light mode' : theme === 'light' ? 'Switch to soft mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4" />
      ) : theme === 'light' ? (
        <Moon className="w-4 h-4" />
      ) : (
        <Sparkles className="w-4 h-4" />
      )}
    </button>
  );
}
