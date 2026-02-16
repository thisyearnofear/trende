"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useTrendData, useTrendHistory } from "@/hooks/useTrendData";
import { QueryInput } from "@/components/QueryInput";
import { PlatformTabs } from "@/components/PlatformTabs";
import { TrendSummary } from "@/components/TrendSummary";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { ForgeViewer } from "@/components/ForgeViewer";
import { QueryRequest } from "@/lib/types";
import { useToast } from "@/components/Toast";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  RefreshCw,
  History,
  Zap,
  Sparkles,
  Bot,
  Fingerprint,
  Layers3,
  Share2,
  Megaphone,
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, Stat, Button, IconButton } from "@/components/DesignSystem";
import { Onboarding } from "@/components/Onboarding";

const STATUS_ETAS: Record<
  string,
  { label: string; minSeconds: number; maxSeconds: number }
> = {
  pending: { label: "Queueing mission", minSeconds: 5, maxSeconds: 15 },
  planning: { label: "Planning sources", minSeconds: 10, maxSeconds: 35 },
  researching: { label: "Collecting signals", minSeconds: 20, maxSeconds: 90 },
  processing: { label: "Consensus + attestation", minSeconds: 35, maxSeconds: 140 },
  analyzing: { label: "Synthesizing brief", minSeconds: 20, maxSeconds: 70 },
  completed: { label: "Completed", minSeconds: 0, maxSeconds: 0 },
  failed: { label: "Failed", minSeconds: 0, maxSeconds: 0 },
};

