'use client';

/**
 * UNIFIED DESIGN SYSTEM FOR TRENDE
 * 
 * This is the single source of truth for all UI components.
 * It supports:
 * - Neobrutalism aesthetic (bold borders, hard shadows)
 * - Dark/Light theme modes
 * - Accessible, consistent component API
 * 
 * PRINCIPLES:
 * 1. One component = one file = one responsibility
 * 2. CSS variables for theming (no prop drilling colors)
 * 3. Hard shadows, sharp corners (neobrutalism)
 * 4. 44px minimum touch targets
 * 5. Uppercase, mono font for labels
 */

import { ReactNode, useState, CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTheme } from './ThemeProvider';

// ============================================
// DESIGN TOKENS (CSS Variables)
// ============================================
// These are defined in globals.css and switch between dark/light
// --bg-primary, --text-primary, --accent-cyan, etc.

// ============================================
// CARD
// ============================================
interface CardProps {
  children: ReactNode;
  className?: string;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet' | 'white';
  shadow?: 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
  style?: CSSProperties;
}

export function Card({ 
  children, 
  className,
  accent = 'white',
  shadow = 'md',
  interactive = false,
  style,
}: CardProps) {
  const [isPressed, setIsPressed] = useState(false);
  const { isSoft } = useTheme();
  
  const accentBorder = {
    cyan: 'border-[var(--accent-cyan)]',
    emerald: 'border-[var(--accent-emerald)]',
    amber: 'border-[var(--accent-amber)]',
    rose: 'border-[var(--accent-rose)]',
    violet: 'border-[var(--accent-violet)]',
    white: 'border-[var(--border-color)]',
  };
  
  const shadowSize = {
    sm: '2px',
    md: '4px',
    lg: '6px',
    xl: '8px',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'bg-[var(--bg-secondary)] border-2 transition-all duration-100',
        !isSoft && accentBorder[accent],
        isSoft ? 'soft-ui-out border-0' : 'rounded-none',
        interactive && 'cursor-pointer',
        className
      )}
      style={{
        boxShadow: isSoft 
          ? (isPressed && interactive ? 'var(--soft-shadow-in)' : 'var(--soft-shadow-out)')
          : (isPressed && interactive 
              ? 'none' 
              : `${shadowSize[shadow]} ${shadowSize[shadow]} 0px 0px var(--shadow-color)`),
        transform: !isSoft && isPressed && interactive ? `translate(${shadowSize[shadow]}, ${shadowSize[shadow]})` : undefined,
        ...style,
      }}
      onMouseDown={() => interactive && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      whileHover={interactive ? { scale: 1.01 } : undefined}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// BUTTON
// ============================================
interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
}: ButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const { isSoft } = useTheme();
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
  };
  
  const variantClasses = {
    primary: 'bg-[var(--accent-cyan)] text-[var(--bg-primary)] border-[var(--border-color)]',
    secondary: 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-color)]',
    accent: 'bg-[var(--accent-emerald)] text-[var(--bg-primary)] border-[var(--border-color)]',
    danger: 'bg-[var(--accent-rose)] text-[var(--bg-primary)] border-[var(--border-color)]',
    ghost: 'bg-transparent text-[var(--text-primary)] border-[var(--text-muted)]',
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'border-2 font-black uppercase tracking-wider transition-all duration-100',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        !isSoft && 'hover:-translate-x-0.5 hover:-translate-y-0.5',
        isSoft ? 'soft-ui-button border-0' : 'rounded-none',
        'min-h-[44px]',
        sizeClasses[size],
        !isSoft && variantClasses[variant],
        isSoft && variant === 'ghost' && 'bg-transparent shadow-none border-0',
        className
      )}
      style={{
        boxShadow: isSoft 
          ? (isPressed ? 'var(--soft-shadow-in)' : 'var(--soft-shadow-out)')
          : (isPressed ? 'none' : '4px 4px 0px 0px var(--shadow-color)'),
        transform: !isSoft && isPressed ? 'translate(4px, 4px)' : undefined,
        backgroundColor: isSoft && variant !== 'ghost' ? 'var(--soft-bg)' : undefined,
        color: isSoft ? 'var(--text-primary)' : undefined,
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.button>
  );
}

