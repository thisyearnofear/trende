'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { gsap } from 'gsap';

// Character set for scramble effect (techy characters)
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*<>?';

// Theme-aware color mapping using CSS variables
const THEME_COLORS: Record<string, string> = {
  cyan: 'var(--accent-cyan)',
  emerald: 'var(--accent-emerald)',
  amber: 'var(--accent-amber)',
  rose: 'var(--accent-rose)',
  violet: 'var(--accent-violet)',
};

interface BaseProps {
  className?: string;
  /** Theme color key - uses CSS variables for theme support */
  color?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
}

interface ScrambleTextProps extends BaseProps {
  text: string;
  duration?: number;
  delay?: number;
  onHover?: boolean;
  /** Change this value to re-trigger the scramble animation */
  trigger?: number | string;
}

export function ScrambleText({
  text,
  className = '',
  duration = 0.8,
  delay = 0,
  onHover = false,
  color = 'cyan',
  trigger,
}: ScrambleTextProps) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const [displayText, setDisplayText] = useState<string>(text);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isAnimating) {
      setDisplayText(text);
    }
  }, [text, isAnimating]);

  const scramble = useCallback(() => {
    if (!elementRef.current || isAnimating) return;
    
    setIsAnimating(true);
    const originalText = text;
    const length = originalText.length;
    let iterations = 0;
    const maxIterations = Math.floor(duration * 60); // 60fps
    const characters = SCRAMBLE_CHARS;
    
    const frame = () => {
      iterations++;
      
      const scrambled = originalText
        .split('')
        .map((char, index) => {
          if (char === ' ') return ' ';
          if (index < (iterations / (maxIterations / length))) {
            return char;
          }
          return characters[Math.floor(Math.random() * characters.length)];
        })
        .join('');

      setDisplayText(scrambled);

      if (iterations < maxIterations) {
        requestAnimationFrame(frame);
      } else {
        setDisplayText(originalText);
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(frame);
  }, [text, duration, isAnimating]);

  // Initial animation on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      scramble();
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [scramble, delay]);

  // Trigger-driven re-scramble
  const prevTriggerRef = useRef<number | string | undefined>(undefined);
  useEffect(() => {
    if (trigger === undefined) return;
    if (trigger === prevTriggerRef.current) return;
    prevTriggerRef.current = trigger;
    scramble();
  }, [trigger, scramble]);

  // Hover animation
  const handleMouseEnter = useCallback(() => {
    if (onHover) {
      scramble();
    }
  }, [onHover, scramble]);

  return (
    <span
      ref={elementRef}
      className={`inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      style={{ color: THEME_COLORS[color] }}
    >
      {displayText}
    </span>
  );
}

interface ScrambleWordsProps extends BaseProps {
  words: { text: string; highlight?: boolean }[];
  stagger?: number;
}

export function ScrambleWords({
  words,
  className = '',
  stagger = 0.1,
  color = 'cyan',
}: ScrambleWordsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      const spans = containerRef.current?.querySelectorAll('.word');
      if (!spans || spans.length === 0) return;

      // Get theme color
      const themeColor = THEME_COLORS[color];

      // Set highlight color on elements
      spans.forEach((span) => {
        const isHighlighted = span.classList.contains('highlighted');
        if (isHighlighted && themeColor) {
          (span as HTMLElement).style.color = themeColor;
        }
      });

      // Create timeline with stagger
      const tl = gsap.timeline({ delay: 0.3 });

      spans.forEach((span, i) => {
        const originalText = span.getAttribute('data-original') || span.textContent;
        
        tl.to(span, {
          duration: 0.1,
          onStart: () => {
            const chars = SCRAMBLE_CHARS;
            let iterations = 0;
            const maxIterations = 15;
            
            const frame = () => {
              iterations++;
              const scrambled = originalText
                .split('')
                .map((char) => {
                  if (char === ' ') return ' ';
                  if (iterations >= maxIterations) return char;
                  return chars[Math.floor(Math.random() * chars.length)];
                })
                .join('');
              
              (span as HTMLSpanElement).textContent = scrambled;
              
              if (iterations < maxIterations) {
                requestAnimationFrame(frame);
              } else {
                (span as HTMLSpanElement).textContent = originalText;
              }
            };
            requestAnimationFrame(frame);
          },
          delay: i * stagger,
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, [stagger, color]);

  return (
    <div ref={containerRef} className={className}>
      {words.map((word, i) => (
        <span
          key={i}
          data-original={word.text}
          className={`word inline-block mr-[0.25em] ${word.highlight ? 'highlighted' : ''}`}
        >
          {word.text}
        </span>
      ))}
    </div>
  );
}

interface MarqueeTextProps extends BaseProps {
  text: string;
  direction?: 'left' | 'right';
  speed?: number;
}

export function MarqueeText({
  text,
  className = '',
  direction = 'left',
  speed = 30,
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !textRef.current) return;

    const textWidth = textRef.current.offsetWidth;
    const containerWidth = containerRef.current.offsetWidth;
    
    // Only animate if text is wider than container
    if (textWidth <= containerWidth) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        textRef.current,
        { x: direction === 'left' ? containerWidth : -textWidth },
        {
          x: direction === 'left' ? -textWidth : containerWidth,
          duration: (textWidth + containerWidth) / (speed * 60),
          repeat: -1,
          ease: 'none',
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [text, direction, speed]);

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      <div ref={textRef} className="inline-block whitespace-nowrap">
        {text}
      </div>
    </div>
  );
}

// CSS-only glow effect using CSS variables (no premium GSAP plugins needed)
interface GlowTextProps extends BaseProps {
  text: string;
}

export function GlowText({
  text,
  className = '',
  color = 'cyan',
}: GlowTextProps) {
  // Map color to CSS class - all themes use CSS variables
  const glowClass = `animate-glow-${color}`;

  return (
    <span className={`inline-block ${className} ${glowClass}`} style={{ color: THEME_COLORS[color] }}>
      {text}
    </span>
  );
}
