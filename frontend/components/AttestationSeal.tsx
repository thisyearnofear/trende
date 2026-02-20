'use client';

import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ShieldCheck, Fingerprint, Lock, CheckCircle2, XCircle, Clock, Sparkles, Shield } from 'lucide-react';

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
        className={`
          relative flex items-center gap-2 px-3 py-1.5 rounded-full overflow-hidden
          ${config.bg} ${config.border} border backdrop-blur-md
          transition-all duration-300 ${config.glow} shadow-lg
          hover:scale-105 active:scale-95 group
        `}
      >
        <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer`} />

        <Icon className={`w-4 h-4 ${config.color} ${status === 'verifying' ? 'animate-pulse' : ''}`} />
        <span className={`text-[10px] font-black ${config.color} uppercase tracking-widest`}>
          {config.label}
        </span>

        {status === 'verified' && (
          <div className="flex items-center gap-1 ml-1 pl-2 border-l border-emerald-500/20">
            <Fingerprint className="w-3 h-3 text-emerald-400" />
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="relative group">
      {/* Decorative Glow Background */}
      <div className={`absolute -inset-4 rounded-[2rem] blur-3xl opacity-20 transition-all duration-700 ${status === 'verified' ? 'bg-emerald-500 opacity-30 scale-110' : 'bg-transparent'}`} />

      <button
        ref={sealRef}
        onClick={onVerify}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative p-8 rounded-[2rem] min-w-[280px]
          ${config.bg} ${config.border} border-2 backdrop-blur-xl
          transition-all duration-500 ${config.glow} shadow-2xl
          hover:shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)]
          overflow-hidden
        `}
        style={{ perspective: '1200px' }}
      >
        {/* Holographic Scan Beam */}
        {status === 'verified' && (
          <div
            ref={scanRef}
            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent blur-[1px] z-10 pointer-events-none"
          />
        )}

        {/* Dynamic Static Noise Overlay for TEE feel */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

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
                className="text-emerald-500/10"
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
            <div className={`
              w-20 h-20 flex items-center justify-center transition-transform duration-500 group-hover:rotate-12
              ${config.bg} border-2 ${config.border}
              [clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]
            `}>
              <Icon className={`w-9 h-9 ${config.color} ${status === 'verifying' ? 'animate-pulse' : ''}`} />
            </div>

            {/* Corner Sparks */}
            {status === 'verified' && (
              <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-emerald-400 animate-bounce" />
            )}
          </div>

          {/* Label Group */}
          <div className="text-center space-y-1">
            <p className={`text-lg font-black ${config.color} uppercase tracking-widest flex items-center justify-center gap-2`}>
              {status === 'verified' && <Shield className="w-4 h-4" />}
              {config.label}
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="h-[1px] w-4 bg-slate-700" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{provider}</p>
              <span className="h-[1px] w-4 bg-slate-700" />
            </div>
          </div>

          {/* Attestation ID: Modernized */}
          {attestationId && status === 'verified' && (
            <div className="mt-2 w-full flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-950/80 border border-emerald-500/20 backdrop-blur-md">
                <Lock className="w-2.5 h-2.5 text-emerald-500/50" />
                <p className="text-[9px] font-mono text-emerald-400/80 tracking-tighter truncate max-w-[180px]">
                  {attestationId}
                </p>
              </div>
              <p className="text-[8px] uppercase tracking-widest text-slate-600 font-black">Cryptographic Proof-of-Source</p>
            </div>
          )}
        </div>

        {/* Hover Interaction Tip */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800">
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
  return (
    <div className={`
      inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em]
      ${verified
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_-5px_rgba(16,185,129,0.4)]'
        : 'bg-slate-900/50 text-slate-500 border border-slate-800'}
      ${className}
    `}>
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