// ============================================
// INPUT
// ============================================
interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
  label?: string;
}

export function Input({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  rows = 1,
  label,
}: InputProps) {
  const InputComponent = rows > 1 ? 'textarea' : 'input';
  const { isSoft } = useTheme();
  
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">
          {label}
        </label>
      )}
      <InputComponent
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows > 1 ? rows : undefined}
        className={cn(
          'w-full bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)]',
          'border-2 border-[var(--border-color)] p-4 font-mono text-sm',
          !isSoft && 'focus:border-[var(--accent-cyan)]',
          isSoft ? 'soft-ui-in border-0' : 'rounded-none focus:outline-none',
          'disabled:opacity-50',
          'min-h-[44px]'
        )}
        style={{ boxShadow: isSoft ? 'var(--soft-shadow-in)' : '4px 4px 0px 0px var(--shadow-color)' }}
      />
    </div>
  );
}

// ============================================
// BADGE
// ============================================
interface BadgeProps {
  children: ReactNode;
  variant?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet' | 'default';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const { isSoft } = useTheme();
  const variantClasses = {
    cyan: 'bg-[var(--accent-cyan)] text-[var(--bg-primary)]',
    emerald: 'bg-[var(--accent-emerald)] text-[var(--bg-primary)]',
    amber: 'bg-[var(--accent-amber)] text-[var(--bg-primary)]',
    rose: 'bg-[var(--accent-rose)] text-[var(--bg-primary)]',
    violet: 'bg-[var(--accent-violet)] text-[var(--bg-primary)]',
    default: 'bg-[var(--bg-secondary)] text-[var(--text-primary)]',
  };
  
  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'inline-flex items-center px-2 py-1 text-xs font-black uppercase tracking-wider border-2',
        !isSoft && 'border-[var(--border-color)]',
        isSoft ? 'soft-ui-out border-0 rounded-lg' : 'rounded-none',
        variantClasses[variant],
        className
      )}
      style={{ boxShadow: isSoft ? 'var(--soft-shadow-out)' : '2px 2px 0px 0px var(--shadow-color)' }}
    >
      {children}
    </motion.span>
  );
}

// ============================================
// STAT
// ============================================
interface StatProps {
  value: string | number;
  label: string;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
}

export function Stat({ value, label, accent = 'cyan' }: StatProps) {
  const accentColor = {
    cyan: 'var(--accent-cyan)',
    emerald: 'var(--accent-emerald)',
    amber: 'var(--accent-amber)',
    rose: 'var(--accent-rose)',
    violet: 'var(--accent-violet)',
  }[accent];

  return (
    <Card accent={accent} shadow="md" className="p-4">
      <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-1">{label}</p>
      <p className="text-3xl font-black text-[var(--text-primary)] tabular-nums" style={{ color: accentColor }}>
        {value}
      </p>
    </Card>
  );
}

// ============================================
// PROGRESS
// ============================================
interface ProgressProps {
  value: number;
  max?: number;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
  className?: string;
}

export function Progress({ value, max = 100, accent = 'cyan', className }: ProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const { isSoft } = useTheme();
  
  const accentColor = {
    cyan: 'var(--accent-cyan)',
    emerald: 'var(--accent-emerald)',
    amber: 'var(--accent-amber)',
    rose: 'var(--accent-rose)',
    violet: 'var(--accent-violet)',
  }[accent];

  return (
    <div
      className={cn(
        'w-full h-6 bg-[var(--bg-primary)] border-2',
        !isSoft && 'border-[var(--border-color)]',
        isSoft ? 'soft-ui-in border-0 rounded-full' : 'rounded-none',
        className
      )}
      style={{ boxShadow: isSoft ? 'var(--soft-shadow-in)' : '2px 2px 0px 0px var(--shadow-color)' }}
    >
      <div
        className={cn(
          'h-full transition-all duration-300',
          !isSoft && 'border-r-2 border-[var(--border-color)]',
          isSoft ? 'rounded-full' : ''
        )}
        style={{ width: `${percentage}%`, backgroundColor: accentColor }}
      />
    </div>
  );
}

