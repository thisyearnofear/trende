'use client';

import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { useTheme } from './ThemeProvider';
import { usePrefersReducedMotion } from './Motion';
import { cn } from '@/lib/utils';
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
  agreementScore?: number;  // 0-1, used for proactive suggestion
  onSuggestOracle?: () => void;  // called when agent suggests oracle staging
}

// Trende's personality-driven messages based on state
const personaMessages = {
  idle: [
    "I'm Trende. Ready to hunt for signals across the social graph.",
    "What conviction are we testing today?",
    "Every completed run keeps a verification trail for later review.",
  ],
  listening: [
    "Interesting angle...",
    "I'm parsing your thesis...",
    "Scanning for key entities...",
  ],
  thinking: [
    "Calculating optimal search strategy...",
    "Selecting the best data sources for this query...",
    "Initializing proof pipeline...",
  ],
  processing: [
    "Hetzner runtime is executing the research workflow and collecting proof metadata.",
    "Server-side integrity checks are validating deterministic execution boundaries.",
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
    "Proof payload assembly is binding output hashes to model-provider metadata.",
    "Architect stage is structuring a shareable research report from validated findings.",
    "Proof signing is sealing the result so provenance can be verified later.",
    "Wallet-bound persistence layer is preparing save-ready research records.",
    "Pipeline finalization complete. Persisting telemetry and preparing UI payload.",
  ],
  complete: [
    "Analysis complete. Your conviction brief is ready.",
    "Server verification complete. Results are ready.",
    "Found strong signal convergence. Check the report.",
  ],
  error: [
    "Hit a snag in the pipeline. Retrying...",
    "Proof pipeline unstable. Retrying server-side validation...",
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

function NeuralFlux() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 z-0">
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500 rounded-full blur-[60px] animate-pulse" />
      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-violet-500 rounded-full blur-[60px] animate-pulse" style={{ animationDelay: '1s' }} />
    </div>
  );
}

