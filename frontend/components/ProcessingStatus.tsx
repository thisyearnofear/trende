"use client";

import { useMemo, useState, useEffect } from "react";
import { StreamEvent, QueryStatus } from "@/lib/types";
import {
  Terminal,
  Fingerprint,
  CheckCircle2,
  Circle,
  Loader2,
  Shield,
  Layers,
  Sparkles,
  Zap,
} from "lucide-react";
import { TerminalLog } from "./TypewriterText";
import { AgentPersona } from "./AgentPersona";
import { Card, Progress, Badge } from "./DesignSystem";

interface ProcessingStatusProps {
  status: QueryStatus | null;
  progress: number;
  events: StreamEvent[];
  isProcessing: boolean;
  queryData?: {
    topic: string;
    platforms: string[];
    models?: string[];
    threshold?: number;
  };
}

const STAGES = [
  { id: "planner", label: "PLAN", description: "Strategy & Source Selection" },
  {
    id: "researcher",
    label: "HARVEST",
    description: "Data Mining & Social Signal",
  },
  { id: "validator", label: "VALIDATE", description: "Truth Verification" },
  { id: "consensus", label: "FORGE", description: "Multi-Model Consensus" },
  { id: "architect", label: "ATTEST", description: "TEE Proof Signing" },
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
    "PARSING UNSTRUCTURED DATA...",
    "DETECTING VIRAL SIGNALS...",
    "FILTERING PLATFORM NOISE...",
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
    "CONSULTING VENICE AI (PRIVACY-FIRST)...",
    "CONSULTING GPT-4O...",
    "CONSULTING LLAMA 3.3...",
    "AGGREGATING MULTI-MODEL OUTPUTS...",
    "RESOLVING DIVERGENT SIGNALS...",
  ],
  architect: [
    "SYNTHESIZING SOVEREIGN REPORT...",
    "GENERATING EIGEN PROOF...",
    "SIGNING ATTESTATION PAYLOAD...",
    "ESTABLISHING PROOF OF COMPUTE...",
    "MISSION COMPLETE.",
  ],
};

