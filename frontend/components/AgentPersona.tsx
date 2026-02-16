'use client';

import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { 
  Bot, 
  Shield, 
  Fingerprint, 
  Cpu, 
  Eye, 
  Lock,
  Sparkles,
  MessageSquare,
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
    "🕵️ Scouting the landscape across multiple platforms...",
    "🔍 Harvesting signals from X, LinkedIn, and news sources...",
    "🧠 Cross-referencing claims for convergence...",
    "⚖️ Weighting source credibility...",
    "🔬 Running multi-model consensus inside TEE...",
    "📝 Synthesizing findings into actionable intelligence...",
    "🔒 Generating cryptographic attestation...",
    "✓ Sealing results with EigenCompute...",
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
  currentStage,
  message 
}: AgentPersonaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const [displayMessage, setDisplayMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Animate avatar based on status
  useEffect(() => {
    if (!avatarRef.current) return;

    const ctx = gsap.context(() => {
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
  }, [status]);

  // Typewriter effect for messages
  useEffect(() => {
    let targetMessage = message;
    
    if (!targetMessage) {
      if (status === 'processing') {
        targetMessage = getProcessingMessage(progress);
      } else {
        const messages = personaMessages[status];
        targetMessage = messages[Math.floor(Math.random() * messages.length)];
      }
    }

    if (targetMessage === displayMessage) return;

    setIsTyping(true);
    let currentIndex = 0;
    setDisplayMessage('');

    const typeInterval = setInterval(() => {
      if (currentIndex < targetMessage.length) {
        setDisplayMessage(targetMessage.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
      }
    }, 30);

    return () => clearInterval(typeInterval);
  }, [status, progress, message]);

  // Status indicator config
  const statusConfig = {
    idle: { color: 'bg-slate-500', icon: Bot, label: 'Standby' },
    listening: { color: 'bg-cyan-400', icon: EarIcon, label: 'Listening' },
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
      className="flex items-start gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div
          ref={avatarRef}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg"
          style={{ perspective: '1000px' }}
        >
          <Bot className="w-7 h-7 text-white" />
        </div>
        
        {/* Status indicator dot */}
        <div className={`
          absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center
          ${config.color}
        `}>
          <StatusIcon className="w-2.5 h-2.5 text-slate-900" />
        </div>

        {/* Orbiting particles when processing */}
        {status === 'processing' && (
          <>
            <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-300" />
            </div>
            <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}>
              <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-1 h-1 rounded-full bg-emerald-300" />
            </div>
          </>
        )}
      </div>

      {/* Message bubble */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-bold text-slate-200">Trende</span>
          <span className={`
            text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider
            ${status === 'processing' ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-slate-800 text-slate-500'}
          `}>
            {config.label}
          </span>
          {status === 'processing' && progress > 0 && (
            <span className="text-xs text-cyan-400 font-mono">{progress}%</span>
          )}
        </div>
        
        <p 
          ref={messageRef}
          className="text-sm text-slate-300 leading-relaxed"
        >
          {displayMessage}
          {isTyping && (
            <span className="inline-block w-2 h-4 bg-cyan-400 ml-1 animate-pulse align-middle" />
          )}
        </p>

        {/* TEE Badge */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Fingerprint className="w-3 h-3" />
            <span>EigenCompute TEE</span>
          </div>
          <div className="w-px h-3 bg-slate-700" />
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Eye className="w-3 h-3" />
            <span>Zero-knowledge</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom ear icon for listening state
function EarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <path d="M4 2C2.8 3.7 2 5.7 2 8" />
      <path d="M22 8c0-2.3-.8-4.3-2-6" />
    </svg>
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
