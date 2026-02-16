'use client';

import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ShieldCheck, Fingerprint, Lock, CheckCircle2, XCircle, Clock } from 'lucide-react';

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
  const [isHovered, setIsHovered] = useState(false);

  // Stamp animation on verified
  useEffect(() => {
    if (!sealRef.current || status !== 'verified') return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      
      tl.fromTo(
        sealRef.current,
        { scale: 1.5, opacity: 0, rotateY: -90 },
        { scale: 1, opacity: 1, rotateY: 0, duration: 0.8, ease: 'back.out(1.4)' }
      );

      // Ring pulse effect
      if (ringRef.current) {
        const rings = ringRef.current.querySelectorAll('circle');
        tl.fromTo(
          rings,
          { strokeDashoffset: 283, opacity: 0 },
          { strokeDashoffset: 0, opacity: 1, duration: 1, stagger: 0.1, ease: 'power2.out' },
          '-=0.4'
        );
      }
    });

    return () => ctx.revert();
  }, [status]);

  // Hover animation
  useEffect(() => {
    if (!sealRef.current) return;

    gsap.to(sealRef.current, {
      scale: isHovered ? 1.05 : 1,
      duration: 0.3,
      ease: 'power2.out',
    });
  }, [isHovered]);

  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      label: 'Pending Attestation',
      glow: 'shadow-amber-500/20',
    },
    verifying: {
      icon: Lock,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30',
      label: 'Verifying in TEE...',
      glow: 'shadow-cyan-500/20',
    },
    verified: {
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/40',
      label: 'TEE Attested',
      glow: 'shadow-emerald-500/30',
    },
    failed: {
      icon: XCircle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      label: 'Attestation Failed',
      glow: 'shadow-rose-500/20',
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
          relative flex items-center gap-2 px-3 py-1.5 rounded-full
          ${config.bg} ${config.border} border
          transition-all duration-300 ${config.glow} shadow-lg
          hover:scale-105 active:scale-95
        `}
      >
        {/* Animated ring for verifying */}
        {status === 'verifying' && (
          <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: '3s' }}>
            <circle
              cx="50%"
              cy="50%"
              r="48%"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-cyan-500/30"
              strokeDasharray="4 4"
            />
          </svg>
        )}
        
        <Icon className={`w-4 h-4 ${config.color} ${status === 'verifying' ? 'animate-pulse' : ''}`} />
        <span className={`text-xs font-bold ${config.color} uppercase tracking-wider`}>
          {config.label}
        </span>
        
        {status === 'verified' && (
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        )}
      </button>
    );
  }

  return (
    <button
      ref={sealRef}
      onClick={onVerify}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative group p-6 rounded-2xl
        ${config.bg} ${config.border} border-2
        transition-all duration-500 ${config.glow} shadow-xl
        hover:shadow-2xl
      `}
      style={{ perspective: '1000px' }}
    >
      {/* Concentric rings for verified state */}
      {status === 'verified' && (
        <svg
          ref={ringRef}
          className="absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 100 100"
        >
          {[0.85, 0.7, 0.55].map((scale, i) => (
            <circle
              key={i}
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-emerald-500/20"
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
      <div className="relative flex flex-col items-center gap-3">
        {/* Icon with glow */}
        <div className={`
          relative w-16 h-16 rounded-xl flex items-center justify-center
          ${config.bg} border ${config.border}
        `}>
          <Icon className={`w-8 h-8 ${config.color} ${status === 'verifying' ? 'animate-pulse' : ''}`} />
          
          {/* Glow effect */}
          <div className={`absolute inset-0 rounded-xl blur-xl ${config.bg} opacity-50`} />
        </div>

        {/* Label */}
        <div className="text-center">
          <p className={`text-sm font-bold ${config.color} uppercase tracking-wider`}>
            {config.label}
          </p>
          {provider && (
            <p className="text-xs text-slate-500 mt-1">{provider}</p>
          )}
        </div>

        {/* Attestation ID */}
        {attestationId && status === 'verified' && (
          <div className="mt-2 px-3 py-1 rounded-lg bg-slate-950/50 border border-slate-800">
            <p className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">
              {attestationId}
            </p>
          </div>
        )}
      </div>

      {/* Hover hint */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[10px] text-slate-500 whitespace-nowrap">
          {status === 'verified' ? 'Click to verify' : 'Click to retry'}
        </p>
      </div>
    </button>
  );
}

// Verification badge for inline use
export function VerificationBadge({ 
  verified, 
  className = '' 
}: { 
  verified: boolean; 
  className?: string;
}) {
  return (
    <div className={`
      inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
      ${verified 
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
        : 'bg-slate-800 text-slate-500 border border-slate-700'}
      ${className}
    `}>
      {verified ? (
        <>
          <Fingerprint className="w-3 h-3" />
          TEE Verified
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
