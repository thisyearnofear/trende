"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useTrendData, useTrendHistory, useCommons, useSavedResearch } from "@/hooks/useTrendData";
import { QueryInput } from "@/components/QueryInput";
import { PlatformTabs } from "@/components/PlatformTabs";
import { TrendSummary } from "@/components/TrendSummary";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { ForgeViewer } from "@/components/ForgeViewer";
import { QueryRequest } from "@/lib/types";
import { api } from "@/lib/api";
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
  ListTree,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, Button, IconButton } from "@/components/DesignSystem";
import { Onboarding } from "@/components/Onboarding";
import { useWallet } from "@/components/WalletProvider";
import { useTheme } from "@/components/ThemeProvider";
import { ParagraphConnectModal } from "@/components/integrations/ParagraphConnectModal";
import { WalletButton } from "@/components/WalletButton";

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
const LAST_QUERY_STORAGE_KEY = "trende:last_query_id";

export default function Home() {
  const { isSoft } = useTheme();
  const [queryId, setQueryId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(LAST_QUERY_STORAGE_KEY);
  });
  const [showHistory, setShowHistory] = useState(false);
  const [historyMode, setHistoryMode] = useState<"recent" | "saved">("recent");
  const [lastQuery, setLastQuery] = useState<QueryRequest | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showForgeInline, setShowForgeInline] = useState(false);
  const [briefOpen, setBriefOpen] = useState(true);
  const [showCommons, setShowCommons] = useState(false);
  const [commonsSearch, setCommonsSearch] = useState("");
  const [commonsVisibleCount, setCommonsVisibleCount] = useState(6);
  const { showToast } = useToast();
  const { isConnected } = useWallet();

  const {
    status,
    data,
    isProcessing,
    progress,
    events,
    startAnalysis,
    refresh,
  } = useTrendData(queryId);
  const activeQueryId = data?.query?.id || queryId;
  const { queries: history, isLoading: historyLoading } = useTrendHistory();
  const { saved: savedResearch, isLoading: savedLoading } = useSavedResearch(isConnected);
  const { research: commonsResearch, isLoading: commonsLoading } = useCommons();

  const handleSubmit = useCallback(
    async (request: QueryRequest) => {
      try {
        setLastQuery(request);
        const response = await startAnalysis(request);
        setQueryId(response.id);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LAST_QUERY_STORAGE_KEY, response.id);
        }
      } catch (error) {
        console.error("Failed to start analysis:", error);
      }
    },
    [startAnalysis],
  );

  const handleSelectHistory = (id: string) => {
    setQueryId(id);
    setShowHistory(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_QUERY_STORAGE_KEY, id);
    }
    // When selecting history, we don't necessarily have the full request details
    // unless we fetch them or find them in history data.
    // For now, we'll just clear lastQuery to avoid showing potentially wrong brief
    setLastQuery(null);
  };

  const handleLoadCommonsItem = useCallback(
    (id: string) => {
      setQueryId(id);
      setShowForgeInline(false);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LAST_QUERY_STORAGE_KEY, id);
      }
      showToast("Loaded commons run into current workspace.", "success");
    },
    [showToast],
  );

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

  const panelSummaries = useMemo(
    () => ({
      brief: `${sourceCount} sources • ${stats.platforms} platforms • ${freshness.label}`,
      drivers: `Weighted confidence ${weightedConfidence}% across ${confidenceDrivers.length} drivers`,
      risks:
        reliabilityFlags.length > 0
          ? `${reliabilityFlags.length} known reliability flags`
          : "No critical reliability flags",
      feed: `${stats.itemCount} signals captured`,
      forge: showForgeInline ? "Inline forge active" : "Inline forge hidden",
    }),
    [
      sourceCount,
      stats.platforms,
      freshness.label,
      weightedConfidence,
      confidenceDrivers.length,
      reliabilityFlags.length,
      stats.itemCount,
      showForgeInline,
    ],
  );

  const activeEta = STATUS_ETAS[status || "pending"] || STATUS_ETAS.pending;
  const startedAt = data?.query?.createdAt ? new Date(data.query.createdAt).getTime() : null;
  const filteredCommons = useMemo(() => {
    const term = commonsSearch.trim().toLowerCase();
    if (!term) return commonsResearch;
    return commonsResearch.filter((item) => {
      const topicMatch = item.topic.toLowerCase().includes(term);
      const platformMatch = item.platforms.some((platform) =>
        platform.toLowerCase().includes(term),
      );
      return topicMatch || platformMatch;
    });
  }, [commonsResearch, commonsSearch]);
  const visibleCommons = useMemo(
    () => filteredCommons.slice(0, commonsVisibleCount),
    [filteredCommons, commonsVisibleCount],
  );

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

  const handleDownloadReport = useCallback(async () => {
    if (!activeQueryId) return;

    try {
      showToast("Generating report image...", "info");
      const imageUrl = `/api/report/${activeQueryId}/image`;
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trende-report-${activeQueryId.slice(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast("Report downloaded successfully.", "success");
    } catch (error) {
      console.error("Download failed:", error);
      showToast("Failed to download report.", "error");
    }

  }, [activeQueryId, showToast]);

  const [isParagraphModalOpen, setIsParagraphModalOpen] = useState(false);
  const [isPublishingToParagraph, setIsPublishingToParagraph] = useState(false);

  const handlePublishToParagraph = useCallback(async (key: string | null = null) => {
    if (!activeQueryId) return;

    let apiKey = key;
    if (!apiKey && typeof window !== "undefined") {
      apiKey = window.sessionStorage.getItem('trende:paragraph_api_key');
    }

    if (!apiKey) {
      setIsParagraphModalOpen(true);
      return;
    }

    setIsPublishingToParagraph(true);
    try {
      const result = await api.publishToParagraph(activeQueryId, apiKey);
      if (result.success && result.url) {
        showToast("Draft published to Paragraph! 📝", "success");
        window.open(result.url, '_blank');
      } else {
        throw new Error("Failed to get draft URL");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to publish draft. Check API Key.", "error");
    } finally {
      setIsPublishingToParagraph(false);
    }
  }, [activeQueryId, showToast]);

  const onParagraphConnect = useCallback((key: string) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem('trende:paragraph_api_key', key);
    }
    handlePublishToParagraph(key);
  }, [handlePublishToParagraph]);


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
            >
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center shrink-0 ${isSoft ? 'rounded-full' : ''}`}
                style={{
                  backgroundColor: "var(--accent-cyan)",
                  boxShadow: isSoft ? "var(--soft-shadow-out)" : "2px 2px 0px 0px var(--shadow-color)",
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
              <WalletButton compact />
              <ThemeToggle />
              <IconButton
                icon={<RefreshCw className="w-5 h-5" />}
                onClick={() => refresh()}
                disabled={!queryId}
                ariaLabel="Refresh"
              />
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2.5 min-h-[44px] min-w-[44px] border-2 transition-all flex items-center justify-center ${showHistory
                  ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                  : "bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)]"
                  } ${isSoft ? 'soft-ui-button border-0 rounded-xl' : ''}`}
                style={{
                  boxShadow: isSoft
                    ? (showHistory ? 'var(--soft-shadow-in)' : 'var(--soft-shadow-out)')
                    : "2px 2px 0px 0px var(--shadow-color)",
                  backgroundColor: isSoft ? 'var(--soft-bg)' : undefined,
                  color: isSoft ? 'var(--text-primary)' : undefined
                }}
                aria-label="History"
              >
                <History className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <ParagraphConnectModal
        isOpen={isParagraphModalOpen}
        onClose={() => setIsParagraphModalOpen(false)}
        onConnect={onParagraphConnect}
      />

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
            <div className="px-4 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={historyMode === "recent" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setHistoryMode("recent")}
                >
                  Recent
                </Button>
                <Button
                  variant={historyMode === "saved" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setHistoryMode("saved")}
                  disabled={!isConnected}
                >
                  Saved
                </Button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto">
              {historyMode === "saved" && !isConnected ? (
                <p className="text-[var(--text-muted)] font-mono text-sm">
                  CONNECT WALLET TO VIEW SAVED RESEARCH
                </p>
              ) : historyMode === "saved" ? (
                savedLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-16 bg-[var(--bg-primary)] border-2 border-[var(--text-muted)]"
                      />
                    ))}
                  </div>
                ) : savedResearch.length === 0 ? (
                  <p className="text-[var(--text-muted)] font-mono">
                    NO SAVED RUNS YET. SAVE A COMPLETED RUN TO SEE IT HERE.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {savedResearch.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelectHistory(item.id)}
                        className="w-full text-left p-3 bg-[var(--bg-primary)] border-2 border-[var(--text-muted)] hover:border-[var(--accent-cyan)] transition-colors"
                      >
                        <p className="text-sm line-clamp-2 font-mono">
                          {item.saveLabel || item.idea}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 font-mono bg-[var(--accent-emerald)] text-[var(--bg-primary)]">
                            {item.visibility.toUpperCase()}
                          </span>
                          {item.ipfsUri && (
                            <span className="text-xs px-2 py-0.5 font-mono bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                              ARCHIVED
                            </span>
                          )}
                          <span className="text-xs text-[var(--text-muted)] font-mono">
                            {new Date(item.savedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : historyLoading ? (
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
                  NO MISSIONS ON RECORD. THIS LIST SHOWS SERVER-STORED RUNS.
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

        {/* Commons Snapshot */}
        <Card accent="emerald" className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListTree className="w-4 h-4 text-[var(--accent-emerald)]" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Community Commons
                </h3>
                <p className="text-xs font-mono text-[var(--text-muted)]">
                  Public completed research runs from the network
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {commonsLoading ? "Loading..." : `${commonsResearch.length} runs`}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCommons((prev) => !prev)}
              >
                {showCommons ? "Hide" : "Explore"}
              </Button>
              <Link href="/commons">
                <Button variant="ghost" size="sm">
                  Full Page
                  <ExternalLink className="w-3.5 h-3.5 ml-1 inline-block" />
                </Button>
              </Link>
            </div>
          </div>

          {showCommons && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={commonsSearch}
                  onChange={(event) => {
                    setCommonsSearch(event.target.value);
                    setCommonsVisibleCount(6);
                  }}
                  placeholder="Filter by topic or platform..."
                  className="w-full px-3 py-2 bg-[var(--bg-primary)] border-2 border-[var(--border-color)] font-mono text-sm focus:outline-none focus:border-[var(--accent-emerald)]"
                />
                <div className="text-xs font-mono text-[var(--text-muted)] border-2 border-[var(--border-color)] px-3 py-2 bg-[var(--bg-primary)]">
                  Showing {visibleCommons.length} / {filteredCommons.length}
                </div>
              </div>

              {commonsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {[1, 2, 3].map((index) => (
                    <div
                      key={index}
                      className="h-36 border-2 border-[var(--border-color)] bg-[var(--bg-primary)] animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredCommons.length === 0 ? (
                <div className="p-4 border-2 border-dashed border-[var(--border-color)] text-sm font-mono text-[var(--text-muted)]">
                  No commons runs match this filter.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {visibleCommons.map((item) => (
                      <div
                        key={item.id}
                        className="border-2 border-[var(--border-color)] bg-[var(--bg-primary)] p-3 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-mono text-sm line-clamp-3">{item.topic}</p>
                          {item.hasAttestation && (
                            <span className="shrink-0 text-[10px] font-black uppercase px-2 py-0.5 bg-[var(--accent-emerald)] text-[var(--bg-primary)]">
                              Attested
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {item.platforms.slice(0, 4).map((platform) => (
                            <span
                              key={platform}
                              className="text-[10px] font-mono px-1.5 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] uppercase"
                            >
                              {platform}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
                          <span>
                            {item.sponsor
                              ? `${item.sponsor.slice(0, 6)}...${item.sponsor.slice(-4)}`
                              : "Anonymous"}
                          </span>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleLoadCommonsItem(item.id)}
                          >
                            Load Here
                          </Button>
                          <Link href={`/proof/${item.id}`} className="flex-1">
                            <Button variant="ghost" size="sm" className="w-full">
                              Open Proof
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredCommons.length > visibleCommons.length && (
                    <div className="flex justify-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setCommonsVisibleCount((prev) => Math.min(prev + 6, filteredCommons.length))
                        }
                      >
                        Load More
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

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

        {/* Results View */}
        {activeQueryId && !isProcessing && status === "completed" && data?.results && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Mission Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight mb-2">
                  {data.query?.idea || "Mission Debrief"}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[var(--text-muted)]">
                  <span className="bg-[var(--bg-secondary)] px-2 py-0.5 border border-[var(--border-color)]">
                    ID: {activeQueryId.slice(0, 8)}
                  </span>
                  <span>
                    Started: {new Date(data.query?.createdAt || "").toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handlePublishToParagraph()}
                  disabled={isPublishingToParagraph}
                  className="bg-stone-900 border-stone-700 text-stone-100 hover:bg-stone-800"
                >
                  {isPublishingToParagraph ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <span className="mr-1">✍️</span>
                  )}
                  {isPublishingToParagraph ? "Publishing..." : "Draft on Paragraph"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadReport}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Download Report
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCopyBrief}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy Brief
                </Button>

                <div className="flex gap-1">
                  <IconButton
                    icon={<Share2 className="w-4 h-4" />}
                    onClick={handleCopyShareLink}
                    ariaLabel="Share Link"
                  />
                  <IconButton
                    icon={<Megaphone className="w-4 h-4" />}
                    onClick={handleCopySocialPost}
                    ariaLabel="Share Social"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <details open={briefOpen} onToggle={(e) => setBriefOpen(e.currentTarget.open)} className="group" id="brief">
                  <summary className="list-none cursor-pointer">
                    <Card accent="white" className="p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Sparkles className="w-4 h-4 text-[var(--accent-cyan)]" />
                          <div className="min-w-0">
                            <span className="text-sm font-black uppercase tracking-wider block">
                              Conviction Brief
                            </span>
                            <span className="text-[10px] font-mono text-[var(--text-muted)] block truncate">
                              {panelSummaries.brief}
                            </span>
                          </div>
                        </div>
                        <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                      </div>
                    </Card>
                  </summary>
                  <div className="mt-3">
                    <TrendSummary summary={data.summary} />
                  </div>
                </details>
              </div>

              <div className="md:col-span-1">
                <details className="group" id="drivers">
                  <summary className="list-none cursor-pointer">
                    <Card accent="amber" className="p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Layers3 className="w-4 h-4 text-[var(--accent-amber)]" />
                          <div className="min-w-0">
                            <span className="text-sm font-black uppercase tracking-wider block">
                              Confidence Drivers
                            </span>
                            <span className="text-[10px] font-mono text-[var(--text-muted)] block truncate">
                              {panelSummaries.drivers}
                            </span>
                          </div>
                        </div>
                        <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                      </div>
                    </Card>
                  </summary>
                  <div className="mt-3 space-y-3">
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
              </div>

              <div className="md:col-span-1">
                <details className="group" id="risks">
                  <summary className="list-none cursor-pointer">
                    <Card accent="rose" className="p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-[var(--accent-rose)]" />
                          <div className="min-w-0">
                            <span className="text-sm font-black uppercase tracking-wider block">
                              Reliability & Gaps
                            </span>
                            <span className="text-[10px] font-mono text-[var(--text-muted)] block truncate">
                              {panelSummaries.risks}
                            </span>
                          </div>
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
                      <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                        <a className="underline underline-offset-2" href="https://api.gdeltproject.org/api/v2/doc/doc" target="_blank" rel="noreferrer">GDELT DOC 2.0</a>
                        <a className="underline underline-offset-2" href="https://stream.wikimedia.org/" target="_blank" rel="noreferrer">Wikimedia EventStreams</a>
                        <a className="underline underline-offset-2" href="https://github.com/HackerNews/API" target="_blank" rel="noreferrer">Hacker News API</a>
                        <a className="underline underline-offset-2" href="https://api.stackexchange.com/docs" target="_blank" rel="noreferrer">Stack Exchange API</a>
                      </div>
                    </Card>
                  </div>
                </details>
              </div>

              <div className="md:col-span-2">
                <details open className="group" id="feed">
                  <summary className="list-none cursor-pointer">
                    <Card accent="cyan" className="p-3 sm:p-4">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <span className="text-sm font-black uppercase tracking-wider block">
                            Signal Feed
                          </span>
                          <span className="text-[10px] font-mono text-[var(--text-muted)] block truncate">
                            {panelSummaries.feed}
                          </span>
                        </div>
                        <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                      </div>
                    </Card>
                  </summary>
                  <div className="mt-3">
                    <PlatformTabs results={data.results} />
                  </div>
                </details>
              </div>

              {showForgeInline && data.summary && activeQueryId && (
                <div className="md:col-span-2">
                  <details open className="group" id="forge">
                    <summary className="list-none cursor-pointer">
                      <Card accent="emerald" className="p-3 sm:p-4">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <span className="text-sm font-black uppercase tracking-wider block">
                              Inline Forge Workspace
                            </span>
                            <span className="text-[10px] font-mono text-[var(--text-muted)] block truncate">
                              {panelSummaries.forge}
                            </span>
                          </div>
                          <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                        </div>
                      </Card>
                    </summary>
                    <div className="mt-3">
                      <ForgeViewer summary={data.summary} mode="news" queryId={activeQueryId} />
                    </div>
                  </details>
                </div>
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
