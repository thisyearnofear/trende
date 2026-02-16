'use client';

import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

// Neobrutalism Design Tokens
// Bold, raw, high-contrast aesthetic
export const NEO_TOKENS = {
  // Colors - high contrast, bold
  background: '#fafafa',      // Off-white
  foreground: '#000000',      // Pure black
  border: '#000000',          // Thick black borders
  
  // Accent colors - bright, bold
  cyan: '#06b6d4',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  violet: '#8b5cf6',
  
  // Shadows - hard offset, no blur
  shadow: {
    sm: '2px 2px 0px 0px #000000',
    md: '4px 4px 0px 0px #000000',
    lg: '6px 6px 0px 0px #000000',
    xl: '8px 8px 0px 0px #000000',
  },
  
  // Pressed shadow (inset)
  shadowPressed: 'inset 2px 2px 0px 0px #000000',
  
  // Border width
  borderWidth: '2px',
  borderRadius: '0px', // Sharp corners
};

interface NeoBaseProps {
  children: ReactNode;
  className?: string;
}

// Neo Card - bold border, hard shadow
interface NeoCardProps extends NeoBaseProps {
  color?: 'white' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
  shadow?: 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
}

export function NeoCard({ 
  children, 
  className,
  color = 'white',
  shadow = 'md',
  interactive = false,
}: NeoCardProps) {
  const [isPressed, setIsPressed] = useState(false);
  
  const colorMap = {
    white: 'bg-white',
    cyan: 'bg-cyan-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    rose: 'bg-rose-400',
    violet: 'bg-violet-400',
  };
  
  const shadowMap = {
    sm: NEO_TOKENS.shadow.sm,
    md: NEO_TOKENS.shadow.md,
    lg: NEO_TOKENS.shadow.lg,
    xl: NEO_TOKENS.shadow.xl,
  };

  return (
    <div
      className={cn(
        'border-2 border-black transition-all duration-100',
        colorMap[color],
        interactive && 'cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5',
        isPressed && interactive && 'translate-x-0.5 translate-y-0.5',
        className
      )}
      style={{
        boxShadow: isPressed && interactive ? 'none' : shadowMap[shadow],
        transform: isPressed && interactive ? 'translate(4px, 4px)' : undefined,
      }}
      onMouseDown={() => interactive && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {children}
    </div>
  );
}

// Neo Button - bold, pressable
interface NeoButtonProps extends NeoBaseProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  shadow?: 'sm' | 'md' | 'lg';
}

export function NeoButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
  size = 'md',
  shadow = 'md',
  className,
}: NeoButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs font-bold',
    md: 'px-5 py-2.5 text-sm font-bold',
    lg: 'px-7 py-3.5 text-base font-bold',
  };
  
  const variantClasses = {
    primary: 'bg-cyan-400 text-black hover:bg-cyan-300',
    secondary: 'bg-white text-black hover:bg-gray-50',
    accent: 'bg-emerald-400 text-black hover:bg-emerald-300',
    danger: 'bg-rose-400 text-black hover:bg-rose-300',
  };
  
  const shadowMap = {
    sm: NEO_TOKENS.shadow.sm,
    md: NEO_TOKENS.shadow.md,
    lg: NEO_TOKENS.shadow.lg,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'border-2 border-black transition-all duration-100 uppercase tracking-wider',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'hover:-translate-x-0.5 hover:-translate-y-0.5',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      style={{
        boxShadow: isPressed ? 'none' : shadowMap[shadow],
        transform: isPressed ? 'translate(4px, 4px)' : undefined,
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {children}
    </button>
  );
}

// Neo Input - bold border, hard shadow
interface NeoInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
  label?: string;
}

export function NeoInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  rows = 4,
  label,
}: NeoInputProps) {
  const InputComponent = rows > 1 ? 'textarea' : 'input';
  
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-bold uppercase tracking-wider text-black mb-2">
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
          'w-full bg-white text-black placeholder-gray-500',
          'border-2 border-black p-3',
          'focus:outline-none focus:ring-0',
          'disabled:opacity-50',
          'font-mono text-sm'
        )}
        style={{
          boxShadow: NEO_TOKENS.shadow.sm,
        }}
      />
    </div>
  );
}

// Neo Badge - bold, colorful
interface NeoBadgeProps {
  children: ReactNode;
  color?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet' | 'white';
  className?: string;
}

export function NeoBadge({ children, color = 'white', className }: NeoBadgeProps) {
  const colorMap = {
    cyan: 'bg-cyan-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    rose: 'bg-rose-400',
    violet: 'bg-violet-400',
    white: 'bg-white',
  };
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase tracking-wider border-2 border-black',
        colorMap[color],
        className
      )}
      style={{ boxShadow: NEO_TOKENS.shadow.sm }}
    >
      {children}
    </span>
  );
}

