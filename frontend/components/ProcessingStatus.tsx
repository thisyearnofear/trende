"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { StreamEvent, QueryStatus } from "@/lib/types";
import { estimateMissionRuntime } from "@/lib/runtimeEstimate";
import {
  Terminal,
  Fingerprint,
  CheckCircle2,
  Circle,
  Loader2,
  Clock3,
} from "lucide-react";
import { gsap } from "gsap";
import { TerminalLog } from "./TypewriterText";
import { AgentPersona } from "./AgentPersona";
import { Card, Progress, Badge } from "./DesignSystem";
import { useTheme } from "./ThemeProvider";
import { usePrefersReducedMotion } from "./Motion";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScrambleText } from "./ScrambleText";

interface ProcessingStatusProps {
  status: QueryStatus | null;
  progress: number;
  events: StreamEvent[];
  isProcessing: boolean;
  elapsedSeconds?: number;
  queryData?: {
    topic: string;
    platforms: string[];
    models?: string[];
    threshold?: number;
  };
}

const STAGES = [
  { id: "planner", label: "PLAN", description: "Strategy & Source Selection", detail: "Prompt decomposition, source selection, and query design." },
  { id: "researcher", label: "HARVEST", description: "Data Mining & Social Signal", detail: "Parallel connector execution with rate limits, caching, and source normalization." },
  { id: "validator", label: "VALIDATE", description: "Truth Verification", detail: "Cross-source reliability scoring and noise reduction." },
  { id: "consensus", label: "FORGE", description: "Multi-Model Consensus", detail: "Divergence analysis + neutral synthesis across selected models." },
  { id: "architect", label: "ATTEST", description: "TEE Proof Signing", detail: "Final payload shaping, trace metadata, and proof-ready output." },
];

const SIMULATED_LOGS: Record<string, string[]> = {
  planner: [
    "DECODING MISSION PARAMETERS...",
    "MAPPING SEARCH SPACE...",
    "IDENTIFYING CORE ENTITIES...",
    "OPTIMIZING QUERY STRATEGY...",
    "ANALYZING INTENT VECTORS...",
  ],
  researcher: [
    "CONNECTING TO TWITTER API (RAPIDAPI)...",
    "SCRAPING NEWSAPI ENDPOINTS...",
    "QUERYING TABSTACK WEB SOURCE...",
    "CONSULTING WIKIMEDIA EVENT STREAM FOR BREAKOUT NARRATIVES...",
    "PULLING COINGECKO SNAPSHOTS FOR MARKET CONTEXT...",
    "EXTRACTING LONG-FORM CONTEXT VIA TABSTACK MARKDOWN...",
    "SCANNING HACKER NEWS + STACKEXCHANGE FOR EARLY TECH SIGNALS...",
    "PARSING UNSTRUCTURED DATA...",
    "DETECTING VIRAL SIGNALS...",
    "FILTERING PLATFORM NOISE...",
    "NORMALIZING CROSS-PLATFORM SOURCE METADATA...",
  ],
  validator: [
    "CROSS-REFERENCING SOURCES...",
    "CALCULATING CONFIDENCE SCORE...",
    "DETECTING HALLUCINATIONS...",
    "VERIFYING CITATIONS...",
    "AUDITING DATA INTEGRITY...",
  ],
  consensus: [
    "INITIALIZING CONSENSUS FORGE...",
    "ROUTING PRIMARY INFERENCE THROUGH VENICE PRIVACY LANE...",
    "CONSULTING VENICE AI (PRIVACY-FIRST)...",
    "CONSULTING AISA ROUTE...",
    "CONSULTING OPENROUTER LLAMA 70B...",
    "CONSULTING OPENROUTER HERMES...",
    "CONSULTING OPENROUTER STEPFUN...",
    "AGGREGATING MULTI-MODEL OUTPUTS...",
    "RESOLVING DIVERGENT SIGNALS...",
    "RANKING CLAIMS BY CROSS-MODEL AGREEMENT...",
  ],
  architect: [
    "SYNTHESIZING SOVEREIGN REPORT...",
    "ENCODING VERIFIABLE EVIDENCE REFERENCES...",
    "BINDING EVIDENCE HASHES TO FINAL MANIFEST...",
    "GENERATING EIGEN PROOF...",
    "REQUESTING EIGENCLOUD ATTESTATION QUOTE...",
    "SIGNING ATTESTATION PAYLOAD...",
    "ESTABLISHING PROOF OF COMPUTE...",
    "MISSION COMPLETE.",
  ],
};

// ============================================
// STAGE CARD — single source of truth
// ============================================

