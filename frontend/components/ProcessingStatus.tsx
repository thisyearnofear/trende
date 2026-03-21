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
  Sparkles,
  BrainCircuit,
  Shield,
} from "lucide-react";
import { gsap } from "gsap";
import { TerminalLog } from "./TypewriterText";
import { AgentPersona } from "./AgentPersona";
import { Card, Progress, Badge } from "./DesignSystem";
import { useTheme } from "./ThemeProvider";
import { usePrefersReducedMotion } from "./Motion";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
  { id: "consensus", label: "SYNTHESIZE", description: "Multi-Model Consensus", detail: "Divergence analysis + neutral synthesis across selected models." },
  { id: "architect", label: "ATTEST", description: "Server Proof Signing", detail: "Final payload shaping, trace metadata, and proof-ready output." },
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
    "INITIALIZING CONSENSUS ENGINE...",
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
    "GENERATING SERVER PROOF...",
    "SEALING HETZNER RUNTIME MANIFEST...",
    "SIGNING PROOF PAYLOAD...",
    "ESTABLISHING PROOF OF SOURCE...",
    "MISSION COMPLETE.",
  ],
};

const STAGE_MILESTONES: Record<string, string> = {
  planner: "Mission intent parsed. Agent is generating source-aware queries.",
  researcher: "Signal harvest phase active. Connectors are executing in parallel.",
  validator: "Truth engine active. Contradictions and low-quality evidence are being filtered.",
  consensus: "Multi-model synthesis underway. Divergence and agreement are being reconciled.",
  architect: "Server-side proof packaging is in progress.",
};

const WAIT_EXPLAINERS = [
  "Why this takes time: each source route has retries, timeout budgets, and quality filtering before synthesis.",
  "Consensus is weighted by source quality, freshness, and model agreement, not just raw volume.",
  "When primary routes fail, Trende triggers fallback paths to avoid single-source blind spots.",
  "Proof is generated after synthesis to bind what was computed and how it was produced.",
];

