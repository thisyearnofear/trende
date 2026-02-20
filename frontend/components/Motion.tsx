'use client';

import { useRef, useEffect, useState, useCallback, ReactNode, ElementType } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// ============================================
// MOTION CONFIGURATION
// ============================================

// Animation presets - unified motion language
const ANIMATIONS = {
  // Entrance animations
  fadeInUp: {
    from: { opacity: 0, y: 30 },
    to: { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' },
  },
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1, duration: 0.5, ease: 'power2.out' },
  },
  scaleIn: {
    from: { opacity: 0, scale: 0.9 },
    to: { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.2)' },
  },
  slideInLeft: {
    from: { opacity: 0, x: -50 },
    to: { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' },
  },
  slideInRight: {
    from: { opacity: 0, x: 50 },
    to: { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' },
  },
  
  // Stagger children animations
  staggerFadeInUp: {
    from: { opacity: 0, y: 20 },
    to: { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.1 },
  },
  staggerSlideUp: {
    from: { opacity: 0, y: 40 },
    to: { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08 },
  },
  
  // Special effects
  blurReveal: {
    from: { opacity: 0, filter: 'blur(10px)' },
    to: { opacity: 1, filter: 'blur(0px)', duration: 0.8, ease: 'power2.out' },
  },
  scrambleReveal: {
    // Custom - handled separately
    from: {},
    to: {},
  },
};

type AnimationType = keyof typeof ANIMATIONS;

// ============================================
// HOOK: USE MOTION
// ============================================

interface UseMotionOptions {
  type?: AnimationType;
  delay?: number;
  duration?: number;
  ease?: string;
  stagger?: number;
  scrollTrigger?: boolean;
  scrollTriggerOptions?: ScrollTrigger.Vars;
  disabled?: boolean;
}

export function useMotion<T extends HTMLElement>(options: UseMotionOptions = {}) {
  const {
    type = 'fadeInUp',
    delay = 0,
    duration,
    ease,
    stagger,
    scrollTrigger = false,
    scrollTriggerOptions = {},
    disabled = false,
  } = options;

  const ref = useRef<T>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!ref.current || disabled || !isMounted) return;

    const ctx = gsap.context(() => {
      const animConfig = ANIMATIONS[type];
      if (!animConfig || type === 'scrambleReveal') return;

      const animParams: gsap.TweenVars = {
        ...animConfig.to,
        delay,
        scrollTrigger: scrollTrigger ? {
          trigger: ref.current,
          start: 'top 85%',
          end: 'bottom 20%',
          toggleActions: 'play none none reverse',
          ...scrollTriggerOptions,
        } : undefined,
      };

      // Override with custom values if provided
      if (duration) animParams.duration = duration;
      if (ease) animParams.ease = ease;
      if (stagger) animParams.stagger = stagger;

      gsap.fromTo(ref.current, animConfig.from, animParams);
    }, ref);

    return () => ctx.revert();
  }, [type, delay, duration, ease, stagger, scrollTrigger, scrollTriggerOptions, disabled, isMounted]);

  return ref;
}

// ============================================
// COMPONENT: MOTION WRAPPER
// ============================================

interface MotionProps {
  children: ReactNode;
  type?: AnimationType;
  delay?: number;
  duration?: number;
  ease?: string;
  stagger?: number;
  scrollTrigger?: boolean;
  scrollTriggerStart?: string;
  scrollTriggerEnd?: string;
  className?: string;
  disabled?: boolean;
  as?: ElementType;
}

export function Motion({
  children,
  type = 'fadeInUp',
  delay = 0,
  duration,
  ease,
  stagger,
  scrollTrigger = false,
  scrollTriggerStart = 'top 85%',
  scrollTriggerEnd = 'bottom 20%',
  className = '',
  disabled = false,
  as: Component = 'div',
}: MotionProps) {
  const ref = useMotion<HTMLElement>({
    type,
    delay,
    duration,
    ease,
    stagger,
    scrollTrigger,
    scrollTriggerOptions: {
      start: scrollTriggerStart,
      end: scrollTriggerEnd,
      toggleActions: 'play none none reverse',
    },
    disabled,
  });

  const ComponentToRender = Component;

  return (
    <ComponentToRender ref={ref} className={className}>
      {children}
    </ComponentToRender>
  );
}

