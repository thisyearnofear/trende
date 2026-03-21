'use client';

import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { Zap, Shield } from 'lucide-react';

interface KineticHeaderProps {
  title?: string;
  subtitle?: string;
  badge?: string;
}

export function KineticHeader({ 
  title = 'Trende Control Room', 
  subtitle = 'Intelligence-to-Asset Pipeline',
  badge = 'Proof-Secured'
}: KineticHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // Initial entrance animation
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Icon scales in with rotation
      tl.fromTo(
        iconRef.current,
        { scale: 0, rotate: -180, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 0.8 }
      );

      // Title characters animate in
      if (titleRef.current) {
        const chars = titleRef.current.querySelectorAll('.char');
        tl.fromTo(
          chars,
          { y: 50, opacity: 0, rotateX: -90 },
          { y: 0, opacity: 1, rotateX: 0, duration: 0.6, stagger: 0.02 },
          '-=0.4'
        );
      }

      // Subtitle fades in
      tl.fromTo(
        subtitleRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5 },
        '-=0.3'
      );

      // Badge slides in
      tl.fromTo(
        badgeRef.current,
        { x: -20, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4 },
        '-=0.2'
      );

      // Continuous subtle animations
      // Icon pulse
      gsap.to(iconRef.current, {
        boxShadow: '0 0 40px rgba(6, 182, 212, 0.4)',
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Split title into characters for animation
  const titleChars = title.split('').map((char, i) => (
    <span 
      key={i} 
      className="char inline-block"
      style={{ display: char === ' ' ? 'inline' : 'inline-block' }}
    >
      {char === ' ' ? '\u00A0' : char}
    </span>
  ));

  return (
    <div ref={containerRef} className="flex items-center gap-4 min-w-0">
      {/* Animated Icon */}
      <div 
        ref={iconRef}
        className="relative w-12 h-12 shrink-0"
      >
        {/* Glow layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-emerald-400 rounded-2xl blur-xl opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-2xl" />
        
        {/* Icon content */}
        <div className="relative w-full h-full flex items-center justify-center">
          <Zap className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>

        {/* Orbiting elements */}
        <div className="absolute inset-0 animate-spin-slow" style={{ animationDuration: '8s' }}>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-300" />
        </div>
        <div className="absolute inset-0 animate-spin-slow" style={{ animationDuration: '12s', animationDirection: 'reverse' }}>
          <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-1 h-1 rounded-full bg-emerald-300" />
        </div>
      </div>

      {/* Text content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 mb-1">
          <h1 
            ref={titleRef}
            className="text-xl font-bold text-slate-100 truncate"
            style={{ perspective: '500px' }}
          >
            {titleChars}
          </h1>
          
          {/* Proof badge */}
          <div 
            ref={badgeRef}
            className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 shrink-0"
          >
            <Shield className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">{badge}</span>
          </div>
        </div>
        
        <p ref={subtitleRef} className="text-xs text-slate-400 truncate">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// Simpler variant for section headers
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  accent?: 'cyan' | 'emerald' | 'amber';
}

export function SectionHeader({ title, subtitle, icon: Icon, accent = 'cyan' }: SectionHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { x: -30, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const accentColors = {
    cyan: 'from-cyan-500 to-sky-500 border-cyan-500/30 text-cyan-400',
    emerald: 'from-emerald-500 to-green-500 border-emerald-500/30 text-emerald-400',
    amber: 'from-amber-500 to-orange-500 border-amber-500/30 text-amber-400',
  };

  return (
    <div ref={containerRef} className="flex items-center gap-3 mb-4">
      {Icon && (
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accentColors[accent]} bg-opacity-10 border flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      )}
      <div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

// Multi-chain themed hero text
export function HeroText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!textRef.current) return;

    const ctx = gsap.context(() => {
      // Word-by-word reveal
      const words = textRef.current?.querySelectorAll('.word');
      if (words) {
        gsap.fromTo(
          words,
          { y: 20, opacity: 0, filter: 'blur(10px)' },
          { 
            y: 0, 
            opacity: 1, 
            filter: 'blur(0px)',
            duration: 0.8, 
            stagger: 0.05, 
            ease: 'power3.out',
            delay: 0.2
          }
        );
      }
    }, textRef);

    return () => ctx.revert();
  }, []);

  // Split children into words
  const words = typeof children === 'string' 
    ? children.split(' ').map((word, i) => (
        <span key={i} className="word inline-block mr-[0.25em]">{word}</span>
      ))
    : children;

  return (
    <div ref={textRef} className={className}>
      {words}
    </div>
  );
}
