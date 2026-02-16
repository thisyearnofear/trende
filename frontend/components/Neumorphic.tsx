'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { cn } from '@/lib/utils';

// Neumorphism design tokens for dark theme
// Base: #0f172a (slate-900)
const NEUMORPHIC_TOKENS = {
  background: '#0f172a',
  lightShadow: 'rgba(30, 41, 59, 0.8)',    // lighter than bg
  darkShadow: 'rgba(2, 6, 23, 0.9)',        // darker than bg
  accent: '#06b6d4',                        // cyan-500
  accentGlow: 'rgba(6, 182, 212, 0.3)',
};

interface NeumorphicBaseProps {
  children: ReactNode;
  className?: string;
  intensity?: 'subtle' | 'medium' | 'strong';
  interactive?: boolean;
}

// Utility to generate shadow styles
function getNeumorphicShadows(intensity: 'subtle' | 'medium' | 'strong' = 'medium', pressed = false) {
  const intensityMap = {
    subtle: { offset: '4px', blur: '8px', spread: '0px' },
    medium: { offset: '8px', blur: '16px', spread: '0px' },
    strong: { offset: '12px', blur: '24px', spread: '0px' },
  };
  
  const { offset, blur, spread } = intensityMap[intensity];
  
  if (pressed) {
    return {
      boxShadow: `
        inset ${offset} ${offset} ${blur} ${spread} ${NEUMORPHIC_TOKENS.darkShadow},
        inset -${offset} -${offset} ${blur} ${spread} ${NEUMORPHIC_TOKENS.lightShadow}
      `,
    };
  }
  
  return {
    boxShadow: `
      ${offset} ${offset} ${blur} ${spread} ${NEUMORPHIC_TOKENS.darkShadow},
      -${offset} -${offset} ${blur} ${spread} ${NEUMORPHIC_TOKENS.lightShadow}
    `,
  };
}

// Neumorphic Card - extruded container
export function NeumorphicCard({ 
  children, 
  className,
  intensity = 'medium',
  interactive = false,
}: NeumorphicBaseProps) {
  const [isPressed, setIsPressed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const shadowStyle = getNeumorphicShadows(intensity, isPressed && interactive);

  return (
    <div
      ref={cardRef}
      className={cn(
        'rounded-3xl bg-slate-900 transition-all duration-200',
        interactive && 'cursor-pointer active:scale-[0.98]',
        className
      )}
      style={{
        ...shadowStyle,
        background: `linear-gradient(145deg, #1e293b, #0f172a)`,
      }}
      onMouseDown={() => interactive && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {children}
    </div>
  );
}

// Neumorphic Button - tactile press effect
interface NeumorphicButtonProps extends NeumorphicBaseProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'accent';
  size?: 'sm' | 'md' | 'lg';
}

export function NeumorphicButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
  size = 'md',
  className,
}: NeumorphicButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Size classes
  const sizeClasses = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
  };

  // Variant styles
  const variantStyles = {
    primary: {
      gradient: 'linear-gradient(145deg, #1e293b, #0f172a)',
      text: 'text-slate-300',
      activeText: 'text-cyan-400',
    },
    secondary: {
      gradient: 'linear-gradient(145deg, #1e293b, #0f172a)',
      text: 'text-slate-400',
      activeText: 'text-slate-200',
    },
    accent: {
      gradient: 'linear-gradient(145deg, #0891b2, #06b6d4)',
      text: 'text-white',
      activeText: 'text-white',
    },
  };

  const style = variantStyles[variant];
  const shadowStyle = getNeumorphicShadows('medium', isPressed);

  // Accent variant has different shadow colors
  if (variant === 'accent' && !isPressed) {
    shadowStyle.boxShadow = `
      8px 8px 16px rgba(2, 6, 23, 0.8),
      -8px -8px 16px rgba(30, 41, 59, 0.4),
      inset 0 0 20px rgba(6, 182, 212, 0.2)
    `;
  }

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-2xl font-semibold transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'active:scale-[0.98]',
        sizeClasses[size],
        isPressed ? style.activeText : style.text,
        className
      )}
      style={{
        ...shadowStyle,
        background: style.gradient,
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {children}
    </button>
  );
}

// Neumorphic Input - indented text field
interface NeumorphicInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
}

