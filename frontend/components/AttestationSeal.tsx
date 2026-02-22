'use client';

import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ShieldCheck, Fingerprint, Lock, CheckCircle2, XCircle, Clock, Sparkles, Shield } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { cn } from '@/lib/utils';

interface AttestationSealProps {
  status: 'pending' | 'verifying' | 'verified' | 'failed';
  attestationId?: string;
  provider?: string;
  onVerify?: () => void;
  compact?: boolean;
}

export function AttestationSeal({
  status,
  attestationId,
  provider = 'EigenCompute',
  onVerify,
  compact = false,
}: AttestationSealProps) {
  const sealRef = useRef<HTMLButtonElement>(null);
  const ringRef = useRef<SVGSVGElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const { isSoft } = useTheme();

  // Holographic Beam Animation
  useEffect(() => {
    if (!scanRef.current || status !== 'verified') return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        scanRef.current,
        { top: '-10%', opacity: 0 },
        {
          top: '110%',
          opacity: 1,
          duration: 2.5,
          repeat: -1,
          ease: 'power1.inOut',
          repeatDelay: 1,
          yoyo: true
        }
      );
    });

    return () => ctx.revert();
  }, [status]);

  // Verified Stamp Animation
  useEffect(() => {
    if (!sealRef.current || status !== 'verified') return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      tl.fromTo(
        sealRef.current,
        { scale: 1.5, opacity: 0, rotateY: -90, filter: 'brightness(2) blur(10px)' },
        { scale: 1, opacity: 1, rotateY: 0, filter: 'brightness(1) blur(0px)', duration: 1, ease: 'back.out(1.4)' }
      );

      // Ring pulse effect
      if (ringRef.current) {
        const rings = ringRef.current.querySelectorAll('circle');
        tl.fromTo(
          rings,
          { strokeDashoffset: 283, opacity: 0, scale: 0.8 },
          { strokeDashoffset: 0, opacity: 1, scale: 1, duration: 1.2, stagger: 0.15, ease: 'power2.out' },
          '-=0.6'
        );
      }
    });

    return () => ctx.revert();
  }, [status]);

  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/5',
      border: 'border-amber-500/20',
      label: 'Pending Attestation',
      glow: 'shadow-amber-500/10',
      hologram: '',
    },
    verifying: {
      icon: Lock,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30',
      label: 'TEE Orchestration...',
      glow: 'shadow-cyan-500/20',
      hologram: 'animate-pulse',
    },
    verified: {
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/40',
      label: 'Authenticity Verified',
      glow: 'shadow-emerald-500/40',
      hologram: 'after:content-[""] after:absolute after:inset-0 after:bg-gradient-to-tr after:from-transparent after:via-emerald-400/10 after:to-transparent after:opacity-50',
    },
    failed: {
      icon: XCircle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/5',
      border: 'border-rose-500/30',
      label: 'Attestation Fault',
      glow: 'shadow-rose-500/10',
      hologram: '',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  if (compact) {
    return (
      <button
        ref={sealRef}
        onClick={onVerify}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "relative flex items-center gap-2 px-3 py-1.5 rounded-full overflow-hidden transition-all duration-300 shadow-lg hover:scale-105 active:scale-95 group",
          isSoft ? "soft-ui-button border-0" : `${config.bg} ${config.border} border backdrop-blur-md ${config.glow}`
        )}
      >
        <div className={cn(
          "absolute inset-0 bg-gradient-to-r from-transparent to-transparent -translate-x-full group-hover:animate-shimmer",
          !isSoft && "via-white/5"
        )} />

        <Icon className={cn("w-4 h-4", status === 'verifying' ? 'animate-pulse' : '', isSoft ? `text-[var(--accent-${status === 'pending' ? 'amber' : status === 'verifying' ? 'cyan' : status === 'verified' ? 'emerald' : 'rose'})]` : config.color)} />
        <span className={cn(
          "text-[10px] font-black uppercase tracking-widest",
          isSoft ? `text-[var(--accent-${status === 'pending' ? 'amber' : status === 'verifying' ? 'cyan' : status === 'verified' ? 'emerald' : 'rose'})]` : config.color
        )}>
          {config.label}
        </span>

        {status === 'verified' && (
          <div className={cn(
            "flex items-center gap-1 ml-1 pl-2 border-l",
            isSoft ? "border-[var(--text-muted)]/10" : "border-emerald-500/20"
          )}>
            <Fingerprint className={cn("w-3 h-3", isSoft ? "text-[var(--accent-emerald)]" : "text-emerald-400")} />
            <CheckCircle2 className={cn("w-3 h-3", isSoft ? "text-[var(--accent-emerald)]" : "text-emerald-400")} />
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="relative group">
      {/* Decorative Glow Background */}
      <div className={cn(
        "absolute -inset-4 rounded-[2rem] blur-3xl opacity-20 transition-all duration-700",
        status === 'verified' ? (isSoft ? "bg-[var(--accent-emerald)] opacity-10 scale-110" : "bg-emerald-500 opacity-30 scale-110") : "bg-transparent"
      )} />

      <button
        ref={sealRef}
        onClick={onVerify}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "relative p-8 rounded-[2rem] min-w-[280px] transition-all duration-500 overflow-hidden",
          isSoft 
            ? "soft-ui-out border-0" 
            : `${config.bg} ${config.border} border-2 backdrop-blur-xl ${config.glow} shadow-2xl hover:shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)]`
        )}
        style={{ perspective: '1200px' }}
      >
        {/* Holographic Scan Beam */}
        {status === 'verified' && (
          <div
            ref={scanRef}
            className={cn(
              "absolute left-0 right-0 h-[2px] blur-[1px] z-10 pointer-events-none",
              isSoft ? "bg-gradient-to-r from-transparent via-[var(--accent-emerald)]/30 to-transparent" : "bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent"
            )}
          />
        )}

        {/* Dynamic Static Noise Overlay for TEE feel */}
        {!isSoft && <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />}

        {/* Concentric rings for verified state */}
        {status === 'verified' && (
          <svg
            ref={ringRef}
            className="absolute inset-0 w-full h-full -rotate-90 scale-125"
            viewBox="0 0 100 100"
          >
            {[0.85, 0.75, 0.65].map((scale, i) => (
              <circle
                key={i}
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.2"
                className={isSoft ? "text-[var(--accent-emerald)]/10" : "text-emerald-500/10"}
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'center',
                  strokeDasharray: 283,
                }}
              />
            ))}
          </svg>
        )}

        {/* Main content */}
        <div className="relative flex flex-col items-center gap-5 z-20">
          {/* Icon Hexagon Container */}
          <div className="relative group/icon">
            <div className={cn(
              "w-20 h-20 flex items-center justify-center transition-transform duration-500 group-hover:rotate-12 [clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]",
              isSoft ? "soft-ui-in" : `${config.bg} border-2 ${config.border}`
            )}>
              <Icon className={cn("w-9 h-9", status === 'verifying' ? 'animate-pulse' : '', isSoft ? `text-[var(--accent-${status === 'pending' ? 'amber' : status === 'verifying' ? 'cyan' : status === 'verified' ? 'emerald' : 'rose'})]` : config.color)} />
            </div>

            {/* Corner Sparks */}
            {status === 'verified' && (
              <Sparkles className={cn("absolute -top-2 -right-2 w-5 h-5 animate-bounce", isSoft ? "text-[var(--accent-emerald)]" : "text-emerald-400")} />
            )}
          </div>

          {/* Label Group */}
          <div className="text-center space-y-1">
            <p className={cn(
              "text-lg font-black uppercase tracking-widest flex items-center justify-center gap-2",
              isSoft ? `text-[var(--accent-${status === 'pending' ? 'amber' : status === 'verifying' ? 'cyan' : status === 'verified' ? 'emerald' : 'rose'})]` : config.color
            )}>
              {status === 'verified' && <Shield className="w-4 h-4" />}
              {config.label}
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className={cn("h-[1px] w-4", isSoft ? "bg-[var(--text-muted)]/20" : "bg-slate-700")} />
              <p className={cn("text-[10px] font-black uppercase tracking-[0.2em]", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>{provider}</p>
              <span className={cn("h-[1px] w-4", isSoft ? "bg-[var(--text-muted)]/20" : "bg-slate-700")} />
            </div>
          </div>

          {/* Attestation ID: Modernized */}
          {attestationId && status === 'verified' && (
            <div className="mt-2 w-full flex flex-col items-center gap-1.5">
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded backdrop-blur-md",
                isSoft ? "soft-ui-in border-0" : "bg-slate-950/80 border border-emerald-500/20"
              )}>
                <Lock className={cn("w-2.5 h-2.5", isSoft ? "text-[var(--accent-emerald)]/50" : "text-emerald-500/50")} />
                <p className={cn("text-[9px] font-mono tracking-tighter truncate max-w-[180px]", isSoft ? "text-[var(--accent-emerald)]/80" : "text-emerald-400/80")}>
                  {attestationId}
                </p>
              </div>
              <p className={cn("text-[8px] uppercase tracking-widest font-black", isSoft ? "text-[var(--text-muted)]" : "text-slate-600")}>Cryptographic Proof-of-Source</p>
            </div>
          )}
        </div>

        {/* Hover Interaction Tip */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <p className={cn(
            "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
            isSoft ? "soft-ui-out text-[var(--text-muted)]" : "bg-slate-900/80 text-slate-500 border border-slate-800"
          )}>
            {status === 'verified' ? 'Inspect Integrity Details' : 'Initialize Verification'}
          </p>
        </div>
      </button>
    </div>
  );
}

// Verification badge for inline use (e.g. results cards)
export function VerificationBadge({
  verified,
  className = ''
}: {
  verified: boolean;
  className?: string;
}) {
  const { isSoft } = useTheme();
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em]",
      verified
        ? (isSoft ? 'soft-ui-out text-[var(--accent-emerald)] shadow-[0_0_15px_-5px_rgba(16,185,129,0.2)]' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_-5px_rgba(16,185,129,0.4)]')
        : (isSoft ? 'soft-ui-in text-[var(--text-muted)]' : 'bg-slate-900/50 text-slate-500 border border-slate-800'),
      className
    )}>
      {verified ? (
        <>
          <Fingerprint className="w-3 h-3 animate-pulse" />
          TEE-Verified
        </>
      ) : (
        <>
          <Clock className="w-3 h-3" />
          Pending
        </>
      )}
    </div>
  );
}
