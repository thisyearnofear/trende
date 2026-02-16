"use client";

import { useMemo, useState, useEffect } from "react";
import { StreamEvent, QueryStatus } from "@/lib/types";
import {
  Terminal,
  Fingerprint,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import { TerminalLog } from "./TypewriterText";
import { AgentPersona } from "./AgentPersona";
import { Card, Progress, Badge } from "./DesignSystem";

interface ProcessingStatusProps {
  status: QueryStatus | null;
  progress: number;
  events: StreamEvent[];
  isProcessing: boolean;
}

const STAGES = [
  { id: "planner", label: "PLAN", description: "Strategy & Source Selection" },
  {
    id: "researcher",
    label: "HARVEST",
    description: "Multi-Platform Data Collection",
  },
  {
    id: "validator",
    label: "VALIDATE",
    description: "Cross-Reference & Confidence",
  },
  { id: "architect", label: "ATTEST", description: "TEE Signing & Output" },
];

export function ProcessingStatus({
  progress,
  events,
  isProcessing,
}: ProcessingStatusProps) {
  const currentStageIndex = Math.min(
    Math.floor((progress / 100) * STAGES.length),
    STAGES.length - 1,
  );
  const [activeHash, setActiveHash] = useState("0x...");

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

  const terminalEvents = useMemo(() => {
    return events.slice(-6).map((event, index) => ({
      id: `${event.type}-${index}-${event.message?.slice(0, 20) || ""}`,
      message: event.message || "",
      type: (event.type === "error"
        ? "error"
        : event.type === "result"
          ? "success"
          : "info") as "error" | "success" | "info",
    }));
  }, [events]);

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

  return (
    <div className="space-y-4">
      {/* Trende Agent */}
      <AgentPersona status={getAgentStatus()} progress={progress} />

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
