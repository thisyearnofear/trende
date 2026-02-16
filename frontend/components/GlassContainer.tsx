'use client';

import { ReactNode, useRef, useEffect, forwardRef } from 'react';
import { gsap } from 'gsap';
import { Shield, Lock, Fingerprint } from 'lucide-react';

interface GlassContainerProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'secure' | 'attested' | 'processing';
  title?: string;
  subtitle?: string;
  sealAnimation?: boolean;
}

const variantStyles = {
  default: {
    border: 'border-white/10',
    bg: 'bg-slate-900/40',
    glow: 'shadow-cyan-500/10',
    accent: 'cyan',
  },
  secure: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-950/20',
    glow: 'shadow-emerald-500/20',
    accent: 'emerald',
  },
  attested: {
    border: 'border-cyan-500/40',
    bg: 'bg-cyan-950/30',
    glow: 'shadow-cyan-500/30',
    accent: 'cyan',
  },
  processing: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-950/20',
    glow: 'shadow-amber-500/20',
    accent: 'amber',
  },
};

export const GlassContainer = forwardRef<HTMLDivElement, GlassContainerProps>(function GlassContainer({
  children,
  className = '',
  variant = 'default',
  title,
  subtitle,
  sealAnimation = false,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);
  const styles = variantStyles[variant];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Subtle breathing animation for the container
    const ctx = gsap.context(() => {
      gsap.to(el, {
        boxShadow: '0 0 40px rgba(6, 182, 212, 0.15)',
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!sealRef.current || !sealAnimation) return;

    // Seal stamping animation
    const ctx = gsap.context(() => {
      gsap.fromTo(
        sealRef.current,
        { scale: 2, opacity: 0, rotate: -15 },
        { scale: 1, opacity: 1, rotate: 0, duration: 0.6, ease: 'back.out(1.7)' }
      );
    });

    return () => ctx.revert();
  }, [sealAnimation]);

  return (
    <div
      ref={containerRef}
      className={`
        relative rounded-3xl border backdrop-blur-xl overflow-hidden
        ${styles.border} ${styles.bg} ${styles.glow}
        shadow-lg transition-all duration-500
        ${className}
      `}
    >
      {/* TEE Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, ${styles.accent === 'emerald' ? '#10b981' : styles.accent === 'amber' ? '#f59e0b' : '#06b6d4'} 1px, transparent 1px),
            linear-gradient(to bottom, ${styles.accent === 'emerald' ? '#10b981' : styles.accent === 'amber' ? '#f59e0b' : '#06b6d4'} 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Corner Accents */}
      <div className={`absolute top-0 left-0 w-20 h-20 border-l-2 border-t-2 ${styles.border.replace('border-', 'border-').replace('/30', '/50').replace('/40', '/60')} rounded-tl-3xl pointer-events-none`} />
      <div className={`absolute top-0 right-0 w-20 h-20 border-r-2 border-t-2 ${styles.border.replace('border-', 'border-').replace('/30', '/50').replace('/40', '/60')} rounded-tr-3xl pointer-events-none`} />
      <div className={`absolute bottom-0 left-0 w-20 h-20 border-l-2 border-b-2 ${styles.border.replace('border-', 'border-').replace('/30', '/50').replace('/40', '/60')} rounded-bl-3xl pointer-events-none`} />
      <div className={`absolute bottom-0 right-0 w-20 h-20 border-r-2 border-b-2 ${styles.border.replace('border-', 'border-').replace('/30', '/50').replace('/40', '/60')} rounded-br-3xl pointer-events-none`} />

      {/* Header with TEE indicators */}
      {(title || variant !== 'default') && (
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            {variant === 'secure' && <Shield className="w-4 h-4 text-emerald-400" />}
            {variant === 'attested' && <Fingerprint className="w-4 h-4 text-cyan-400" />}
            {variant === 'processing' && <Lock className="w-4 h-4 text-amber-400 animate-pulse" />}
            {title && (
              <div>
                <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
                {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
              </div>
            )}
          </div>

          {/* Attestation Seal */}
          {variant === 'attested' && (
            <div
              ref={sealRef}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30"
            >
              <Fingerprint className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">TEE</span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="relative">
        {children}
      </div>

      {/* Bottom Security Indicator */}
      {variant === 'secure' && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-[10px] text-emerald-500/60 uppercase tracking-widest">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Encrypted
        </div>
      )}
    </div>
  );
});

// Specialized variant for the query input area
export function SecureInputContainer({ children, isActive }: { children: ReactNode; isActive?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !isActive) return;

    const ctx = gsap.context(() => {
      // Active state animation
      gsap.to(containerRef.current, {
        borderColor: 'rgba(6, 182, 212, 0.5)',
        boxShadow: '0 0 60px rgba(6, 182, 212, 0.2), inset 0 0 60px rgba(6, 182, 212, 0.05)',
        duration: 0.4,
        ease: 'power2.out',
      });
    });

    return () => {
      gsap.to(containerRef.current, {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        boxShadow: 'none',
        duration: 0.3,
      });
      ctx.revert();
    };
  }, [isActive]);

  return (
    <GlassContainer
      variant="secure"
      title="Secure Input Channel"
      subtitle="TEE-Protected • End-to-End Encrypted"
      className="transition-all duration-300"
    >
      {children}
    </GlassContainer>
  );
}