// ============================================
// COMPONENT: STAGGER GRID
// ============================================

interface StaggerGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: string;
  className?: string;
  scrollTrigger?: boolean;
}

export function StaggerGrid({
  children,
  columns = 3,
  gap = 'gap-4',
  className = '',
  scrollTrigger = false,
}: StaggerGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !isMounted) return;

    const ctx = gsap.context(() => {
      const items = containerRef.current?.querySelectorAll('.stagger-item');
      if (!items || items.length === 0) return;

      gsap.fromTo(
        items,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: scrollTrigger
            ? {
                trigger: containerRef.current,
                start: 'top 80%',
              }
            : undefined,
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [scrollTrigger, isMounted]);

  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[columns];

  return (
    <div ref={containerRef} className={`grid ${gridClass} ${gap} ${className}`}>
      {children}
    </div>
  );
}

// ============================================
// COMPONENT: MICRO INTERACTION
// ============================================

interface MicroInteractionProps {
  children: ReactNode;
  hoverScale?: number;
  hoverY?: number;
  clickScale?: number;
  className?: string;
}

export function MicroInteraction({
  children,
  hoverScale = 1.02,
  hoverY = -2,
  clickScale = 0.98,
  className = '',
}: MicroInteractionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || !isMounted) return;

    const ctx = gsap.context(() => {
      // Hover effect
      gsap.to(element, {
        scale: hoverScale,
        y: hoverY,
        duration: 0.2,
        ease: 'power2.out',
        paused: true,
      });

      element.addEventListener('mouseenter', () => {
        gsap.to(element, { scale: hoverScale, y: hoverY, duration: 0.2, ease: 'power2.out' });
      });

      element.addEventListener('mouseleave', () => {
        gsap.to(element, { scale: 1, y: 0, duration: 0.2, ease: 'power2.out' });
      });

      // Click effect
      element.addEventListener('mousedown', () => {
        gsap.to(element, { scale: clickScale, duration: 0.1, ease: 'power2.out' });
      });

      element.addEventListener('mouseup', () => {
        gsap.to(element, { scale: hoverScale, duration: 0.1, ease: 'power2.out' });
      });
    }, ref);

    return () => ctx.revert();
  }, [hoverScale, hoverY, clickScale, isMounted]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

// ============================================
// COMPONENT: PARALLAX SECTION
// ============================================

interface ParallaxSectionProps {
  children: ReactNode;
  speed?: number;
  direction?: 'up' | 'down';
  className?: string;
}

export function ParallaxSection({
  children,
  speed = 0.5,
  direction = 'up',
  className = '',
}: ParallaxSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!ref.current || !isMounted) return;

    const ctx = gsap.context(() => {
      const yPercent = direction === 'up' ? -100 * speed : 100 * speed;

      gsap.to(ref.current, {
        yPercent,
        ease: 'none',
        scrollTrigger: {
          trigger: ref.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });
    }, ref);

    return () => ctx.revert();
  }, [speed, direction, isMounted]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

// ============================================
// HOOK: SCROLL PROGRESS
// ============================================

export function useScrollProgress(triggerRef: React.RefObject<HTMLElement>) {
  const progressRef = useRef(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!triggerRef.current || !isMounted) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: triggerRef.current,
        start: 'top top',
        end: 'bottom top',
        onUpdate: (self) => {
          progressRef.current = self.progress;
        },
      });
    }, triggerRef);

    return () => ctx.revert();
  }, [triggerRef, isMounted]);

  return progressRef;
}

// ============================================
// UTILITY: CHECK PREFERS REDUCED MOTION
// ============================================

export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

// ============================================
// EXPORTS
// ============================================

export { ANIMATIONS, ScrollTrigger };
export type { AnimationType, UseMotionOptions };