export default function Home() {
  const [queryId, setQueryId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [lastQuery, setLastQuery] = useState<QueryRequest | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showForgeInline, setShowForgeInline] = useState(false);
  const { showToast } = useToast();

  const {
    status,
    data,
    isProcessing,
    progress,
    events,
    startAnalysis,
    refresh,
  } = useTrendData(queryId);
  const { queries: history, isLoading: historyLoading } = useTrendHistory();

  const handleSubmit = useCallback(
    async (request: QueryRequest) => {
      try {
        setLastQuery(request);
        const response = await startAnalysis(request);
        setQueryId(response.id);
      } catch (error) {
        console.error("Failed to start analysis:", error);
      }
    },
    [startAnalysis],
  );

  const handleSelectHistory = (id: string) => {
    setQueryId(id);
    setShowHistory(false);
    // When selecting history, we don't necessarily have the full request details
    // unless we fetch them or find them in history data.
    // For now, we'll just clear lastQuery to avoid showing potentially wrong brief
    setLastQuery(null);
  };

  const handleClear = () => {
    setQueryId(null);
    setShowHistory(false);
    setShowForgeInline(false);
  };

  const stats = useMemo(() => {
    const platforms = new Set(
      data?.results.map((result) => result.platform) || [],
    );
    const itemCount =
      data?.results.reduce((sum, result) => sum + result.items.length, 0) || 0;
    return {
      platforms: platforms.size,
      itemCount,
    };
  }, [data]);

  const allItems = useMemo(
    () => data?.results.flatMap((result) => result.items) || [],
    [data],
  );

  const sourceCount = allItems.length;
  const latestSourceTimestamp = useMemo(() => {
    if (allItems.length === 0) return null;
    const timestamps = allItems
      .map((item) => new Date(item.timestamp).getTime())
      .filter((value) => !Number.isNaN(value));
    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps));
  }, [allItems]);

  const referenceTimestamp = useMemo(() => {
    const raw =
      data?.summary?.generatedAt ||
      data?.query?.updatedAt ||
      data?.query?.createdAt ||
      null;
    return raw ? new Date(raw).getTime() : null;
  }, [data]);

  const freshness = useMemo(() => {
    if (!latestSourceTimestamp) {
      return { label: "Unknown", tone: "amber" as const, ageHours: null };
    }
    if (!referenceTimestamp) {
      return { label: "Unknown", tone: "amber" as const, ageHours: null };
    }
    const ageMs = referenceTimestamp - latestSourceTimestamp.getTime();
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    if (ageHours <= 6) return { label: "Fresh (< 6h)", tone: "emerald" as const, ageHours };
    if (ageHours <= 24) return { label: "Recent (< 24h)", tone: "cyan" as const, ageHours };
    if (ageHours <= 72) return { label: "Aging (1-3d)", tone: "amber" as const, ageHours };
    return { label: "Stale (> 3d)", tone: "rose" as const, ageHours };
  }, [latestSourceTimestamp, referenceTimestamp]);

  const providerErrors = useMemo(
    () => data?.summary?.consensusData?.provider_errors || [],
    [data],
  );
  const consensusWarnings = useMemo(
    () => data?.summary?.consensusData?.warnings || [],
    [data],
  );
  const telemetryWarnings = useMemo(
    () => data?.telemetry?.warnings || [],
    [data],
  );

  const reliabilityFlags = useMemo(() => {
    const flags: string[] = [];
    if (sourceCount <= 1) flags.push("Low evidence breadth: only one source captured.");
    if ((stats.platforms || 0) <= 1) flags.push("Single-platform bias risk is elevated.");
    if (freshness.tone === "rose" || freshness.tone === "amber")
      flags.push("Freshness risk: newest evidence is older than ideal.");
    providerErrors.forEach((item) => flags.push(`Provider error (${item.provider}): ${item.error}`));
    consensusWarnings.forEach((warning) => flags.push(`Consensus warning: ${warning}`));
    telemetryWarnings.forEach((warning) => flags.push(`System warning: ${warning}`));
    return flags.slice(0, 6);
  }, [
    sourceCount,
    stats.platforms,
    freshness.tone,
    providerErrors,
    consensusWarnings,
    telemetryWarnings,
  ]);

  const confidenceDrivers = useMemo(() => {
    const confidence = Math.round((data?.summary?.confidenceScore || 0) * 100);
    const agreement = Math.round(((data?.summary?.consensusData?.agreement_score || 0) * 100));
    const sourceBreadth = Math.min(Math.round((sourceCount / 8) * 100), 100);
    const freshnessScore =
      freshness.tone === "emerald"
        ? 90
        : freshness.tone === "cyan"
          ? 75
          : freshness.tone === "amber"
            ? 45
            : 25;
    return [
      { label: "Model confidence", value: confidence, accent: "cyan" as const, weight: 0.4 },
      { label: "Model agreement", value: agreement, accent: "amber" as const, weight: 0.25 },
      { label: "Evidence breadth", value: sourceBreadth, accent: "emerald" as const, weight: 0.2 },
      { label: "Freshness", value: freshnessScore, accent: freshness.tone, weight: 0.15 },
    ];
  }, [data, sourceCount, freshness]);

  const weightedConfidence = useMemo(() => {
    if (confidenceDrivers.length === 0) return 0;
    const total = confidenceDrivers.reduce(
      (acc, driver) => acc + driver.value * driver.weight,
      0,
    );
    return Math.round(total);
  }, [confidenceDrivers]);

  const confidenceTone = weightedConfidence >= 75 ? "emerald" : weightedConfidence >= 55 ? "amber" : "rose";
  const confidenceLabel =
    weightedConfidence >= 75
      ? "High confidence, still validate key assumptions."
      : weightedConfidence >= 55
        ? "Medium confidence, check supporting evidence before action."
        : "Low confidence, treat as directional only.";

  const shareCardText = useMemo(() => {
    const title = data?.query?.idea || "Trend Analysis";
    const summary = data?.summary?.overview || "No summary available.";
    const compactSummary =
      summary.length > 220 ? `${summary.slice(0, 217)}...` : summary;
    return [
      "TRENDE Conviction Snapshot",
      `Topic: ${title}`,
      `Confidence: ${weightedConfidence}%`,
      `Sources: ${sourceCount}`,
      `Freshness: ${freshness.label}`,
      `Verdict: ${data?.summary?.sentiment || "neutral"}`,
      `Summary: ${compactSummary}`,
      reliabilityFlags.length > 0 ? `Known gaps: ${reliabilityFlags.slice(0, 2).join("; ")}` : "Known gaps: none critical",
    ].join("\n");
  }, [data, weightedConfidence, sourceCount, freshness.label, reliabilityFlags]);

  const activeEta = STATUS_ETAS[status || "pending"] || STATUS_ETAS.pending;
  const startedAt = data?.query?.createdAt ? new Date(data.query.createdAt).getTime() : null;
  const activeQueryId = data?.query?.id || queryId;

  useEffect(() => {
    if (!isProcessing || !startedAt) return;
    const updateElapsed = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setElapsedSeconds(seconds);
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [isProcessing, startedAt]);

  const handleCopyBrief = useCallback(async () => {
    if (!data?.summary) return;
    const brief = [
      `Conviction Brief: ${data.summary.sentiment.toUpperCase()}`,
      data.summary.overview,
      `Confidence: ${Math.round((data.summary.confidenceScore || 0) * 100)}%`,
      `Sources: ${sourceCount}`,
      `Freshness: ${freshness.label}`,
      reliabilityFlags.length > 0 ? `Known Gaps: ${reliabilityFlags.join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(brief);
    showToast("Conviction brief copied.", "success");
  }, [data, sourceCount, freshness.label, reliabilityFlags, showToast]);

  const handleCopyShareLink = useCallback(async () => {
    if (!activeQueryId || typeof window === "undefined") return;
    const url = `${window.location.origin}/proof/${activeQueryId}`;
    await navigator.clipboard.writeText(url);
    showToast("Proof link copied.", "success");
  }, [activeQueryId, showToast]);

  const handleCopyShareCard = useCallback(async () => {
    await navigator.clipboard.writeText(shareCardText);
    showToast("Share card copied.", "success");
  }, [shareCardText, showToast]);

  const handleCopySocialPost = useCallback(async () => {
    const post = [
      `Conviction snapshot: ${weightedConfidence}% confidence on "${data?.query?.idea || "trend thesis"}".`,
      `${data?.summary?.overview?.slice(0, 140) || "Generated by Trende."}${(data?.summary?.overview || "").length > 140 ? "..." : ""}`,
      activeQueryId && typeof window !== "undefined"
        ? `${window.location.origin}/proof/${activeQueryId}`
        : "",
      "#trends #research #ai",
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard.writeText(post);
    showToast("Social post copied.", "success");
  }, [weightedConfidence, data, activeQueryId, showToast]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] pb-10 transition-colors duration-200">
      <Onboarding />
      {/* Header */}
      <header className="border-b-2 border-[var(--border-color)] bg-[var(--bg-primary)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 sm:gap-3"
              onClick={handleClear}
            >
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: "var(--accent-cyan)",
                  boxShadow: "2px 2px 0px 0px var(--shadow-color)",
                }}
              >
                <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--bg-primary)]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-black uppercase tracking-wider truncate">
                  TRENDE
                </h1>
                <p className="text-[10px] font-mono text-[var(--accent-cyan)] truncate">
                  TEE-SECURED
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <IconButton
                icon={<RefreshCw className="w-5 h-5" />}
                onClick={() => refresh()}
                disabled={!queryId}
                ariaLabel="Refresh"
              />
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2.5 min-h-[44px] min-w-[44px] border-2 transition-colors flex items-center justify-center ${showHistory
                    ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                    : "bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)]"
                  }`}
                style={{ boxShadow: "2px 2px 0px 0px var(--shadow-color)" }}
                aria-label="History"
              >
                <History className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* History Panel */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setShowHistory(false)}
          />
          <Card
            className="relative w-full sm:w-96 h-full rounded-none"
            accent="cyan"
          >
            <div className="flex items-center justify-between p-4 border-b-2 border-[var(--border-color)]">
              <h3 className="font-black uppercase tracking-wider">
                Mission History
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] font-mono"
              >
                [CLOSE]
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {historyLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 bg-[var(--bg-primary)] border-2 border-[var(--text-muted)]"
                    />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p className="text-[var(--text-muted)] font-mono">
                  NO MISSIONS ON RECORD
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectHistory(item.id)}
                      className="w-full text-left p-3 bg-[var(--bg-primary)] border-2 border-[var(--text-muted)] hover:border-[var(--accent-cyan)] transition-colors"
                    >
                      <p className="text-sm line-clamp-2 font-mono">
                        {item.idea}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`text-xs px-2 py-0.5 font-mono ${item.status === "completed"
                              ? "bg-[var(--accent-emerald)] text-[var(--bg-primary)]"
                              : item.status === "processing"
                                ? "bg-[var(--accent-amber)] text-[var(--bg-primary)]"
                                : "bg-[var(--text-muted)] text-[var(--text-primary)]"
                            }`}
                        >
                          {item.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] font-mono">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        {!queryId && !isProcessing && (
          <Card accent="cyan" shadow="lg" className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Fingerprint className="w-5 h-5 text-[var(--accent-cyan)]" />
              <span className="text-xs font-mono text-[var(--accent-cyan)]">
                TEE-SECURED EXECUTION // CRYPTOGRAPHICALLY VERIFIABLE
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-3">
              Turn Social Signal Into Conviction-Ready Intelligence
            </h2>
            <p className="text-[var(--text-secondary)] font-mono text-sm max-w-2xl mb-4">
              Run multi-platform research through verifiable TEE execution.
              Cross-reference signals, validate consensus, generate
              cryptographic attestations.
            </p>
            <div className="flex flex-wrap gap-4 pt-4 border-t border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--accent-emerald)]" />
                <span className="text-xs text-[var(--text-secondary)]">
                  Trusted Execution Environment
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--accent-emerald)]" />
                <span className="text-xs text-[var(--text-secondary)]">
                  Multi-Model Consensus
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--accent-emerald)]" />
                <span className="text-xs text-[var(--text-secondary)]">
                  Cryptographic Signatures
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Query Input */}
        <QueryInput
          onSubmit={handleSubmit}
          isLoading={isProcessing}
          disabled={isProcessing}
        />

        {/* Processing Status */}
        {(isProcessing || status === "processing") && (
          <div className="space-y-4">
            <Card accent="amber" className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4 text-[var(--accent-amber)]" />
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Runtime Estimator
                  </h3>
                </div>
                <span className="text-xs font-mono text-[var(--text-muted)] uppercase">
                  {activeEta.label}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm font-mono">
                <div className="p-3 border-2 border-[var(--border-color)] bg-[var(--bg-primary)]">
                  <p className="text-[10px] uppercase text-[var(--text-muted)]">
                    Typical Stage
                  </p>
                  <p className="font-black">
                    {activeEta.minSeconds}s - {activeEta.maxSeconds}s
                  </p>
                </div>
                <div className="p-3 border-2 border-[var(--border-color)] bg-[var(--bg-primary)]">
                  <p className="text-[10px] uppercase text-[var(--text-muted)]">
                    Elapsed
                  </p>
                  <p className="font-black">{elapsedSeconds}s</p>
                </div>
                <div className="p-3 border-2 border-[var(--border-color)] bg-[var(--bg-primary)]">
                  <p className="text-[10px] uppercase text-[var(--text-muted)]">
                    Progress
                  </p>
                  <p className="font-black">{progress}%</p>
                </div>
              </div>
            </Card>

            <ProcessingStatus
              status={status}
              progress={progress}
              events={events}
              isProcessing={isProcessing}
              queryData={
                lastQuery
                  ? {
                      topic: lastQuery.idea,
                      platforms: lastQuery.platforms,
                      models: lastQuery.models,
                      threshold: lastQuery.relevanceThreshold,
                    }
                  : data?.query
                    ? {
                        topic: data.query.idea,
                        platforms: data.query.platforms,
                        threshold: data.query.relevanceThreshold,
                      }
                    : undefined
              }
            />
          </div>
        )}

        {/* Results */}
        {data && data.results && data.results.length > 0 && !isProcessing && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <Stat
                value={`${weightedConfidence}%`}
                label="Confidence"
                accent="cyan"
              />
              <Stat value={stats.platforms} label="Sources" accent="emerald" />
              <Stat value={stats.itemCount} label="Signals" accent="amber" />
            </div>

            {/* Snapshot + Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card accent="cyan" className="lg:col-span-2 p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider">
                      Decision Snapshot
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] font-mono mt-1">
                      TL;DR with explicit limitations and evidence context.
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 border-2 border-[var(--border-color)] font-black uppercase">
                    {data.summary?.sentiment || "neutral"}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[var(--text-secondary)] mb-4">
                  {data.summary?.overview || "No summary available yet."}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="p-3 border-2 border-[var(--border-color)] bg-[var(--bg-primary)]">
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">Freshness</p>
                    <p className="font-black">{freshness.label}</p>
                  </div>
                  <div className="p-3 border-2 border-[var(--border-color)] bg-[var(--bg-primary)]">
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">Coverage</p>
                    <p className="font-black">{sourceCount} total sources</p>
                  </div>
                  <div className="p-3 border-2 border-[var(--border-color)] bg-[var(--bg-primary)]">
                    <p className="text-[10px] uppercase text-[var(--text-muted)]">Known Gaps</p>
                    <p className="font-black">{reliabilityFlags.length > 0 ? `${reliabilityFlags.length} flags` : "None detected"}</p>
                  </div>
                </div>
              </Card>

              <Card accent="emerald" className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Share2 className="w-4 h-4 text-[var(--accent-emerald)]" />
                  <h3 className="text-sm font-black uppercase tracking-wider">Next Actions</h3>
                </div>
                <div className="space-y-2">
                  <Button variant="secondary" className="w-full" onClick={() => handleCopyBrief()}>
                    <Copy className="w-4 h-4 mr-2 inline-block" />
                    Copy Brief
                  </Button>
                  <Button variant="secondary" className="w-full" onClick={() => handleCopyShareLink()}>
                    <ExternalLink className="w-4 h-4 mr-2 inline-block" />
                    Copy Share Link
                  </Button>
                  <Button variant="secondary" className="w-full" onClick={() => handleCopyShareCard()}>
                    <Copy className="w-4 h-4 mr-2 inline-block" />
                    Copy Share Card
                  </Button>
                  <Button variant="secondary" className="w-full" onClick={() => handleCopySocialPost()}>
                    <Megaphone className="w-4 h-4 mr-2 inline-block" />
                    Copy Social Post
                  </Button>
                  <Link href={activeQueryId ? `/proof/${activeQueryId}` : "#"}>
                    <Button variant="primary" className="w-full">
                      Open Proof Page
                    </Button>
                  </Link>
                  <button
                    onClick={() => setShowForgeInline((prev) => !prev)}
                    className="w-full border-2 border-[var(--border-color)] bg-[var(--bg-primary)] min-h-[44px] font-black uppercase tracking-wider text-xs"
                  >
                    {showForgeInline ? "Hide Inline Forge" : "Show Inline Forge"}
                  </button>
                </div>
              </Card>
            </div>

            <Card accent={confidenceTone} className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                  Confidence Narrative
                </p>
                <span className="text-sm font-black">{weightedConfidence}% weighted</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-3">{confidenceLabel}</p>
              <pre className="whitespace-pre-wrap text-xs font-mono bg-[var(--bg-primary)] border-2 border-[var(--border-color)] p-3">
                {shareCardText}
              </pre>
            </Card>

            {/* Progressive Disclosure Panels */}
            <div className="space-y-4">
              <details open className="group">
                <summary className="list-none cursor-pointer">
                  <Card accent="white" className="p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[var(--accent-cyan)]" />
                        <span className="text-sm font-black uppercase tracking-wider">
                          Conviction Brief
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </div>
                  </Card>
                </summary>
                <div className="mt-3">
                  <TrendSummary summary={data.summary} />
                </div>
              </details>

              <details className="group">
                <summary className="list-none cursor-pointer">
                  <Card accent="amber" className="p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers3 className="w-4 h-4 text-[var(--accent-amber)]" />
                        <span className="text-sm font-black uppercase tracking-wider">
                          Confidence Drivers
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </div>
                  </Card>
                </summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {confidenceDrivers.map((driver) => (
                    <Card key={driver.label} accent={driver.accent} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs uppercase font-black text-[var(--text-muted)]">
                          {driver.label}
                        </p>
                        <p className="font-black">{driver.value}%</p>
                      </div>
                      <p className="text-[10px] uppercase font-mono text-[var(--text-muted)] mb-2">
                        Weight {Math.round(driver.weight * 100)}%
                      </p>
                      <div className="h-2 bg-[var(--bg-primary)] border-2 border-[var(--border-color)]">
                        <div
                          className="h-full"
                          aria-label={`${driver.label} ${driver.value}%`}
                          style={{
                            width: `${driver.value}%`,
                            backgroundColor:
                              driver.accent === "emerald"
                                ? "var(--accent-emerald)"
                                : driver.accent === "amber"
                                  ? "var(--accent-amber)"
                                  : driver.accent === "rose"
                                    ? "var(--accent-rose)"
                                    : "var(--accent-cyan)",
                          }}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </details>

              <details className="group">
                <summary className="list-none cursor-pointer">
                  <Card accent="rose" className="p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-[var(--accent-rose)]" />
                        <span className="text-sm font-black uppercase tracking-wider">
                          Reliability & Gaps
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </div>
                  </Card>
                </summary>
                <div className="mt-3 space-y-2">
                  {reliabilityFlags.length === 0 ? (
                    <Card accent="emerald" className="p-3 text-sm font-mono">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[var(--accent-emerald)]" />
                        No critical reliability gaps detected for this run.
                      </div>
                    </Card>
                  ) : (
                    reliabilityFlags.map((flag, index) => (
                      <Card key={`${flag}-${index}`} accent="rose" className="p-3 text-sm font-mono">
                        {flag}
                      </Card>
                    ))
                  )}
                  <Card accent="amber" className="p-4">
                    <p className="text-xs uppercase font-black text-[var(--text-muted)] mb-2">
                      Free Source Expansion Queue
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <a className="underline underline-offset-2" href="https://api.gdeltproject.org/api/v2/doc/doc" target="_blank" rel="noreferrer">GDELT DOC 2.0</a>
                      <a className="underline underline-offset-2" href="https://stream.wikimedia.org/" target="_blank" rel="noreferrer">Wikimedia EventStreams</a>
                      <a className="underline underline-offset-2" href="https://github.com/HackerNews/API" target="_blank" rel="noreferrer">Hacker News API</a>
                      <a className="underline underline-offset-2" href="https://api.stackexchange.com/docs" target="_blank" rel="noreferrer">Stack Exchange API</a>
                    </div>
                  </Card>
                </div>
              </details>

              <details open className="group">
                <summary className="list-none cursor-pointer">
                  <Card accent="cyan" className="p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black uppercase tracking-wider">
                        Signal Feed
                      </span>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </div>
                  </Card>
                </summary>
                <div className="mt-3">
                  <PlatformTabs results={data.results} />
                </div>
              </details>

              {showForgeInline && data.summary && activeQueryId && (
                <details open className="group">
                  <summary className="list-none cursor-pointer">
                    <Card accent="emerald" className="p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black uppercase tracking-wider">
                          Inline Forge Workspace
                        </span>
                        <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                      </div>
                    </Card>
                  </summary>
                  <div className="mt-3">
                    <ForgeViewer summary={data.summary} mode="news" queryId={activeQueryId} />
                  </div>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!queryId && !isProcessing && (
          <div className="text-center py-12 border-2 border-dashed border-[var(--text-muted)]">
            <div
              className="w-16 h-16 mx-auto mb-4 flex items-center justify-center"
              style={{
                backgroundColor: "var(--accent-cyan)",
                boxShadow: "4px 4px 0px 0px var(--shadow-color)",
              }}
            >
              <Zap className="w-8 h-8 text-[var(--bg-primary)]" />
            </div>
            <h3 className="text-xl font-black uppercase mb-2">
              Initialize Analysis
            </h3>
            <p className="text-[var(--text-muted)] font-mono text-sm max-w-md mx-auto">
              Enter a research brief above. Trende will execute in a TEE-secured
              environment and return verifiable intelligence.
            </p>
          </div>
        )}

        {/* Error State */}
        {data?.query?.status === "failed" && (
          <div
            className="border-2 p-6 text-center"
            style={{
              backgroundColor: "rgba(255, 68, 68, 0.1)",
              borderColor: "var(--accent-rose)",
            }}
          >
            <h3 className="font-black uppercase mb-2 text-[var(--accent-rose)]">
              [!] Analysis Failed
            </h3>
            <p className="text-[var(--text-secondary)] font-mono text-sm">
              {data.query.errorMessage || "Unknown error occurred."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
