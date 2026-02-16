'use client';

import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

// Dark Neobrutalism - for Trende's dark theme
// Bold borders + high contrast + hard shadows on dark bg
export const NEO_DARK_TOKENS = {
  background: '#0a0a0a',      // Near black
  surface: '#141414',         // Slightly lighter
  foreground: '#ffffff',      // Pure white text
  border: '#ffffff',          // White borders (high contrast)
  
  // Accent colors - neon, bright
  cyan: '#00ffff',
  emerald: '#00ff88',
  amber: '#ffaa00',
  rose: '#ff4444',
  violet: '#aa66ff',
  
  // Shadows - colored glow for dark theme
  shadow: {
    cyan: '4px 4px 0px 0px #00ffff',
    emerald: '4px 4px 0px 0px #00ff88',
    amber: '4px 4px 0px 0px #ffaa00',
    rose: '4px 4px 0px 0px #ff4444',
    violet: '4px 4px 0px 0px #aa66ff',
    white: '4px 4px 0px 0px #ffffff',
  },
  
  // Glow effects for dark theme
  glow: {
    cyan: '0 0 20px rgba(0, 255, 255, 0.3)',
    emerald: '0 0 20px rgba(0, 255, 136, 0.3)',
    amber: '0 0 20px rgba(255, 170, 0, 0.3)',
    rose: '0 0 20px rgba(255, 68, 68, 0.3)',
  },
  
  borderWidth: '2px',
};

interface NeoDarkBaseProps {
  children: ReactNode;
  className?: string;
}

// NeoDark Card - for dark theme
interface NeoDarkCardProps extends NeoDarkBaseProps {
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet' | 'white';
  glow?: boolean;
  interactive?: boolean;
}

export function NeoDarkCard({ 
  children, 
  className,
  accent = 'white',
  glow = false,
  interactive = false,
}: NeoDarkCardProps) {
  const [isPressed, setIsPressed] = useState(false);
  
  const accentBorder = {
    cyan: 'border-cyan-400',
    emerald: 'border-emerald-400',
    amber: 'border-amber-400',
    rose: 'border-rose-400',
    violet: 'border-violet-400',
    white: 'border-white',
  };
  
  const shadowMap = {
    cyan: NEO_DARK_TOKENS.shadow.cyan,
    emerald: NEO_DARK_TOKENS.shadow.emerald,
    amber: NEO_DARK_TOKENS.shadow.amber,
    rose: NEO_DARK_TOKENS.shadow.rose,
    violet: NEO_DARK_TOKENS.shadow.violet,
    white: NEO_DARK_TOKENS.shadow.white,
  };

  return (
    <div
      className={cn(
        'bg-[#141414] border-2 transition-all duration-100',
        accentBorder[accent],
        interactive && 'cursor-pointer',
        className
      )}
      style={{
        boxShadow: isPressed && interactive ? 'none' : shadowMap[accent],
        transform: isPressed && interactive ? 'translate(4px, 4px)' : undefined,
        ...(glow && { 
          boxShadow: `${shadowMap[accent]}, ${NEO_DARK_TOKENS.glow[accent as keyof typeof NEO_DARK_TOKENS.glow] || ''}` 
        }),
      }}
      onMouseDown={() => interactive && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {children}
    </div>
  );
}

// NeoDark Button
interface NeoDarkButtonProps extends NeoDarkBaseProps {
  onClick?: () => void;
  disabled?: boolean;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'filled' | 'outline';
}

export function NeoDarkButton({
  children,
  onClick,
  disabled,
  accent = 'cyan',
  size = 'md',
  variant = 'filled',
  className,
}: NeoDarkButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  
  const sizeClasses = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  };
  
  const variantClasses = {
    filled: {
      cyan: 'bg-cyan-400 text-black hover:bg-cyan-300',
      emerald: 'bg-emerald-400 text-black hover:bg-emerald-300',
      amber: 'bg-amber-400 text-black hover:bg-amber-300',
      rose: 'bg-rose-400 text-black hover:bg-rose-300',
      violet: 'bg-violet-400 text-black hover:bg-violet-300',
    },
    outline: {
      cyan: 'bg-transparent text-cyan-400 border-cyan-400 hover:bg-cyan-400/10',
      emerald: 'bg-transparent text-emerald-400 border-emerald-400 hover:bg-emerald-400/10',
      amber: 'bg-transparent text-amber-400 border-amber-400 hover:bg-amber-400/10',
      rose: 'bg-transparent text-rose-400 border-rose-400 hover:bg-rose-400/10',
      violet: 'bg-transparent text-violet-400 border-violet-400 hover:bg-violet-400/10',
    },
  };
  
  const shadowMap = {
    cyan: NEO_DARK_TOKENS.shadow.cyan,
    emerald: NEO_DARK_TOKENS.shadow.emerald,
    amber: NEO_DARK_TOKENS.shadow.amber,
    rose: NEO_DARK_TOKENS.shadow.rose,
    violet: NEO_DARK_TOKENS.shadow.violet,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'border-2 transition-all duration-100 font-bold uppercase tracking-wider',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'hover:-translate-x-0.5 hover:-translate-y-0.5',
        sizeClasses[size],
        variantClasses[variant][accent],
        className
      )}
      style={{
        boxShadow: isPressed ? 'none' : shadowMap[accent],
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

// NeoDark Input
interface NeoDarkInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
  accent?: 'cyan' | 'emerald' | 'amber' | 'white';
}

export function NeoDarkInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  rows = 4,
  accent = 'cyan',
}: NeoDarkInputProps) {
  const InputComponent = rows > 1 ? 'textarea' : 'input';
  
  const accentClasses = {
    cyan: 'border-cyan-400 focus:border-cyan-300',
    emerald: 'border-emerald-400 focus:border-emerald-300',
    amber: 'border-amber-400 focus:border-amber-300',
    white: 'border-white focus:border-gray-300',
  };
  
  const shadowMap = {
    cyan: NEO_DARK_TOKENS.shadow.cyan,
    emerald: NEO_DARK_TOKENS.shadow.emerald,
    amber: NEO_DARK_TOKENS.shadow.amber,
    white: NEO_DARK_TOKENS.shadow.white,
  };
  
  return (
    <InputComponent
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows > 1 ? rows : undefined}
      className={cn(
        'w-full bg-[#0a0a0a] text-white placeholder-gray-600',
        'border-2 p-4 font-mono text-sm',
        'focus:outline-none transition-colors',
        'disabled:opacity-50',
        accentClasses[accent],
        className
      )}
      style={{
        boxShadow: shadowMap[accent],
      }}
    />
  );
}