export function NeumorphicInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  rows = 4,
}: NeumorphicInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const insetShadow = isFocused
    ? `
      inset 6px 6px 12px rgba(2, 6, 23, 0.9),
      inset -6px -6px 12px rgba(30, 41, 59, 0.8),
      0 0 0 2px rgba(6, 182, 212, 0.3)
    `
    : `
      inset 6px 6px 12px rgba(2, 6, 23, 0.9),
      inset -6px -6px 12px rgba(30, 41, 59, 0.8)
    `;

  if (rows > 1) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={cn(
          'w-full rounded-2xl bg-slate-900 text-slate-200 placeholder-slate-600',
          'p-4 resize-none outline-none transition-all duration-200',
          'disabled:opacity-50',
          className
        )}
        style={{ boxShadow: insetShadow }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        'w-full rounded-2xl bg-slate-900 text-slate-200 placeholder-slate-600',
        'px-4 py-3 outline-none transition-all duration-200',
        'disabled:opacity-50',
        className
      )}
      style={{ boxShadow: insetShadow }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    />
  );
}

// Neumorphic Toggle - switch with depth
interface NeumorphicToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function NeumorphicToggle({ checked, onChange, label }: NeumorphicToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 group"
    >
      <div
        className={cn(
          'relative w-14 h-8 rounded-full transition-all duration-300',
          'bg-slate-900'
        )}
        style={{
          boxShadow: checked
            ? 'inset 4px 4px 8px rgba(2, 6, 23, 0.9), inset -4px -4px 8px rgba(30, 41, 59, 0.8)'
            : '4px 4px 8px rgba(2, 6, 23, 0.8), -4px -4px 8px rgba(30, 41, 59, 0.6)',
        }}
      >
        {/* Toggle knob */}
        <div
          className={cn(
            'absolute top-1 w-6 h-6 rounded-full transition-all duration-300',
            checked 
              ? 'left-7 bg-gradient-to-br from-cyan-400 to-cyan-600' 
              : 'left-1 bg-slate-700'
          )}
          style={{
            boxShadow: checked
              ? '2px 2px 4px rgba(6, 182, 212, 0.4), -2px -2px 4px rgba(255, 255, 255, 0.1)'
              : '2px 2px 4px rgba(2, 6, 23, 0.8), -2px -2px 4px rgba(30, 41, 59, 0.4)',
          }}
        />
      </div>
      {label && (
        <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
          {label}
        </span>
      )}
    </button>
  );
}

// Neumorphic Indicator - LED-style status light
interface NeumorphicIndicatorProps {
  active: boolean;
  color?: 'cyan' | 'emerald' | 'amber' | 'rose';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function NeumorphicIndicator({ 
  active, 
  color = 'cyan',
  size = 'md',
  pulse = false,
}: NeumorphicIndicatorProps) {
  const colorMap = {
    cyan: { bg: 'bg-cyan-500', glow: 'rgba(6, 182, 212, 0.6)' },
    emerald: { bg: 'bg-emerald-500', glow: 'rgba(16, 185, 129, 0.6)' },
    amber: { bg: 'bg-amber-500', glow: 'rgba(245, 158, 11, 0.6)' },
    rose: { bg: 'bg-rose-500', glow: 'rgba(244, 63, 94, 0.6)' },
  };

  const sizeMap = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const { bg, glow } = colorMap[color];

  return (
    <div
      className={cn(
        'rounded-full transition-all duration-300',
        sizeMap[size],
        active ? bg : 'bg-slate-700'
      )}
      style={{
        boxShadow: active
          ? `
            inset 1px 1px 2px rgba(255, 255, 255, 0.3),
            inset -1px -1px 2px rgba(0, 0, 0, 0.3),
            0 0 10px ${glow},
            0 0 20px ${glow}
          `
          : `
            inset 2px 2px 4px rgba(2, 6, 23, 0.9),
            inset -2px -2px 4px rgba(30, 41, 59, 0.4)
          `,
        animation: active && pulse ? 'pulse 2s ease-in-out infinite' : undefined,
      }}
    />
  );
}

// Neumorphic Stat - extruded statistic display
interface NeumorphicStatProps {
  value: string | number;
  label: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

export function NeumorphicStat({ value, label, icon, trend }: NeumorphicStatProps) {
  return (
    <NeumorphicCard className="p-4" intensity="medium">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-200">{value}</p>
          {trend && (
            <p className={cn(
              'text-xs mt-1',
              trend === 'up' && 'text-emerald-400',
              trend === 'down' && 'text-rose-400',
              trend === 'neutral' && 'text-slate-500'
            )}>
              {trend === 'up' && '↑'}
              {trend === 'down' && '↓'}
              {trend === 'neutral' && '→'}
            </p>
          )}
        </div>
        {icon && (
          <div 
            className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400"
            style={{
              boxShadow: `
                inset 2px 2px 4px rgba(2, 6, 23, 0.8),
                inset -2px -2px 4px rgba(30, 41, 59, 0.4)
              `,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </NeumorphicCard>
  );
}