export function ProcessingStatus({
  progress,
  events,
  isProcessing,
  queryData,
}: ProcessingStatusProps) {
  const currentStageIndex = Math.min(
    Math.floor((progress / 100) * STAGES.length),
    STAGES.length - 1,
  );
  const currentStageId = STAGES[currentStageIndex]?.id || "planner";
  const [activeHash, setActiveHash] = useState("0x...");
  const [simulatedLog, setSimulatedLog] = useState<string | null>(null);

  // Hash animation
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setActiveHash(
        "0x" +
          Array.from({ length: 4 }, () =>
            Math.floor(Math.random() * 16).toString(16),
          ).join("") +
          "...",
      );
    }, 120);
    return () => clearInterval(interval);
  }, [isProcessing]);

  // Simulated telemetry logs
  useEffect(() => {
    if (!isProcessing) {
      return;
    }

    const logs = SIMULATED_LOGS[currentStageId] || SIMULATED_LOGS["planner"];
    const interval = setInterval(() => {
      const randomLog = logs[Math.floor(Math.random() * logs.length)];
      setSimulatedLog(`[SYSTEM] ${randomLog}`);
    }, 2500);

    return () => {
      clearInterval(interval);
      setSimulatedLog(null);
    };
  }, [isProcessing, currentStageId]);

  const terminalEvents = useMemo(() => {
    // Filter out repetitive status messages like "researching (45%)"
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
      displayEvents.push({
        id: "simulated",
        message: simulatedLog,
        type: "info",
      });
    }

    return displayEvents.slice(-6);
  }, [events, simulatedLog, isProcessing]);

  const getAgentStatus = () => {
    if (!isProcessing) return "idle";
    if (progress < 10) return "thinking";
    if (progress < 100) {
      if (
        events.length > 0 &&
        events[events.length - 1].message?.includes("Validation")
      )
        return "thinking";
      return "processing";
    }
    return "complete";
  };

  const getPlatformLabel = (id: string) => {
    const labels: Record<string, string> = {
      twitter: "X / Twitter",
      linkedin: "LinkedIn",
      newsapi: "Global News",
      web: "Deep Web",
    };
    return labels[id] || id;
  };

  const getModelLabel = (id: string) => {
    const labels: Record<string, string> = {
      venice: "Venice AI",
      aisa: "AIsA API",
      openrouter: "OpenRouter",
      tabstack: "Tabstack",
    };
    return labels[id] || id;
  };

  return (
    <div className="space-y-4">
      {/* Trende Agent */}
      <AgentPersona status={getAgentStatus()} progress={progress} />

      {/* Mission Brief Summary (Only shown during processing) */}
      {isProcessing && queryData && (
        <Card accent="amber" className="overflow-hidden">
          <div className="flex flex-col lg:flex-row divide-y-2 lg:divide-y-0 lg:divide-x-2 border-[var(--border-color)]">
            {/* Thesis Section */}
            <div className="p-4 lg:w-1/3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-[var(--accent-amber)]" />
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  Research Thesis
                </span>
              </div>
              <p className="text-sm font-mono line-clamp-3 italic text-[var(--text-primary)]">
                &quot;{queryData.topic}&quot;
              </p>
            </div>

            {/* Config Summary Section */}
            <div className="p-4 lg:w-1/3 bg-[var(--bg-primary)]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-[var(--accent-cyan)]" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                      World Selectors
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {queryData.platforms.map((p) => (
                      <div
                        key={p}
                        className="w-1.5 h-1.5 bg-[var(--accent-cyan)]"
                        title={getPlatformLabel(p)}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {queryData.platforms.map((p) => (
                    <Badge
                      key={p}
                      variant="cyan"
                      className="text-[8px] py-0 px-1"
                    >
                      {getPlatformLabel(p).toUpperCase()}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent-amber)]" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                      Consensus Engine
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {(queryData.models || []).map((m) => (
                      <div
                        key={m}
                        className="w-1.5 h-1.5 bg-[var(--accent-amber)]"
                        title={getModelLabel(m)}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(queryData.models || ["venice", "aisa", "openrouter"]).map(
                    (m) => (
                      <Badge
                        key={m}
                        variant="amber"
                        className="text-[8px] py-0 px-1"
                      >
                        {getModelLabel(m).toUpperCase()}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            </div>

            {/* Impact/Mitigation Section */}
            <div className="p-4 lg:w-1/3">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-[var(--accent-emerald)]" />
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  Mission Impact
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-tight">
                    Mitigation Power
                  </p>
                  <p className="text-xl font-black text-[var(--accent-emerald)]">
                    {Math.round(
                      ((queryData.models?.length || 3) / 4) *
                        (queryData.threshold || 0.6) *
                        100 +
                        20,
                    )}
                    %
                  </p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-tight">
                    Strictness
                  </p>
                  <p className="text-xl font-black text-[var(--accent-cyan)]">
                    {Math.round((queryData.threshold || 0.6) * 100)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-tight">
                    Signal Depth
                  </p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {queryData.platforms.length > 2 ? "MAXIMUM" : "STANDARD"}
                  </p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-tight">
                    Consensus
                  </p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {queryData.models?.length && queryData.models.length > 2
                      ? "HIGH-TRUST"
                      : "BASE-LAYER"}
                  </p>
                </div>
              </div>
              <p className="text-[9px] font-mono text-[var(--text-muted)] mt-3 leading-tight border-t border-[var(--border-color)] pt-2">
                {queryData.models?.length && queryData.models.length > 2
                  ? ">> Multi-model cross-verification enabled. Hallucination risk minimized via advanced consensus."
                  : ">> Baseline consensus active. Standard social signal validation protocols."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Main Processing Card */}
      <Card accent="cyan" shadow="lg">
        {/* Header */}
        <div className="border-b-2 border-[var(--border-color)] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 flex items-center justify-center relative"
              style={{ backgroundColor: "var(--accent-cyan)" }}
            >
              <Fingerprint className="w-5 h-5 text-[var(--bg-primary)] animate-pulse" />
              {isProcessing && (
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
              <p className="text-xs font-mono text-[var(--text-muted)] flex items-center gap-2">
                <span className="text-emerald-500 animate-pulse">●</span>{" "}
                {activeHash}
                <span className="opacity-50">:: EigenCompute Enclave</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-[var(--accent-cyan)] tabular-nums">
              {progress}%
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="p-4 border-b-2 border-[var(--border-color)]">
          <Progress value={progress} accent="cyan" />
        </div>

        {/* Stages */}
        <div className="p-4 border-b-2 border-[var(--border-color)]">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {STAGES.map((stage, index) => {
              const isComplete = index < currentStageIndex;
              const isActive = index === currentStageIndex;

              return (
                <div
                  key={stage.id}
                  className={`p-3 border-2 min-h-[80px] transition-all duration-300 ${isActive ? "scale-105 z-10 shadow-lg" : "opacity-80"}`}
                  style={{
                    borderColor: isComplete
                      ? "var(--accent-emerald)"
                      : isActive
                        ? "var(--accent-cyan)"
                        : "var(--text-muted)",
                    backgroundColor: isComplete
                      ? "rgba(0, 255, 136, 0.1)"
                      : isActive
                        ? "rgba(0, 255, 255, 0.1)"
                        : "var(--bg-primary)",
                    boxShadow: isComplete
                      ? "2px 2px 0px 0px var(--accent-emerald)"
                      : isActive
                        ? "0px 0px 15px var(--accent-cyan)"
                        : "none",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--accent-emerald)]" />
                    ) : isActive ? (
                      <div
                        className="w-4 h-4 animate-pulse"
                        style={{ backgroundColor: "var(--accent-cyan)" }}
                      />
                    ) : (
                      <Circle className="w-4 h-4 text-[var(--text-muted)]" />
                    )}
                    <span
                      className="text-xs font-black uppercase"
                      style={{
                        color: isComplete
                          ? "var(--accent-emerald)"
                          : isActive
                            ? "var(--accent-cyan)"
                            : "var(--text-muted)",
                      }}
                    >
                      {stage.label}
                    </span>
                    {isActive && (
                      <Badge
                        variant="cyan"
                        className="ml-auto text-[8px] py-0 px-1 border-0 shadow-none"
                      >
                        ACTIVE
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">
                    {stage.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Terminal */}
        {terminalEvents.length > 0 && (
          <div className="p-4">
            <div
              className="border-2 bg-[var(--bg-primary)]"
              style={{ borderColor: "var(--text-muted)" }}
            >
              <div
                className="flex items-center justify-between px-3 py-2 border-b-2 bg-[var(--bg-secondary)]"
                style={{ borderColor: "var(--text-muted)" }}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    TEE_TELEMETRY.LOG
                  </span>
                </div>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
  );
}
