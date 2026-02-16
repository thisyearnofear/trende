'use client';

import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface ParallaxImageProps {
  src: string;
  alt: string;
  className?: string;
  overlayColor?: string;
}

export function ParallaxImage({ src, className = '', overlayColor = 'bg-cyan-500/10' }: ParallaxImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !imageRef.current) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      }
    });

    tl.fromTo(imageRef.current, 
      { y: '-10%' }, 
      { y: '10%', ease: 'none' }
    );

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={`relative overflow-hidden border-2 border-white ${className}`}
      style={{ boxShadow: '6px 6px 0px 0px #00ffff' }}
    >
      <div 
        ref={imageRef}
        className="absolute inset-0 w-full h-[120%] bg-cover bg-center"
        style={{ backgroundImage: `url(${src})` }}
      />
      <div className={`absolute inset-0 ${overlayColor} mix-blend-overlay`} />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent opacity-60" />
    </div>
  );
}
