'use client';

import { createContext, useContext, useCallback, useState, useEffect, ReactNode } from 'react';
import { X, Command, CornerDownLeft, Slash, HelpCircle, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Shortcut {
  key: string;
  modifier?: 'cmd' | 'ctrl' | 'alt' | 'shift';
  description: string;
  scope?: string;
}

const defaultShortcuts: Shortcut[] = [
  { key: 'Enter', modifier: 'cmd', description: 'Submit analysis query', scope: 'Global' },
  { key: 'k', modifier: 'cmd', description: 'Focus search input', scope: 'Global' },
  { key: '?', description: 'Show keyboard shortcuts', scope: 'Global' },
  { key: 'Escape', description: 'Close modals / Cancel', scope: 'Global' },
  { key: 'r', modifier: 'cmd', description: 'Refresh results', scope: 'Results' },
  { key: 'h', modifier: 'cmd', description: 'Toggle history panel', scope: 'Global' },
  { key: 'ArrowUp', description: 'Previous history item', scope: 'History' },
  { key: 'ArrowDown', description: 'Next history item', scope: 'History' },
];

interface KeyboardShortcutsContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  registerShortcut: (shortcut: Shortcut) => void;
  unregisterShortcut: (key: string, modifier?: string) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(null);

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within a KeyboardShortcutsProvider');
  }
  return context;
}

// Hook for individual components to handle keyboard shortcuts
interface UseShortcutOptions {
  key: string;
  modifier?: 'cmd' | 'ctrl' | 'alt' | 'shift';
  handler: (e: KeyboardEvent) => void;
  enabled?: boolean;
  preventDefault?: boolean;
}

export function useShortcut({
  key,
  modifier,
  handler,
  enabled = true,
  preventDefault = true,
}: UseShortcutOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMatch = e.key.toLowerCase() === key.toLowerCase();
      
      let modifierMatch = true;
      if (modifier) {
        switch (modifier) {
          case 'cmd':
            modifierMatch = e.metaKey;
            break;
          case 'ctrl':
            modifierMatch = e.ctrlKey;
            break;
          case 'alt':
            modifierMatch = e.altKey;
            break;
          case 'shift':
            modifierMatch = e.shiftKey;
            break;
        }
      } else {
        // If no modifier specified, ensure no modifiers are pressed
        modifierMatch = !e.metaKey && !e.ctrlKey && !e.altKey;
      }

      if (keyMatch && modifierMatch) {
        if (preventDefault) {
          e.preventDefault();
        }
        handler(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, modifier, handler, enabled, preventDefault]);
}

// Key badge component
function KeyBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-mono font-medium rounded-md border bg-slate-800 border-slate-700 text-slate-300 shadow-sm ${className}`}
    >
      {children}
    </kbd>
  );
}

// Format shortcut for display
function formatShortcut(shortcut: Shortcut) {
  const modifierSymbols: Record<string, string> = {
    cmd: '⌘',
    ctrl: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
  };

  const keySymbols: Record<string, ReactNode> = {
    Enter: <CornerDownLeft className="w-3 h-3" />,
    ArrowUp: <ArrowUp className="w-3 h-3" />,
    ArrowDown: <ArrowUp className="w-3 h-3 rotate-180" />,
    Escape: 'Esc',
    '?': <HelpCircle className="w-3 h-3" />,
  };

  return (
    <div className="flex items-center gap-1">
      {shortcut.modifier && (
        <>
          <KeyBadge>{modifierSymbols[shortcut.modifier]}</KeyBadge>
          <span className="text-slate-600">+</span>
        </>
      )}
      <KeyBadge>{keySymbols[shortcut.key] || shortcut.key}</KeyBadge>
    </div>
  );
}

// Help modal component
function ShortcutsModal({
  isOpen,
  onClose,
  shortcuts,
}: {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
}) {
  // Close on escape
  useShortcut({ key: 'Escape', handler: onClose, enabled: isOpen });

  // Group shortcuts by scope
  const grouped = shortcuts.reduce((acc, shortcut) => {
    const scope = shortcut.scope || 'Global';
    if (!acc[scope]) acc[scope] = [];
    acc[scope].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50"
          >
            <div className="rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Command className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">Keyboard Shortcuts</h2>
                    <p className="text-xs text-slate-500">Work faster with these shortcuts</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 max-h-[60vh] overflow-y-auto">
                {Object.entries(grouped).map(([scope, scopeShortcuts]) => (
                  <div key={scope} className="mb-6 last:mb-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      {scope}
                    </h3>
                    <div className="space-y-2">
                      {scopeShortcuts.map((shortcut, index) => (
                        <div
                          key={`${shortcut.key}-${shortcut.modifier || 'none'}-${index}`}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800/50 transition-colors"
                        >
                          <span className="text-sm text-slate-300">{shortcut.description}</span>
                          {formatShortcut(shortcut)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer hint */}
              <div className="px-5 py-3 bg-slate-950/50 border-t border-slate-800">
                <p className="text-xs text-slate-500 text-center">
                  Press <KeyBadge>?</KeyBadge> anytime to show this help
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Provider component
export function KeyboardShortcutsProvider({
  children,
  initialShortcuts = defaultShortcuts,
}: {
  children: ReactNode;
  initialShortcuts?: Shortcut[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(initialShortcuts);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const registerShortcut = useCallback((shortcut: Shortcut) => {
    setShortcuts((prev) => {
      // Remove any existing shortcut with same key+modifier
      const filtered = prev.filter(
        (s) => !(s.key === shortcut.key && s.modifier === shortcut.modifier)
      );
      return [...filtered, shortcut];
    });
  }, []);

  const unregisterShortcut = useCallback((key: string, modifier?: string) => {
    setShortcuts((prev) =>
      prev.filter((s) => !(s.key === key && s.modifier === modifier))
    );
  }, []);

  // Global ? shortcut to open help
  useShortcut({
    key: '?',
    handler: toggle,
    enabled: true,
    preventDefault: true,
  });

  return (
    <KeyboardShortcutsContext.Provider
      value={{ isOpen, open, close, toggle, registerShortcut, unregisterShortcut }}
    >
      {children}
      <ShortcutsModal isOpen={isOpen} onClose={close} shortcuts={shortcuts} />
    </KeyboardShortcutsContext.Provider>
  );
}

// Floating hint button (optional, shows in corner)
export function KeyboardShortcutsHint() {
  const { toggle } = useKeyboardShortcuts();

  return (
    <button
      onClick={toggle}
      className="fixed bottom-4 right-4 p-2 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-all opacity-50 hover:opacity-100 z-40"
      title="Keyboard shortcuts (?)"
      aria-label="Show keyboard shortcuts"
    >
      <Slash className="w-4 h-4" />
    </button>
  );
}