const WAIT_WAYPOINTS = [
  "Mission parsed and execution lanes allocated.",
  "Cross-platform connectors harvesting in parallel.",
  "Evidence quality checks removing stale/off-topic noise.",
  "Multi-model consensus measuring agreement vs divergence.",
  "Server proof manifest packaged for verification.",
  "Final report + proof manifest delivered to saved research.",
];

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
  softMode: boolean;
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
        softMode ? "soft-ui-out border-0" : "glass border-white/10"
      )}
      style={{
        borderColor: !softMode ? (isComplete
          ? "var(--accent-emerald)"
          : isActive
            ? "var(--accent-cyan)"
            : "rgba(255,255,255,0.1)") : undefined,
        boxShadow: isActive
          ? (softMode ? "var(--soft-shadow-in)" : "0 0 20px rgba(0,255,255,0.2)")
          : (softMode ? "var(--soft-shadow-out)" : "none")
      }}
      aria-expanded={isExpanded}
    >
      {isActive && (
        <div className="absolute inset-0 bg-cyan-500/5 animate-pulse" />
      )}

      <div className="flex items-center gap-2 mb-2 relative z-10">
        {isComplete ? (
          <CheckCircle2 className={cn(iconSize, "text-[var(--accent-emerald)]")} />
        ) : isActive ? (
          <div className={cn(iconSize, "bg-[var(--accent-cyan)] rounded-full", !softMode && "shadow-[0_0_8px_var(--accent-cyan)]", !reducedMotion && "animate-pulse")} />
        ) : (
          <Circle className={cn(iconSize, softMode ? "text-[var(--text-muted)]" : "text-white/20")} />
        )}
        <span className={cn(
          "text-[10px] font-black uppercase tracking-wider",
          isActive ? "text-[var(--accent-cyan)]" : isComplete ? "text-[var(--accent-emerald)]" : (softMode ? "text-[var(--text-muted)]" : "text-white/40")
        )}>
          {stage.label}
        </span>
      </div>

      <p className={cn(
        "text-[10px] font-mono relative z-10",
        isActive ? (softMode ? "text-[var(--text-primary)]" : "text-white/90") : (softMode ? "text-[var(--text-muted)]" : "text-white/40"),
        isRail ? "line-clamp-2" : "mb-2"
      )}>
        {stage.description}
      </p>

      {!isRail && (
        <div className={cn(
          "flex items-center justify-between mt-auto pt-2 relative z-10",
          softMode ? "border-t border-[var(--text-muted)]/10" : "border-t border-white/5"
        )}>
          <span className={cn("text-[9px] font-black uppercase", softMode ? "text-[var(--text-muted)]" : "text-white/20")}>Est. Window</span>
          <span className="text-[10px] font-mono text-[var(--accent-violet)]/70">
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

function TimelineInterlude({
  icon,
  title,
  body,
}: {
  icon: "brain" | "spark" | "shield";
  title: string;
  body: string;
}) {
  const Icon = icon === "brain" ? BrainCircuit : icon === "shield" ? Shield : Sparkles;
  return (
    <div className="relative py-1">
      <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="relative mx-auto w-full max-w-3xl px-3">
        <div className="glass border-white/10 rounded-xl p-3 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">{title}</p>
            <p className="text-xs text-[var(--text-secondary)]">{body}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MilestonePulse({
  text,
  reducedMotion,
}: {
  text: string;
  reducedMotion: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.35, ease: "easeOut" }}
      className="glass border-cyan-500/20 rounded-xl px-3 py-2"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300 mb-1">
        Stage Arrival
      </p>
      <p className="text-xs text-[var(--text-secondary)]">{text}</p>
    </motion.div>
  );
}

function WaitWaypoints({
  progress,
  reducedMotion,
}: {
  progress: number;
  reducedMotion: boolean;
}) {
  const activeIndex = Math.max(
    0,
    Math.min(WAIT_WAYPOINTS.length - 1, Math.floor((progress / 100) * WAIT_WAYPOINTS.length))
  );
  return (
    <div className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl border border-white/10 bg-black/20">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300 mb-2">
        Mission Checkpoints
      </p>
      <div className="space-y-2">
        {WAIT_WAYPOINTS.map((point, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <div key={point} className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 rounded-full shrink-0",
                  done ? "bg-emerald-400" : active ? "bg-cyan-300" : "bg-white/20",
                  active && !reducedMotion && "animate-pulse"
                )}
              />
              <p className={cn("text-xs", done ? "text-emerald-300/80" : active ? "text-cyan-100" : "text-[var(--text-secondary)]")}>
                {point}
              </p>
            </div>
          );
        })}
      </div>
    </div>
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
  const [explainerIndex, setExplainerIndex] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const revealedRef = useRef<Set<string>>(new Set());
  const initialProgressRef = useRef(progress);
  const stageChangeTickRef = useRef(0);
  const [stagePulseTick, setStagePulseTick] = useState(0);
  const mutedTextClass = isSoft ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]";

  useEffect(() => { setExpandedStageId(currentStageId); }, [currentStageId]);
  useEffect(() => {
    stageChangeTickRef.current += 1;
    setStagePulseTick(stageChangeTickRef.current);
  }, [currentStageId]);

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

  useEffect(() => {
    if (!isProcessing) return;
    const intervalMs = prefersReducedMotion ? 6000 : 4200;
    const timer = setInterval(() => {
      setExplainerIndex((prev) => (prev + 1) % WAIT_EXPLAINERS.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isProcessing, prefersReducedMotion]);

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
  const overtime = elapsedSeconds > runtimeEstimate.totalSeconds;
  const clockTone = overtime ? "text-rose-300 border-rose-400/40 bg-rose-500/10" : remaining < 90 ? "text-amber-300 border-amber-400/40 bg-amber-500/10" : "text-cyan-300 border-cyan-400/40 bg-cyan-500/10";
  const milestoneText = STAGE_MILESTONES[currentStageId] || STAGE_MILESTONES.planner;
  const explainerText = WAIT_EXPLAINERS[explainerIndex];
  const stageAura = currentStageId === "researcher"
    ? "from-cyan-500/20 via-emerald-400/10 to-transparent"
    : currentStageId === "validator"
      ? "from-amber-500/15 via-cyan-500/10 to-transparent"
      : currentStageId === "consensus"
        ? "from-violet-500/20 via-cyan-500/10 to-transparent"
        : currentStageId === "architect"
          ? "from-emerald-500/20 via-cyan-500/10 to-transparent"
          : "from-cyan-500/20 via-transparent to-transparent";

  return (
    <div className="relative">
      <div className={cn(
        "pointer-events-none absolute inset-0 rounded-2xl blur-2xl opacity-60",
        "bg-gradient-to-br transition-all duration-700",
        stageAura
      )} />
      <div className="space-y-6">
        {/* ── Section 1: Agent ── */}
        <div
          className="relative animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <AgentPersona status={getAgentStatus()} progress={progress} />
        </div>

        <TimelineInterlude
          icon="brain"
          title="Reasoning In Progress"
          body="Trende is reconciling conflicting narratives, ranking evidence freshness, and deciding whether to trigger deeper follow-up loops."
        />

        {/* ── Section 2: Timeline + Inline Brief ── */}
        <div
          className="relative animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "150ms", animationFillMode: "both" }}
        >
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
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                  Mission Timeline
                </h3>
              </div>
              <div className={cn("px-3 py-2 rounded-lg border font-mono min-w-[170px] text-center", clockTone, !prefersReducedMotion && "animate-pulse")}>
                <p className="text-[10px] uppercase tracking-[0.2em] font-black">Mission Clock</p>
                <div className="flex items-center justify-center gap-2 mt-1 text-sm sm:text-base font-black tabular-nums">
                  <span>{elapsedSeconds}s</span>
                  <span className="opacity-60">/</span>
                  <span>~{remaining}s</span>
                </div>
                <p className="text-[10px] mt-0.5 uppercase tracking-wider opacity-80">
                  {overtime ? "Over estimate" : "Elapsed / remaining"}
                </p>
              </div>
            </div>

            <div className="mb-3">
              <MilestonePulse key={`${currentStageId}-${stagePulseTick}`} text={milestoneText} reducedMotion={prefersReducedMotion} />
            </div>
            <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-2.5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
                Mission Persistence
              </p>
              <p className="text-xs text-emerald-100/80">
                Safe to leave this page. Your run is saved server-side and can be reopened from History or Commons.
              </p>
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
                  softMode={isSoft}
                />
              ))}
            </div>

            {/* Active narrative panel */}
            <div className={cn(
              "mt-3 sm:mt-4 p-3 sm:p-4",
              isSoft ? "soft-ui-in" : "border-2 border-[var(--border-color)] bg-[var(--bg-primary)]"
            )}>
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--accent-violet)]">
                Active Narrative
              </p>
              <h4 className="text-sm font-black uppercase mt-0.5 text-[var(--text-primary)]">
                {expandedStage.label}{" // "}{expandedStage.description}
              </h4>
              <p className="mt-2 text-xs font-mono text-[var(--text-secondary)]">
                {expandedStage.detail}
              </p>
              <div className="flex flex-wrap gap-2 mt-2 text-[10px] font-mono">
                <span className={cn(
                  "px-2 py-1",
                  isSoft ? "soft-ui-out text-[var(--text-secondary)]" : "border border-[var(--border-color)] bg-[var(--bg-secondary)]"
                )}>
                  Stage: ~{expandedBand?.min ?? 0}s - {expandedBand?.max ?? 0}s
                </span>
              </div>
            </div>

            <motion.div
              key={`explainer-${explainerIndex}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
              className="mt-3 p-3 rounded-lg border border-white/10 bg-black/20"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300 mb-1">
                Runtime Insight
              </p>
              <p className="text-xs text-[var(--text-secondary)]">{explainerText}</p>
            </motion.div>
            <WaitWaypoints progress={progress} reducedMotion={prefersReducedMotion} />
          </Card>
        </div>

        <TimelineInterlude
          icon="shield"
          title="Verifiable Compute Path"
          body="Consensus outputs are normalized into a proof manifest, then signed on the live runtime so downstream users can verify provenance."
        />

        {/* ── Section 3: Proof Terminal ── */}
        <div
          className="relative animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "300ms", animationFillMode: "both" }}
        >
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
                      {isProcessing ? "PROOF RUNNING" : "PROOF READY"}
                    </h3>
                    {isProcessing && (
                      <Loader2 className="w-3 h-3 animate-spin text-[var(--accent-cyan)]" />
                    )}
                  </div>
                  <p className={`text-xs font-mono flex items-center gap-2 ${mutedTextClass}`}>
                    <span className={`text-emerald-500 ${prefersReducedMotion ? "" : "animate-pulse"}`}>●</span>
                    {activeHash}
                    <span className={`opacity-70 hidden sm:inline ${mutedTextClass}`}>:: Hetzner Runtime</span>
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
                    className={cn(
                      "flex items-center justify-between px-3 py-2 border-b-2",
                      isSoft ? "bg-[var(--bg-tertiary)] border-[var(--text-muted)]/10" : "bg-[var(--bg-secondary)] border-[var(--text-muted)]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Terminal className={`w-3.5 h-3.5 ${isSoft ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`} />
                      <span className={`text-[10px] font-mono ${isSoft ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                        PROOF_TELEMETRY.LOG
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full bg-[var(--status-success)] ${prefersReducedMotion ? "" : "animate-pulse"}`} />
                      <div className={`w-1.5 h-1.5 rounded-full ${isSoft ? "bg-[var(--status-success)]/40" : "bg-emerald-500/40"}`} />
                      <div className={`w-1.5 h-1.5 rounded-full ${isSoft ? "bg-[var(--status-success)]/20" : "bg-emerald-500/20"}`} />
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
