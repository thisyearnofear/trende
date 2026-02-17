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
        ${theme === 'dark' ? 'border-white bg-[#0a0a0a] text-white hover:bg-white hover:text-black' : 
          theme === 'light' ? 'border-black bg-white text-black hover:bg-black hover:text-white' :
          'soft-ui-button border-transparent text-[#444]'}
      `}
      style={{ 
        boxShadow: theme === 'dark' ? '2px 2px 0px 0px #fff' : 
                   theme === 'light' ? '2px 2px 0px 0px #000' : 'var(--soft-shadow-out)',
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
        ${theme === 'dark' ? 'border-white bg-[#0a0a0a] text-white' : 
          theme === 'light' ? 'border-black bg-white text-black' :
          'soft-ui-button border-transparent text-[#444]'}
      `}
      style={{ 
        boxShadow: theme === 'dark' ? '2px 2px 0px 0px #fff' : 
                   theme === 'light' ? '2px 2px 0px 0px #000' : 'var(--soft-shadow-out)',
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