export function AgentPersona({
  status,
  progress = 0,
  message,
  agreementScore = 0,
  onSuggestOracle,
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
  const [decisionLog, setDecisionLog] = useState<{ text: string; ts: string }[]>([]);
  const [showDecisionLog, setShowDecisionLog] = useState(false);
  const [suggestShown, setSuggestShown] = useState(false);

  useEffect(() => {
    if (status !== 'processing') return;
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    const intervalMs = prefersReducedMotion ? 3200 : isMobile ? 2800 : 2200;
    const interval = setInterval(() => setMessageTick((n) => n + 1), intervalMs);
    return () => clearInterval(interval);
  }, [status, prefersReducedMotion]);

  // Build decision log from processing messages
  useEffect(() => {
    if (status !== 'processing' || !displayMessage || displayMessage === decisionLog[decisionLog.length - 1]?.text) return;
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDecisionLog(prev => [...prev.slice(-19), { text: displayMessage, ts }]);
  }, [displayMessage, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Proactive oracle suggestion on completion
  useEffect(() => {
    if (status === 'complete' && agreementScore >= 0.7 && onSuggestOracle && !suggestShown) {
      setSuggestShown(true);
    }
  }, [status, agreementScore, onSuggestOracle, suggestShown]);

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
      className={cn(
        "flex flex-col items-center sm:flex-row sm:items-start gap-4 p-5 sm:p-7 glass border-white/10 relative overflow-hidden transition-all duration-300 group",
        isSoft ? "soft-ui-out border-0" : "border-white/10"
      )}
      style={{
        boxShadow: isSoft
          ? (isHovered ? 'var(--soft-shadow-in)' : 'var(--soft-shadow-out)')
          : (isHovered ? '0 0 30px rgba(6, 182, 212, 0.15)' : 'none'),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {status === 'processing' && <NeuralFlux />}

      {/* Avatar Container */}
      <div className="relative shrink-0 z-10">
        <div
          ref={avatarRef}
          className={cn(
            "w-20 h-20 sm:w-24 sm:h-24 bg-black/40 border border-white/10 rounded-2xl overflow-hidden flex items-center justify-center relative shadow-2xl transition-transform group-hover:scale-105",
            isSoft ? "soft-ui-out border-0" : "bg-black/40 border-white/10 shadow-2xl"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 via-transparent to-violet-500/20" />
          <Bot className="w-12 h-12 sm:w-14 h-14 text-[var(--accent-cyan)] z-10 fill-cyan-400/5" />

          {/* Status glow circle */}
          <div className={cn(
            `absolute bottom-2 right-2 w-4 h-4 rounded-full ${config.color} z-20`,
            !isSoft && "shadow-[0_0_12px_rgba(0,0,0,0.5)] border-2 border-white/20"
          )} />
        </div>
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0 space-y-3 z-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent-cyan)]">Agent // Trende</span>
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
            isSoft ? "soft-ui-in text-[var(--text-secondary)]" : "bg-white/5 border border-white/10 text-white/60"
          )}>
            <div className={`w-1.5 h-1.5 rounded-full ${config.color} animate-pulse`} />
            {config.label}
          </div>
          {status === 'processing' && (
            <div className={cn(
              "text-[10px] font-mono px-2 py-0.5 rounded border",
              isSoft ? "text-[var(--accent-emerald)] bg-[var(--accent-emerald)]/5 border-[var(--accent-emerald)]/20" : "text-emerald-400 bg-emerald-500/5 border-emerald-500/20"
            )}>
              {progress}% SYNC
            </div>
          )}
        </div>

        <div className="relative">
          <p
            ref={messageRef}
            className={cn(
              "text-sm sm:text-base font-mono leading-relaxed min-h-[3em] selection:bg-cyan-500/30",
              isSoft ? "text-[var(--text-primary)]" : "text-white/90"
            )}
          >
            {displayMessage}
            {isTyping && <span className={cn(
              `inline-block w-2 h-4 ml-1 bg-[var(--accent-cyan)] align-middle`,
              !prefersReducedMotion && (isSoft ? "animate-pulse" : "animate-pulse text-shadow-cyan")
            )} />}
          </p>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-4 pt-2">
          <StatusIcon className={`w-4 h-4 ${config.color.replace('bg-', 'text-')} opacity-80`} />
          {status === 'processing' && (
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`w-1 h-1 rounded-full bg-[var(--accent-cyan)]/60 ${prefersReducedMotion ? '' : 'animate-bounce'}`} style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}
          {decisionLog.length > 0 && (
            <button
              onClick={() => setShowDecisionLog(s => !s)}
              className={cn(
                "ml-auto text-[9px] font-black uppercase tracking-widest transition-colors",
                isSoft ? "text-[var(--text-muted)] hover:text-[var(--accent-cyan)]" : "text-white/20 hover:text-cyan-400/60"
              )}
            >
              {showDecisionLog ? 'Hide Log' : `Decision Log (${decisionLog.length})`}
            </button>
          )}
        </div>

        {/* Proactive suggestion — agent speaks first */}
        {suggestShown && onSuggestOracle && (
          <div className={cn(
            "mt-3 flex items-start gap-3 p-3 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-500",
            isSoft ? "soft-ui-in" : "bg-cyan-500/5 border border-cyan-500/20"
          )}>
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-cyan)] mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className={cn(
                "text-[10px] font-mono leading-relaxed",
                isSoft ? "text-[var(--text-primary)]" : "text-cyan-300"
              )}>
                High signal consensus detected ({Math.round(agreementScore * 100)}% agreement). Should I stage this on-chain for verifiable settlement?
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { onSuggestOracle(); setSuggestShown(false); }}
                  className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-colors",
                    isSoft ? "soft-ui-out text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/5" : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                  )}
                >
                  Yes, Stage Oracle
                </button>
                <button
                  onClick={() => setSuggestShown(false)}
                  className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-colors",
                    isSoft ? "text-[var(--text-muted)] hover:text-[var(--text-primary)]" : "text-white/20 hover:text-white/40"
                  )}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable decision log */}
        {showDecisionLog && decisionLog.length > 0 && (
          <div className={cn(
            "mt-3 max-h-32 overflow-y-auto space-y-1 font-mono text-[9px] pt-3",
            isSoft ? "border-t border-[var(--text-muted)]/10" : "border-t border-white/5"
          )}>
            {decisionLog.map((entry, i) => (
              <div key={i} className={cn(
                "flex gap-2 transition-colors",
                isSoft ? "text-[var(--text-secondary)] hover:text-[var(--text-primary)]" : "text-white/30 hover:text-white/50"
              )}>
                <span className={cn(
                  "shrink-0",
                  isSoft ? "text-[var(--accent-cyan)]/60" : "text-cyan-400/40"
                )}>{entry.ts}</span>
                <span>{entry.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// Compact version for inline use
export function AgentBadge({ status }: { status: AgentPersonaProps['status'] }) {
  const { isSoft } = useTheme();
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
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full",
      isSoft ? "soft-ui-out" : "bg-slate-900 border border-slate-800"
    )}>
      <Bot className="w-4 h-4 text-[var(--accent-cyan)]" />
      <span className={cn("text-xs font-medium", isSoft ? "text-[var(--text-primary)]" : "text-slate-300")}>Trende</span>
      <div className={`w-2 h-2 rounded-full ${config.color} ${status === 'processing' ? 'animate-pulse' : ''}`} />
      <span className={cn("text-[10px] uppercase", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>{config.label}</span>
    </div>
  );
}