// ============================================
// SECTION
// ============================================
interface SectionProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
  className?: string;
}

export function Section({ 
  children, 
  title, 
  subtitle,
  accent = 'cyan',
  className 
}: SectionProps) {
  return (
    <Card accent={accent} shadow="lg" className={className}>
      {(title || subtitle) && (
        <div className="border-b-2 border-[var(--border-color)] p-4 bg-[var(--bg-primary)]">
          {title && (
            <h2 className="text-lg font-black uppercase tracking-wider text-[var(--text-primary)]">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-sm font-mono text-[var(--text-muted)] mt-1">{subtitle}</p>
          )}
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </Card>
  );
}

// ============================================
// ICON BUTTON
// ============================================
interface IconButtonProps {
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
  ariaLabel: string;
}

export function IconButton({ 
  icon, 
  onClick, 
  disabled, 
  label,
  ariaLabel 
}: IconButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const { isSoft } = useTheme();
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'flex items-center gap-2 p-2.5 min-h-[44px] min-w-[44px] transition-all',
        !isSoft && 'border-2 border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]',
        !isSoft && 'hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)]',
        isSoft ? 'soft-ui-button border-0 rounded-xl' : 'rounded-none',
        'disabled:opacity-30',
        label && 'px-4'
      )}
      style={{
        boxShadow: isSoft 
          ? (isPressed ? 'var(--soft-shadow-in)' : 'var(--soft-shadow-out)')
          : (isPressed ? 'none' : '2px 2px 0px 0px var(--shadow-color)'),
        transform: !isSoft && isPressed ? 'translate(2px, 2px)' : undefined,
        backgroundColor: isSoft ? 'var(--soft-bg)' : undefined,
        color: isSoft ? 'var(--text-primary)' : undefined,
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {icon}
      {label && (
        <span className="text-xs font-black uppercase tracking-wider">{label}</span>
      )}
    </button>
  );
}

// ============================================
// TOGGLE
// ============================================
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  const { isSoft } = useTheme();
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 group"
    >
      <div
        className={cn(
          "relative w-14 h-7 transition-all duration-200 bg-[var(--bg-primary)]",
          !isSoft && "border-2 border-[var(--border-color)]",
          isSoft ? "soft-ui-in border-0 rounded-full" : "rounded-none"
        )}
        style={{ boxShadow: isSoft ? "var(--soft-shadow-in)" : "2px 2px 0px 0px var(--shadow-color)" }}
      >
        <div
          className={cn(
            'absolute top-0.5 w-5 h-5 transition-all duration-200',
            !isSoft && 'border-2 border-[var(--border-color)] bg-[var(--bg-secondary)]',
            isSoft ? 'rounded-full' : 'rounded-none',
            checked ? (isSoft ? 'left-8 bg-[var(--accent-cyan)]' : 'left-7 bg-[var(--accent-cyan)]') : 'left-0.5'
          )}
          style={{ 
            boxShadow: isSoft && !checked ? 'var(--soft-shadow-out)' : undefined,
            backgroundColor: isSoft && !checked ? 'var(--soft-bg)' : undefined
          }}
        />
      </div>
      {label && (
        <span className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
          {label}
        </span>
      )}
    </button>
  );
}

// ============================================
// ALERT
// ============================================
interface AlertProps {
  children: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'error';
  className?: string;
}

export function Alert({ children, variant = 'info', className }: AlertProps) {
  const variantStyles = {
    info: { bg: 'rgba(0, 255, 255, 0.1)', border: 'var(--accent-cyan)' },
    success: { bg: 'rgba(0, 255, 136, 0.1)', border: 'var(--accent-emerald)' },
    warning: { bg: 'rgba(255, 170, 0, 0.1)', border: 'var(--accent-amber)' },
    error: { bg: 'rgba(255, 68, 68, 0.1)', border: 'var(--accent-rose)' },
  };
  
  const style = variantStyles[variant];

  return (
    <div
      className={cn('border-2 p-4 font-mono text-sm', className)}
      style={{ 
        backgroundColor: style.bg, 
        borderColor: style.border,
        boxShadow: '4px 4px 0px 0px var(--shadow-color)',
      }}
    >
      {children}
    </div>
  );
}
