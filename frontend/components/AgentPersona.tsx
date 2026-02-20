'use client';

import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { useTheme } from './ThemeProvider';
import { usePrefersReducedMotion } from './Motion';
import { 
  Bot, 
  Shield, 
  Lock,
  Sparkles,
  Radio
} from 'lucide-react';

interface AgentPersonaProps {
  status: 'idle' | 'listening' | 'thinking' | 'processing' | 'complete' | 'error';
  progress?: number;
  currentStage?: string;
  message?: string;
}

// Trende's personality-driven messages based on state
const personaMessages = {
  idle: [
    "I'm Trende. Ready to hunt for signals across the social graph.",
    "What conviction are we testing today?",
    "I run in a TEE - your queries stay encrypted end-to-end.",
  ],
  listening: [
    "Interesting angle...",
    "I'm parsing your thesis...",
    "Scanning for key entities...",
  ],
  thinking: [
    "Calculating optimal search strategy...",
    "Selecting the best data sources for this query...",
    "Initializing secure enclave...",
  ],
  processing: [
    "Trusted Execution Environment (TEE) is isolating this workflow from host tampering.",
    "EigenCompute enclave policy checks are validating deterministic execution boundaries.",
    "Connectors are harvesting source data and normalizing it into comparable signal objects.",
    "Tabstack web research is extracting long-form evidence for deeper source grounding.",
    "Rate-limiter and source checks are reducing spam/noise before scoring begins.",
    "Venice route is generating an independent thesis to reduce single-model bias.",
    "OpenRouter lanes are running model diversity sweeps for disagreement detection.",
    "AIsA route is adding an alternate inference path to strengthen consensus breadth.",
    "Cross-model consensus is running to compare independent model outputs for overlap.",
    "Divergence analysis is identifying where models disagree and why confidence may drop.",
    "Claim-level triangulation is ranking evidence by recency, specificity, and corroboration.",
    "Evidence weighting is combining freshness, breadth, and agreement into confidence.",
    "Attestation payload assembly is binding output hashes to model-provider metadata.",
    "Architect stage is structuring a shareable brief + forge payload from validated findings.",
    "Attestation is signing the result so provenance can be verified later.",
    "Wallet-bound persistence layer is preparing save-ready research records.",
    "Pipeline finalization complete. Persisting telemetry and preparing UI payload.",
  ],
  complete: [
    "Analysis complete. Your conviction brief is ready.",
    "TEE attestation signed. Results are verifiable.",
    "Found strong signal convergence. Check the Forge.",
  ],
  error: [
    "Hit a snag in the pipeline. Retrying...",
    "TEE connection unstable. Falling back to local validation...",
  ],
};

// Get message based on progress for processing state
function getProcessingMessage(progress: number): string {
  const messages = personaMessages.processing;
  const index = Math.min(
    Math.floor((progress / 100) * messages.length),
    messages.length - 1
  );
  return messages[index];
}