// NeoDark Badge
interface NeoDarkBadgeProps {
  children: ReactNode;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
  className?: string;
}

export function NeoDarkBadge({ children, accent = 'cyan', className }: NeoDarkBadgeProps) {
  const accentClasses = {
    cyan: 'bg-cyan-400 text-black border-cyan-400',
    emerald: 'bg-emerald-400 text-black border-emerald-400',
    amber: 'bg-amber-400 text-black border-amber-400',
    rose: 'bg-rose-400 text-black border-rose-400',
    violet: 'bg-violet-400 text-black border-violet-400',
  };
  
  const shadowMap = {
    cyan: NEO_DARK_TOKENS.shadow.cyan,
    emerald: NEO_DARK_TOKENS.shadow.emerald,
    amber: NEO_DARK_TOKENS.shadow.amber,
    rose: NEO_DARK_TOKENS.shadow.rose,
    violet: NEO_DARK_TOKENS.shadow.violet,
  };
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 text-xs font-bold uppercase tracking-wider border-2',
        accentClasses[accent],
        className
      )}
      style={{ boxShadow: shadowMap[accent] }}
    >
      {children}
    </span>
  );
}

// NeoDark Stat
interface NeoDarkStatProps {
  value: string | number;
  label: string;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
}

export function NeoDarkStat({ value, label, accent = 'cyan' }: NeoDarkStatProps) {
  return (
    <NeoDarkCard accent={accent} className="p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-black text-white tabular-nums">{value}</p>
    </NeoDarkCard>
  );
}

// NeoDark Progress
interface NeoDarkProgressProps {
  value: number;
  max?: number;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
  className?: string;
}

export function NeoDarkProgress({ value, max = 100, accent = 'cyan', className }: NeoDarkProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const accentClasses = {
    cyan: 'bg-cyan-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    rose: 'bg-rose-400',
    violet: 'bg-violet-400',
  };
  
  const shadowMap = {
    cyan: NEO_DARK_TOKENS.shadow.cyan,
    emerald: NEO_DARK_TOKENS.shadow.emerald,
    amber: NEO_DARK_TOKENS.shadow.amber,
    rose: NEO_DARK_TOKENS.shadow.rose,
    violet: NEO_DARK_TOKENS.shadow.violet,
  };
  
  return (
    <div
      className={cn('w-full h-6 bg-[#0a0a0a] border-2 border-white', className)}
      style={{ boxShadow: shadowMap[accent] }}
    >
      <div
        className={cn('h-full border-r-2 border-white transition-all duration-300', accentClasses[accent])}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// NeoDark Section
interface NeoDarkSectionProps extends NeoDarkBaseProps {
  title?: string;
  subtitle?: string;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
}

export function NeoDarkSection({ 
  children, 
  title, 
  subtitle,
  accent = 'cyan',
  className 
}: NeoDarkSectionProps) {
  return (
    <NeoDarkCard accent={accent} className={className}>
      {(title || subtitle) && (
        <div className="border-b-2 border-current p-4 bg-white/5">
          {title && (
            <h2 className="text-lg font-black uppercase tracking-wider text-white">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-sm font-medium text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </NeoDarkCard>
  );
}

// NeoDark Tag
interface NeoDarkTagProps {
  children: ReactNode;
  accent?: 'cyan' | 'emerald' | 'amber' | 'white';
  className?: string;
}

export function NeoDarkTag({ children, accent = 'cyan', className }: NeoDarkTagProps) {
  const accentClasses = {
    cyan: 'text-cyan-400 border-cyan-400',
    emerald: 'text-emerald-400 border-emerald-400',
    amber: 'text-amber-400 border-amber-400',
    white: 'text-white border-white',
  };
  
  const shadowMap = {
    cyan: NEO_DARK_TOKENS.shadow.cyan,
    emerald: NEO_DARK_TOKENS.shadow.emerald,
    amber: NEO_DARK_TOKENS.shadow.amber,
    white: NEO_DARK_TOKENS.shadow.white,
  };
  
  return (
    <span
      className={cn(
        'inline-block px-2 py-0.5 text-xs font-bold border-2 bg-[#141414]',
        accentClasses[accent],
        className
      )}
      style={{ boxShadow: shadowMap[accent] }}
    >
      {children}
    </span>
  );
}