interface StageCardProps {
  stage: (typeof STAGES)[number];
  band: { stageId: string; min: number; max: number };
  isActive: boolean;
  isComplete: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  variant: "rail" | "grid";
  reducedMotion: boolean;
  activationTick: number;
  softMode: boolean;
}

function NeuralFlux() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute -top-20 -left-20 w-64 h-64 bg-cyan-500 rounded-full blur-[80px]"
      />
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          x: [0, -40, 0],
          y: [0, 60, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute -bottom-20 -right-20 w-80 h-80 bg-violet-600 rounded-full blur-[100px]"
      />
      <motion.div
        animate={{
          opacity: [0.1, 0.3, 0.1],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--accent-cyan)_0%,transparent_70%)] opacity-10"
      />
    </div>
  );
}

function StageCard({
  stage,
  band,
  isActive,
  isComplete,
  isExpanded,
  onSelect,
  variant,
  reducedMotion,
  activationTick,
  softMode,
}: StageCardProps) {
  const isRail = variant === "rail";
  const iconSize = isRail ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      data-stage-id={stage.id}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'text-left transition-all duration-300 relative overflow-hidden',
        isRail ? "w-44 shrink-0 snap-center p-3" : "p-4",
        'glass border-white/10'
      )}
      style={{
        borderColor: isComplete
          ? "var(--accent-emerald)"
          : isActive
            ? "var(--accent-cyan)"
            : "rgba(255,255,255,0.1)",
        boxShadow: isActive
          ? "0 0 20px rgba(0,255,255,0.2)"
          : "none"
      }}
      aria-expanded={isExpanded}
    >
      {isActive && (
        <div className="absolute inset-0 bg-cyan-500/5 animate-pulse" />
      )}

      <div className="flex items-center gap-2 mb-2 relative z-10">
        {isComplete ? (
          <CheckCircle2 className={`${iconSize} text-emerald-400`} />
        ) : isActive ? (
          <div className={`${iconSize} bg-cyan-400 rounded-full shadow-[0_0_8px_var(--accent-cyan)] ${reducedMotion ? "" : "animate-pulse"}`} />
        ) : (
          <Circle className={`${iconSize} text-white/20`} />
        )}
        <span className={cn(
          "text-[10px] font-black uppercase tracking-wider",
          isActive ? "text-cyan-400" : isComplete ? "text-emerald-400" : "text-white/40"
        )}>
          {stage.label}
        </span>
      </div>

      <p className={cn(
        "text-[10px] font-mono relative z-10",
        isActive ? "text-white/90" : "text-white/40",
        isRail ? "line-clamp-2" : "mb-2"
      )}>
        {stage.description}
      </p>

      {!isRail && (
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5 relative z-10">
          <span className="text-[9px] font-black uppercase text-white/20">Est. Window</span>
          <span className="text-[10px] font-mono text-violet-400/70">
            {band.min}s - {band.max}s
          </span>
        </div>
      )}
    </motion.button>
  );
}

// ============================================
// MOBILE RAIL DOT INDICATORS
// ============================================