export function AgentPersona({ 
  status, 
  progress = 0, 
  message 
}: AgentPersonaProps) {
  const { isSoft } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const [displayMessage, setDisplayMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [messageTick, setMessageTick] = useState(0);
  const lastTargetMessageRef = useRef('');

  useEffect(() => {
    if (status !== 'processing') return;
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const intervalMs = prefersReducedMotion ? 3200 : isMobile ? 2800 : 2200;
    const interval = setInterval(() => setMessageTick((n) => n + 1), intervalMs);
    return () => clearInterval(interval);
  }, [status, prefersReducedMotion]);

  // Animate avatar based on status
  useEffect(() => {
    if (!avatarRef.current) return;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        return;
      }
      if (status === 'processing') {
        // Active processing animation
        gsap.to(avatarRef.current, {
          boxShadow: '0 0 60px rgba(6, 182, 212, 0.5)',
          scale: 1.05,
          duration: 1,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      } else if (status === 'thinking') {
        gsap.to(avatarRef.current, {
          rotateY: 10,
          duration: 0.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      } else {
        // Idle breathing
        gsap.to(avatarRef.current, {
          boxShadow: '0 0 30px rgba(6, 182, 212, 0.2)',
          duration: 2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }
    });

    return () => ctx.revert();
  }, [status, prefersReducedMotion]);

  // Typewriter effect for messages
  useEffect(() => {
    const targetMessage =
      message ||
      (status === 'processing'
        ? personaMessages.processing[
            (Math.floor((progress / 100) * personaMessages.processing.length) + messageTick) %
              personaMessages.processing.length
          ] || getProcessingMessage(progress)
        : personaMessages[status][
            Math.floor(Math.random() * personaMessages[status].length)
          ]);

    if (!targetMessage || targetMessage === lastTargetMessageRef.current) return;
    lastTargetMessageRef.current = targetMessage;

    setIsTyping(true);
    let currentIndex = 0;
    
    // Smooth transition between messages if not empty
    const charMs = prefersReducedMotion ? 42 : 26;
    const typeInterval = setInterval(() => {
      if (currentIndex < targetMessage.length) {
        setDisplayMessage(targetMessage.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
      }
    }, charMs);
    return () => clearInterval(typeInterval);
  }, [status, progress, message, messageTick, prefersReducedMotion]);

  // Status indicator config
  const statusConfig = {
    idle: { color: 'bg-slate-500', icon: Bot, label: 'Standby' },
    listening: { color: 'bg-cyan-400', icon: Bot, label: 'Listening' },
    thinking: { color: 'bg-amber-400', icon: Sparkles, label: 'Planning' },
    processing: { color: 'bg-emerald-400', icon: Radio, label: 'Processing' },
    complete: { color: 'bg-emerald-500', icon: Shield, label: 'Complete' },
    error: { color: 'bg-rose-500', icon: Lock, label: 'Error' },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div 
      ref={containerRef} 
      className="flex flex-col items-center sm:flex-row sm:items-start gap-4 p-4 sm:p-6 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] transition-all duration-300" 
      style={{ 
        boxShadow: isSoft
          ? (isHovered ? 'var(--soft-shadow-in)' : 'var(--soft-shadow-out)')
          : (isHovered ? '8px 8px 0px 0px var(--accent-cyan)' : '4px 4px 0px 0px var(--shadow-color)'),
        transform: !isSoft && isHovered ? 'translate(-2px, -2px)' : 'none'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar Container */}
      <div className="relative shrink-0">
        <div 
          ref={avatarRef}
          className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--bg-tertiary)] border-2 border-[var(--border-color)] overflow-hidden flex items-center justify-center relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-[var(--accent-cyan)]/20 to-transparent" />
          <Bot className="w-10 h-10 sm:w-12 h-12 text-[var(--accent-cyan)] z-10" />
          
          {/* Status badge on avatar */}
          <div className={`absolute bottom-0 right-0 w-4 h-4 sm:w-5 sm:h-5 ${config.color} border-2 border-[var(--border-color)] z-20`} />
        </div>
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-[var(--accent-cyan)]">Agent // Trende</span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--bg-primary)] border border-[var(--border-color)] text-[10px] font-mono">
            <div className={`w-1.5 h-1.5 rounded-full ${config.color} animate-pulse`} />
            <span className="text-[var(--text-secondary)]">{config.label.toUpperCase()}</span>
          </div>
          {status === 'processing' && (
            <div className="text-[10px] font-mono text-[var(--accent-emerald)] bg-[var(--bg-primary)] px-2 py-0.5 border border-[var(--accent-emerald)]/30">
              {progress}%
            </div>
          )}
        </div>

        <div className="relative">
          <p 
            ref={messageRef}
            className="text-sm sm:text-base font-mono leading-relaxed text-[var(--text-primary)] min-h-[3em]"
          >
            {displayMessage}
            {isTyping && <span className={`inline-block w-2 h-4 ml-1 bg-[var(--accent-cyan)] ${prefersReducedMotion ? '' : 'animate-pulse'} align-middle`} />}
          </p>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-3 pt-2">
          <StatusIcon className={`w-4 h-4 ${config.color.replace('bg-', 'text-')}`} />
          {status === 'processing' && (
            <div className="flex gap-1">
              {[1, 2, 3].map(i => (
                <div key={i} className={`w-1 h-1 bg-[var(--accent-cyan)] ${prefersReducedMotion ? '' : 'sm:animate-bounce'}`} style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// Compact version for inline use
export function AgentBadge({ status }: { status: AgentPersonaProps['status'] }) {
  const statusConfig = {
    idle: { color: 'bg-slate-500', label: 'Standby' },
    listening: { color: 'bg-cyan-400', label: 'Listening' },
    thinking: { color: 'bg-amber-400', label: 'Planning' },
    processing: { color: 'bg-emerald-400', label: 'Processing' },
    complete: { color: 'bg-emerald-500', label: 'Complete' },
    error: { color: 'bg-rose-500', label: 'Error' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
      <Bot className="w-4 h-4 text-cyan-400" />
      <span className="text-xs font-medium text-slate-300">Trende</span>
      <div className={`w-2 h-2 rounded-full ${config.color} ${status === 'processing' ? 'animate-pulse' : ''}`} />
      <span className="text-[10px] text-slate-500 uppercase">{config.label}</span>
    </div>
  );
}