// Neo Stat - bold numbers
interface NeoStatProps {
  value: string | number;
  label: string;
  color?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
}

export function NeoStat({ value, label, color = 'cyan' }: NeoStatProps) {
  const colorMap = {
    cyan: 'bg-cyan-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    rose: 'bg-rose-400',
    violet: 'bg-violet-400',
  };
  
  return (
    <NeoCard color={color} shadow="md" className="p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-black/70 mb-1">{label}</p>
      <p className="text-3xl font-black text-black tabular-nums">{value}</p>
    </NeoCard>
  );
}

// Neo Alert - bold messaging
interface NeoAlertProps {
  children: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'error';
  className?: string;
}

export function NeoAlert({ children, variant = 'info', className }: NeoAlertProps) {
  const variantMap = {
    info: 'bg-cyan-100 border-cyan-400',
    success: 'bg-emerald-100 border-emerald-400',
    warning: 'bg-amber-100 border-amber-400',
    error: 'bg-rose-100 border-rose-400',
  };
  
  return (
    <div
      className={cn(
        'border-2 p-4 font-medium',
        variantMap[variant],
        className
      )}
      style={{ boxShadow: NEO_TOKENS.shadow.md }}
    >
      {children}
    </div>
  );
}

// Neo Toggle - hard switch
interface NeoToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function NeoToggle({ checked, onChange, label }: NeoToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 group"
    >
      <div
        className={cn(
          'relative w-14 h-7 border-2 border-black transition-colors duration-200',
          checked ? 'bg-cyan-400' : 'bg-white'
        )}
        style={{ boxShadow: NEO_TOKENS.shadow.sm }}
      >
        {/* Toggle knob */}
        <div
          className={cn(
            'absolute top-0.5 w-5 h-5 border-2 border-black bg-white transition-all duration-200',
            checked ? 'left-7' : 'left-0.5'
          )}
          style={{
            boxShadow: checked ? 'none' : NEO_TOKENS.shadow.sm,
          }}
        />
      </div>
      {label && (
        <span className="text-sm font-bold uppercase tracking-wider text-black">
          {label}
        </span>
      )}
    </button>
  );
}

// Neo Progress - bold bar
interface NeoProgressProps {
  value: number;
  max?: number;
  color?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
  className?: string;
}

export function NeoProgress({ value, max = 100, color = 'cyan', className }: NeoProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const colorMap = {
    cyan: 'bg-cyan-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    rose: 'bg-rose-400',
    violet: 'bg-violet-400',
  };
  
  return (
    <div
      className={cn('w-full h-6 bg-white border-2 border-black', className)}
      style={{ boxShadow: NEO_TOKENS.shadow.sm }}
    >
      <div
        className={cn('h-full border-r-2 border-black transition-all duration-300', colorMap[color])}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// Neo Tag - small label
interface NeoTagProps {
  children: ReactNode;
  className?: string;
}

export function NeoTag({ children, className }: NeoTagProps) {
  return (
    <span
      className={cn(
        'inline-block px-2 py-0.5 text-xs font-bold border-2 border-black bg-white',
        className
      )}
      style={{ boxShadow: NEO_TOKENS.shadow.sm }}
    >
      {children}
    </span>
  );
}

// Neo Section - bold container with title
interface NeoSectionProps extends NeoBaseProps {
  title?: string;
  subtitle?: string;
  color?: 'white' | 'cyan' | 'emerald' | 'amber';
}

export function NeoSection({ 
  children, 
  title, 
  subtitle,
  color = 'white',
  className 
}: NeoSectionProps) {
  return (
    <NeoCard color={color} shadow="lg" className={className}>
      {(title || subtitle) && (
        <div className="border-b-2 border-black p-4 bg-black/5">
          {title && (
            <h2 className="text-lg font-black uppercase tracking-wider text-black">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-sm font-medium text-black/70 mt-1">{subtitle}</p>
          )}
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </NeoCard>
  );
}

// Neo Icon Button - icon with bold styling
interface NeoIconButtonProps {
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  label?: string;
}

export function NeoIconButton({ 
  icon, 
  onClick, 
  disabled, 
  variant = 'secondary',
  label 
}: NeoIconButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  
  const variantClasses = {
    primary: 'bg-cyan-400 hover:bg-cyan-300',
    secondary: 'bg-white hover:bg-gray-50',
    danger: 'bg-rose-400 hover:bg-rose-300',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 px-3 py-2 border-2 border-black transition-all duration-100',
        'disabled:opacity-50',
        variantClasses[variant]
      )}
      style={{
        boxShadow: isPressed ? 'none' : NEO_TOKENS.shadow.sm,
        transform: isPressed ? 'translate(2px, 2px)' : undefined,
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {icon}
      {label && (
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      )}
    </button>
  );
}