function RailDots({
  count,
  expandedIndex,
  currentStageIndex,
  onSelect,
}: {
  count: number;
  expandedIndex: number;
  currentStageIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex justify-center gap-2 mt-2 lg:hidden">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          className="w-2 h-2 rounded-full transition-all duration-200"
          style={{
            backgroundColor:
              i < currentStageIndex
                ? "var(--accent-emerald)"
                : i === currentStageIndex
                  ? "var(--accent-cyan)"
                  : i === expandedIndex
                    ? "var(--accent-violet)"
                    : "var(--border-color)",
            transform: i === expandedIndex ? "scale(1.5)" : "scale(1)",
          }}
          aria-label={`Stage ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ============================================
// SPINE SECTION MARKER
// ============================================

function SpineMarker({ lit, color }: { lit: boolean; color: "cyan" | "emerald" | "muted" }) {
  const palette = {
    cyan: { border: "var(--accent-cyan)", bg: "var(--accent-cyan)", shadow: "0 0 8px var(--accent-cyan)" },
    emerald: { border: "var(--accent-emerald)", bg: "var(--accent-emerald)", shadow: "none" },
    muted: { border: "var(--border-color)", bg: "var(--bg-primary)", shadow: "none" },
  };
  const c = lit ? palette[color] : palette.muted;

  return (
    <div
      className="hidden sm:block absolute -left-[30px] top-4 w-3 h-3 border-2 transition-all duration-500 z-10"
      style={{ borderColor: c.border, backgroundColor: c.bg, boxShadow: c.shadow }}
    />
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ProcessingStatus({
  progress,
  events,
  isProcessing,
  elapsedSeconds = 0,
  queryData,
}: ProcessingStatusProps) {
  const { isSoft } = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();
  const currentStageIndex = Math.min(
    Math.floor((progress / 100) * STAGES.length),
    STAGES.length - 1,
  );
  const currentStageId = STAGES[currentStageIndex]?.id || "planner";
  const [activeHash, setActiveHash] = useState("0x...");
  const [simulatedLog, setSimulatedLog] = useState<string | null>(null);
  const [expandedStageId, setExpandedStageId] = useState<string>(currentStageId);
  const [activationTick, setActivationTick] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const revealedRef = useRef<Set<string>>(new Set());
  const initialProgressRef = useRef(progress);
  const mutedTextClass = isSoft ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]";

  useEffect(() => { setExpandedStageId(currentStageId); }, [currentStageId]);
  useEffect(() => { setActivationTick((t) => t + 1); }, [currentStageId]);

  const runtimeEstimate = useMemo(
    () =>
      estimateMissionRuntime({
        platforms: queryData?.platforms || [],
        models: queryData?.models || [],
        relevanceThreshold: queryData?.threshold,
      }),
    [queryData],
  );

  const stageTimeBands = useMemo(() => {
    const perStage = runtimeEstimate.totalSeconds / STAGES.length;
    return STAGES.map((stage, index) => {
      const min = Math.max(5, Math.round(perStage * index));
      const max = Math.max(min + 6, Math.round(perStage * (index + 1)));
      return { stageId: stage.id, min, max };
    });
  }, [runtimeEstimate.totalSeconds]);

  const expandedStage = useMemo(
    () => STAGES.find((s) => s.id === expandedStageId) || STAGES[currentStageIndex],
    [expandedStageId, currentStageIndex],
  );
  const expandedBand = useMemo(
    () => stageTimeBands.find((b) => b.stageId === expandedStage.id),
    [expandedStage.id, stageTimeBands],
  );

  // Hash animation
  useEffect(() => {
    if (!isProcessing) return;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    const intervalMs = prefersReducedMotion ? 260 : isMobile ? 140 : 80;
    const interval = setInterval(() => {
      setActiveHash(
        "0x" +
        Array.from({ length: 12 }, () =>
          Math.floor(Math.random() * 16).toString(16),
        ).join(""),
      );
    }, intervalMs);
    return () => clearInterval(interval);
  }, [isProcessing, prefersReducedMotion]);

  // Simulated telemetry logs
  useEffect(() => {
    if (!isProcessing) return;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    const intervalMs = prefersReducedMotion ? 2000 : isMobile ? 1000 : 700;
    const logs = SIMULATED_LOGS[currentStageId] || SIMULATED_LOGS["planner"];
    const interval = setInterval(() => {
      setSimulatedLog(`[SYSTEM] ${logs[Math.floor(Math.random() * logs.length)]}`);
    }, intervalMs);
    return () => {
      clearInterval(interval);
      setSimulatedLog(null);
    };
  }, [isProcessing, currentStageId, prefersReducedMotion]);

  const terminalEvents = useMemo(() => {
    const filtered = events.filter(
      (e) =>
        !e.message?.match(
          /^(pending|planning|researching|analyzing|processing) \(\d+%\)$/i,
        ),
    );
    const displayEvents = filtered.slice(-6).map((event, index) => ({
      id: `${event.type}-${index}-${event.message?.slice(0, 20) || ""}`,
      message: event.message || "",
      type: (event.type === "error"
        ? "error"
        : event.type === "result"
          ? "success"
          : "info") as "error" | "success" | "info",
    }));
    if (simulatedLog && isProcessing) {
      displayEvents.push({ id: "simulated", message: simulatedLog, type: "info" });
    }
    return displayEvents.slice(-6);
  }, [events, simulatedLog, isProcessing]);

  const getAgentStatus = () => {
    if (!isProcessing) return "idle";
    if (progress < 10) return "thinking";
    if (progress < 100) {
      if (events.length > 0 && events[events.length - 1].message?.includes("Validation"))
        return "thinking";
      return "processing";
    }
    return "complete";
  };

  // Scroll mobile rail to selected stage
  const scrollToStage = useCallback((index: number) => {
    setExpandedStageId(STAGES[index].id);
    if (!railRef.current) return;
    const card = railRef.current.querySelector(`[data-stage-id="${STAGES[index].id}"]`);
    if (card) card.scrollIntoView({ inline: "center", behavior: "smooth" });
  }, []);

  // GSAP: stage reveal animation as progress crosses thresholds
  useEffect(() => {
    if (prefersReducedMotion || !isProcessing) return;

    STAGES.forEach((stage, i) => {
      const threshold = (i / STAGES.length) * 100;
      if (progress < threshold) return;
      if (revealedRef.current.has(stage.id)) return;
      revealedRef.current.add(stage.id);

      // Skip animation for stages already past threshold on mount
      if (threshold <= initialProgressRef.current) return;

      [railRef.current, gridRef.current].forEach((container) => {
        if (!container) return;
        const el = container.querySelector(`[data-stage-id="${stage.id}"]`);
        if (!el) return;
        gsap.fromTo(
          el,
          { scale: 0.92, opacity: 0.5 },
          { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.4)" },
        );
      });
    });
  }, [progress, prefersReducedMotion, isProcessing]);

  // GSAP: pulse glow when active stage changes
  useEffect(() => {
    if (prefersReducedMotion || !isProcessing) return;

    [railRef.current, gridRef.current].forEach((container) => {
      if (!container) return;
      const el = container.querySelector(`[data-stage-id="${currentStageId}"]`);
      if (!el) return;
      gsap.fromTo(
        el,
        { boxShadow: "0 0 0px rgba(0,255,255,0)" },
        {
          boxShadow: "0 0 22px rgba(0,255,255,0.5)",
          duration: 0.4,
          yoyo: true,
          repeat: 1,
          ease: "sine.inOut",
        },
      );
    });
  }, [currentStageId, prefersReducedMotion, isProcessing]);

  // Auto-scroll mobile rail to active stage
  useEffect(() => {
    if (!railRef.current) return;
    const card = railRef.current.querySelector(`[data-stage-id="${currentStageId}"]`);
    if (card) card.scrollIntoView({ inline: "center", behavior: "smooth" });
  }, [currentStageId]);

  const expandedIndex = STAGES.findIndex((s) => s.id === expandedStageId);
  const remaining = Math.max(runtimeEstimate.totalSeconds - elapsedSeconds, 0);

  return (
    <div className="relative">
      {/* Vertical Spine — hidden on small phones to reclaim content width */}
      <div className="hidden sm:block absolute left-[22px] top-0 bottom-0 w-px bg-[var(--border-color)]" />
      <div
        className="hidden sm:block absolute left-[22px] top-0 w-px origin-top transition-transform duration-1000 ease-out"
        style={{
          backgroundColor: "var(--accent-cyan)",
          transform: `scaleY(${Math.min(progress / 100, 1)})`,
          height: "100%",
        }}
      />

      <div className="space-y-6 sm:pl-12">
        {/* ── Section 1: Agent ── */}
        <div
          className="relative animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <SpineMarker
            lit={progress >= 0}
            color={progress >= 20 ? "emerald" : "cyan"}
          />
          <AgentPersona status={getAgentStatus()} progress={progress} />
        </div>

        {/* ── Section 2: Timeline + Inline Brief ── */}
        <div
          className="relative animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "150ms", animationFillMode: "both" }}
        >
          <SpineMarker
            lit={progress >= 20}
            color={progress >= 60 ? "emerald" : progress >= 20 ? "cyan" : "muted"}
          />
          <Card accent="violet" className="p-4 sm:p-5">
            {/* Compact inline brief */}
            {isProcessing && queryData && (
              <div className="mb-4 pb-4 border-b-2 border-[var(--border-color)]">
                <p className="text-sm font-mono italic line-clamp-2 text-[var(--text-primary)] mb-2">
                  &quot;{queryData.topic}&quot;
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="cyan">{queryData.platforms.length} sources</Badge>
                  <Badge variant="amber">{(queryData.models || []).length || 3} models</Badge>
                  <Badge variant="emerald">{Math.round((queryData.threshold || 0.6) * 100)}% threshold</Badge>
                </div>
              </div>
            )}

            {/* Timeline header */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-[var(--accent-violet)]" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider">
                  Mission Timeline
                </h3>
              </div>
              <div className={`flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs font-mono ${mutedTextClass}`}>
                <span>{elapsedSeconds}s</span>
                <span className="hidden sm:inline">elapsed</span>
                <span>•</span>
                <span>~{remaining}s</span>
                <span className="hidden sm:inline">remaining</span>
              </div>
            </div>

            {/* Mobile: snap-scroll rail */}
            <div
              ref={railRef}
              className="lg:hidden flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth overscroll-x-contain scrollbar-hide"
            >
              {STAGES.map((stage, index) => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  band={stageTimeBands[index]}
                  isActive={index === currentStageIndex}
                  isComplete={index < currentStageIndex}
                  isExpanded={expandedStageId === stage.id}
                  onSelect={() => setExpandedStageId(stage.id)}
                  variant="rail"
                  reducedMotion={prefersReducedMotion}
                  activationTick={activationTick}
                  softMode={isSoft}
                />
              ))}
            </div>
            <RailDots
              count={STAGES.length}
              expandedIndex={expandedIndex}
              currentStageIndex={currentStageIndex}
              onSelect={scrollToStage}
            />

            {/* Desktop: 5-col grid */}
            <div ref={gridRef} className="hidden lg:grid grid-cols-5 gap-3">
              {STAGES.map((stage, index) => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  band={stageTimeBands[index]}
                  isActive={index === currentStageIndex}
                  isComplete={index < currentStageIndex}
                  isExpanded={expandedStageId === stage.id}
                  onSelect={() => setExpandedStageId(stage.id)}
                  variant="grid"
                  reducedMotion={prefersReducedMotion}
                  activationTick={activationTick}
                  softMode={isSoft}
                />
              ))}
            </div>

            {/* Active narrative panel */}
            <div className="mt-3 sm:mt-4 border-2 border-[var(--border-color)] bg-[var(--bg-primary)] p-3 sm:p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--accent-violet)]">
                Active Narrative
              </p>
              <h4 className="text-sm font-black uppercase mt-0.5">
                {expandedStage.label}{" // "}{expandedStage.description}
              </h4>
              <p className="mt-2 text-xs font-mono text-[var(--text-secondary)]">
                {expandedStage.detail}
              </p>
              <div className="flex flex-wrap gap-2 mt-2 text-[10px] font-mono">
                <span className="px-2 py-1 border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                  Stage: ~{expandedBand?.min ?? 0}s - {expandedBand?.max ?? 0}s
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Section 3: TEE Terminal ── */}
        <div
          className="relative animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "300ms", animationFillMode: "both" }}
        >
          <SpineMarker
            lit={progress >= 60}
            color={progress >= 100 ? "emerald" : progress >= 60 ? "cyan" : "muted"}
          />
          <Card accent="cyan" shadow="lg">
            {/* Header */}
            <div className="border-b-2 border-[var(--border-color)] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 flex items-center justify-center relative"
                  style={{ backgroundColor: "var(--accent-cyan)" }}
                >
                  <Fingerprint className={`w-5 h-5 text-[var(--bg-primary)] ${prefersReducedMotion ? "" : "animate-pulse"}`} />
                  {isProcessing && !prefersReducedMotion && (
                    <div className="absolute inset-0 border-2 border-[var(--accent-cyan)] animate-ping opacity-30" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black uppercase tracking-wider text-[var(--accent-cyan)]">
                      {isProcessing ? "TEE RUNNING" : "TEE READY"}
                    </h3>
                    {isProcessing && (
                      <Loader2 className="w-3 h-3 animate-spin text-[var(--accent-cyan)]" />
                    )}
                  </div>
                  <p className={`text-xs font-mono flex items-center gap-2 ${mutedTextClass}`}>
                    <span className={`text-emerald-500 ${prefersReducedMotion ? "" : "animate-pulse"}`}>●</span>
                    {activeHash}
                    <span className={`opacity-70 hidden sm:inline ${mutedTextClass}`}>:: EigenCompute Enclave</span>
                  </p>
                </div>
              </div>
              <p className="text-3xl font-black text-[var(--accent-cyan)] tabular-nums">
                {progress}%
              </p>
            </div>

            {/* Progress Bar */}
            <div className="p-4 border-b-2 border-[var(--border-color)]">
              <Progress value={progress} accent="cyan" />
            </div>

            {/* Terminal */}
            {terminalEvents.length > 0 && (
              <div className="p-4">
                <div
                  className="border-2 bg-[var(--bg-primary)]"
                  style={{ borderColor: isSoft ? "var(--text-secondary)" : "var(--text-muted)" }}
                >
                  <div
                    className="flex items-center justify-between px-3 py-2 border-b-2 bg-[var(--bg-secondary)]"
                    style={{ borderColor: isSoft ? "var(--text-secondary)" : "var(--text-muted)" }}
                  >
                    <div className="flex items-center gap-2">
                      <Terminal className={`w-3.5 h-3.5 ${isSoft ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`} />
                      <span className={`text-[10px] font-mono ${isSoft ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                        TEE_TELEMETRY.LOG
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${prefersReducedMotion ? "" : "animate-pulse"}`} />
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/20" />
                    </div>
                  </div>
                  <div className="p-3">
                    <TerminalLog
                      events={terminalEvents}
                      maxHeight="120px"
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
