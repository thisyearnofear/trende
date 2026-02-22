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
  Clock,
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
  Search,
  Shield,
  FileCheck,
  Github,
  MessageCircle,
  Radio,
} from "lucide-react";
import { ScrambleText, ScrambleWords, GlowText } from "@/components/ScrambleText";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, Button, IconButton, Tooltip, InfoIcon, Progress } from "@/components/DesignSystem";
import { Onboarding } from "@/components/Onboarding";
import { useWallet } from "@/components/WalletProvider";
import { useTheme } from "@/components/ThemeProvider";
import { ParagraphConnectModal } from "@/components/integrations/ParagraphConnectModal";
import { WalletButton } from "@/components/WalletButton";
import { cn } from "@/lib/utils";

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
  const [showCommons, setShowCommons] = useState(true);
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
  const { queries: history, isLoading: historyLoading, refresh: refreshHistory } = useTrendHistory();
  const { saved: savedResearch, isLoading: savedLoading, refresh: refreshSaved } = useSavedResearch(isConnected);
  const { research: commonsResearch, isLoading: commonsLoading, refresh: refreshCommons } = useCommons();
  const [saveVisibility, setSaveVisibility] = useState<"private" | "unlisted" | "public">("private");
  const [isSavingResearch, setIsSavingResearch] = useState(false);

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

  const sourceIndexById = useMemo(() => {
    const map: Record<string, number> = {};
    allItems.forEach((item, idx) => {
      if (item?.id && map[item.id] === undefined) {
        map[item.id] = idx + 1;
      }
    });
    return map;
  }, [allItems]);

  const sourceLabelByOrdinal = useMemo(() => {
    const map: Record<number, string> = {};
    allItems.forEach((item, idx) => {
      map[idx] = `S${idx + 1}`;
    });
    return map;
  }, [allItems]);

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
      showToast("Generating report export...", "info");
      const { blob, filename, contentType } = await api.downloadReport(activeQueryId, "pdf");
      if (!contentType?.includes("application/pdf")) {
        throw new Error("Export did not return a PDF");
      }
      if (!blob || blob.size < 1024) {
        throw new Error("Generated report is empty");
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `trende-report-${activeQueryId.slice(0, 8)}.pdf`;
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

  const handleSaveResearch = useCallback(async () => {
    if (!activeQueryId) return;
    if (!isConnected) {
      showToast("Connect wallet before saving research.", "error");
      return;
    }

    setIsSavingResearch(true);
    try {
      await api.saveResearch(activeQueryId, {
        visibility: saveVisibility,
        pinToIpfs: saveVisibility !== "private",
        saveLabel: data?.query?.idea,
      });
      showToast(`Run saved as ${saveVisibility.toUpperCase()}.`, "success");
      refreshHistory();
      refreshSaved();
      refreshCommons();
    } catch (error) {
      console.error(error);
      showToast("Failed to save run.", "error");
    } finally {
      setIsSavingResearch(false);
    }
  }, [
    activeQueryId,
    isConnected,
    saveVisibility,
    data?.query?.idea,
    showToast,
    refreshHistory,
    refreshSaved,
    refreshCommons,
  ]);

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
      if (result.success) {
        if (result.url) {
          showToast("Draft published to Paragraph! 📝", "success");
          window.open(result.url, '_blank');
        } else {
          showToast("Draft generated successfully. Paragraph returned no direct URL.", "success");
        }
      } else {
        throw new Error(result.status || "Draft generation failed");
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
                <p className="text-[10px] font-mono text-[var(--accent-cyan)] truncate flex items-center gap-1">
                  TEE-SECURED
                  <InfoIcon
                    tooltip="Trusted Execution Environment ensures verifiable, tamper-proof analysis with cryptographic attestation."
                    learnMoreUrl="https://en.wikipedia.org/wiki/Trusted_execution_environment"
                    size="sm"
                  />
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <Tooltip content="Connect wallet for saved mission history, ownership, and publishing permissions.">
                <div>
                  <WalletButton compact />
                </div>
              </Tooltip>
              <Tooltip content="Switch between visual themes.">
                <div>
                  <ThemeToggle />
                </div>
              </Tooltip>
              <Tooltip content="Refresh current mission state from backend.">
                <div>
                  <IconButton
                    icon={<RefreshCw className="w-5 h-5" />}
                    onClick={() => refresh()}
                    disabled={!queryId}
                    ariaLabel="Refresh"
                  />
                </div>
              </Tooltip>
              <Tooltip content="Open Mission History (recent + saved runs).">
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
              </Tooltip>
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
            className="absolute inset-0 bg-[var(--bg-primary)]/80"
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
        {/* Hero - Enhanced with kinetic typography */}
        {!queryId && !isProcessing && (
          <Card accent="cyan" shadow="lg" className="p-6 overflow-hidden relative">
            {/* Animated background element */}
            <div className="absolute inset-0 opacity-5 pointer-events-none">
              <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <Fingerprint className="w-5 h-5 text-[var(--accent-cyan)]" />
                <GlowText text="TEE-SECURED EXECUTION // CRYPTOGRAPHICALLY VERIFIABLE" className="text-xs font-mono" color="cyan" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-3">
                <ScrambleWords
                  words={[
                    { text: 'Turn', highlight: false },
                    { text: 'Social', highlight: true },
                    { text: 'Signal', highlight: false },
                    { text: 'Into', highlight: false },
                    { text: 'Conviction-Ready', highlight: true },
                    { text: 'Intelligence', highlight: false },
                  ]}
                  className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-3"
                  stagger={0.15}
                />
              </h2>

              <p className="text-[var(--text-secondary)] font-mono text-sm max-w-2xl mb-4">
                <ScrambleText
                  text="Trende is an autonomous AI agent that investigates crypto narratives across the web and delivers verifiable market intelligence. Click a community report below to see what it can do, or deploy your own agent."
                  delay={0.8}
                  className="text-[var(--text-secondary)] font-mono text-sm max-w-2xl mb-4"
                />
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
                  <div className="w-2 h-2 rounded-full bg-[var(--accent-amber)] animate-pulse" />
                  <span className="text-xs text-[var(--text-secondary)] font-semibold">
                    🤖 TinyFish AI Agent Research
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent-emerald)]" />
                  <span className="text-xs text-[var(--text-secondary)]">
                    Cryptographic Signatures
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}

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
                  Public completed research runs from the network (saved with visibility = PUBLIC)
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
              <p className="text-[11px] font-mono text-[var(--text-muted)]">
                Runs set to <span className="text-[var(--accent-emerald)] font-black">PUBLIC</span> appear here.{" "}
                <span className="text-[var(--text-secondary)]">UNLISTED runs stay shareable via direct proof link only.</span>
              </p>

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

        {/* Query Input */}
        <QueryInput
          onSubmit={handleSubmit}
          isLoading={isProcessing}
          disabled={isProcessing}
        />

        {/* Processing Status */}
        {(isProcessing || status === "processing") && (
          <ProcessingStatus
            status={status}
            progress={progress}
            events={events}
            isProcessing={isProcessing}
            elapsedSeconds={elapsedSeconds}
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
        )}

        {/* Results */}

        {/* Results View */}
        {activeQueryId && !isProcessing && status === "completed" && data?.results && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Mission Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 glass rounded-2xl border-white/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-transparent pointer-events-none" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">Mission Finalized</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-2">
                  {data.query?.idea || "Intelligence Report"}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-white/40">
                  <span className="flex items-center gap-1.5 px-2 py-0.5 glass border-white/5 rounded text-white/50">
                    <Fingerprint className="w-3 h-3" />
                    ID: {activeQueryId.slice(0, 12)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {new Date(data.query?.createdAt || "").toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 relative z-10">
                <div className="flex items-center gap-2 glass rounded-xl px-2 py-1 border-white/5 group/vis">
                  <select
                    value={saveVisibility}
                    onChange={(event) => setSaveVisibility(event.target.value as "private" | "unlisted" | "public")}
                    className="bg-transparent border-0 px-2 py-2 text-xs font-black uppercase tracking-widest text-white/70 focus:outline-none cursor-pointer"
                  >
                    <option value="private" className="bg-black">Private</option>
                    <option value="unlisted" className="bg-black">Unlisted</option>
                    <option value="public" className="bg-black">Public</option>
                  </select>
                  <Button
                    variant="primary"
                    size="sm"
                    className="rounded-lg shadow-lg shadow-cyan-500/20"
                    onClick={handleSaveResearch}
                    disabled={isSavingResearch || !activeQueryId}
                  >
                    {isSavingResearch ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    {isSavingResearch ? "Vaulting..." : "Secure to Vault"}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Tooltip content="Draft to Paragraph">
                    <IconButton
                      icon={<span className="text-base">✍️</span>}
                      onClick={() => handlePublishToParagraph()}
                      ariaLabel="Paragraph Draft"
                      disabled={isPublishingToParagraph}
                    />
                  </Tooltip>
                  <Tooltip content="Download PDF">
                    <IconButton
                      icon={<Copy className="w-4 h-4" />}
                      onClick={handleDownloadReport}
                      ariaLabel="Download"
                    />
                  </Tooltip>
                  <Tooltip content="Share Link">
                    <IconButton
                      icon={<Share2 className="w-4 h-4" />}
                      onClick={handleCopyShareLink}
                      ariaLabel="Share"
                    />
                  </Tooltip>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <details open={briefOpen} onToggle={(e) => setBriefOpen(e.currentTarget.open)} className="group" id="brief">
                  <summary className="list-none cursor-pointer">
                    <div className="flex items-center justify-between p-4 glass rounded-xl border-white/5 group-hover:border-white/20 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                          <Sparkles className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-black uppercase tracking-widest text-white block">
                            Conviction Brief
                          </span>
                          <span className="text-[10px] font-mono text-cyan-400/50 block truncate uppercase tracking-tighter">
                            {panelSummaries.brief}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 glass border-emerald-500/20 rounded-full">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_var(--accent-emerald)]" />
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{weightedConfidence}% Score</span>
                        </div>
                        <ChevronDown className="w-5 h-5 text-white/20 transition-transform group-open:rotate-180" />
                      </div>
                    </div>
                  </summary>
                  <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                    <TrendSummary summary={data.summary} sourceLabelByOrdinal={sourceLabelByOrdinal} />
                  </div>
                </details>
              </div>

              <div className="md:col-span-1">
                <details className="group" id="drivers" open={true}>
                  <summary className="list-none cursor-pointer">
                    <div className="flex items-center justify-between p-4 glass rounded-xl border-white/5 hover:border-white/20 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                          <Layers3 className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-black uppercase tracking-widest text-white block flex items-center gap-1.5">
                            Confidence Drivers
                            <InfoIcon
                              tooltip="Agreement level across multiple AI models (Venice, Gemini, etc.) weighted by data quality and recency."
                              size="sm"
                            />
                          </span>
                          <span className="text-[10px] font-mono text-white/40 block truncate uppercase tracking-tighter">
                            {panelSummaries.drivers}
                          </span>
                        </div>
                      </div>
                      <ChevronDown className="w-5 h-5 text-white/20 transition-transform group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-left-2">
                    {confidenceDrivers.map((driver) => (
                      <div key={driver.label} className="p-4 glass rounded-xl border-white/5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] uppercase font-black tracking-widest text-white/40">
                            {driver.label}
                          </p>
                          <p className="font-black text-white text-sm">{driver.value}%</p>
                        </div>
                        <Progress value={driver.value} accent={driver.accent} />
                        <p className="text-[9px] uppercase font-mono text-white/20 mt-3 text-right">
                          Weight {Math.round(driver.weight * 100)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>

              <div className="md:col-span-1">
                <details className="group" id="risks" open={true}>
                  <summary className="list-none cursor-pointer">
                    <div className="flex items-center justify-between p-4 glass rounded-xl border-white/5 hover:border-white/20 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                          <AlertTriangle className="w-5 h-5 text-rose-500" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-black uppercase tracking-widest text-white block flex items-center gap-1.5">
                            Reliability & Gaps
                            <InfoIcon
                              tooltip="Known gaps or biases in the evidence base, including data recency, source diversity, and coverage limitations."
                              size="sm"
                            />
                          </span>
                          <span className="text-[10px] font-mono text-white/40 block truncate uppercase tracking-tighter">
                            {panelSummaries.risks}
                          </span>
                        </div>
                      </div>
                      <ChevronDown className="w-5 h-5 text-white/20 transition-transform group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-right-2">
                    {reliabilityFlags.length === 0 ? (
                      <div className="p-4 glass rounded-xl border-emerald-500/20 text-xs font-mono text-emerald-400">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          No critical reliability gaps detected.
                        </div>
                      </div>
                    ) : (
                      reliabilityFlags.map((flag, index) => (
                        <div key={`${flag}-${index}`} className="p-4 glass rounded-xl border-rose-500/20 text-xs font-mono text-rose-200/80">
                          <div className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1 shrink-0" />
                            {flag}
                          </div>
                        </div>
                      ))
                    )}
                    <div className="p-4 glass rounded-xl border-white/5">
                      <p className="text-[10px] uppercase font-black text-white/40 mb-3 tracking-widest">
                        Evidence pipeline
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-mono p-2 rounded bg-white/5 border border-white/5">
                          <span className="text-white/60">GDELT Doc API</span>
                          <span className="text-emerald-400 font-black">ACTIVE</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono p-2 rounded bg-white/5 border border-white/5 opacity-50">
                          <span className="text-white/60">Coingecko Market</span>
                          <span className="text-white/40 uppercase">Expansion</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              </div>

              <div className="md:col-span-2">
                <details open className="group" id="feed">
                  <summary className="list-none cursor-pointer">
                    <div className="flex items-center justify-between p-4 glass rounded-xl border-white/5 hover:border-white/20 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                          <Radio className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm font-black uppercase tracking-widest text-white block">
                            Signal Feed
                          </span>
                          <span className="text-[10px] font-mono text-cyan-400/50 block truncate uppercase tracking-tighter">
                            {panelSummaries.feed}
                          </span>
                        </div>
                      </div>
                      <ChevronDown className="w-5 h-5 text-white/20 transition-transform group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="mt-4 animate-in fade-in slide-in-from-bottom-2">
                    <PlatformTabs results={data.results} sourceIndexById={sourceIndexById} />
                  </div>
                </details>
              </div>

              {data.summary && activeQueryId && (
                <div className="md:col-span-2">
                  <div className="p-6 glass rounded-2xl border-white/10 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />

                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <Bot className="w-4 h-4 text-emerald-400" />
                          </div>
                          <span className="text-sm font-black uppercase tracking-widest text-white">Forge Intelligence</span>
                          {(data.summary.consensusData?.agreement_score || 0) < 0.65 && (
                            <span className="text-[9px] uppercase font-black px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
                              Disagreement Detected
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-white/50 leading-relaxed max-w-3xl line-clamp-2">
                          {(data.summary.overview || "Deep synthesis of harvested signals is ready for interaction.")}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-4 items-center">
                        <div className="text-center">
                          <p className="text-[9px] uppercase font-black text-white/20 tracking-widest mb-1">Agreement</p>
                          <p className="text-sm font-black text-amber-400">{Math.round((data.summary.consensusData?.agreement_score || 0) * 100)}%</p>
                        </div>
                        <div className="w-px h-8 bg-white/5" />
                        <div className="text-center">
                          <p className="text-[9px] uppercase font-black text-white/20 tracking-widest mb-1">Attestation</p>
                          <p className="text-sm font-black text-emerald-400">READY</p>
                        </div>
                        <div className="w-px h-8 bg-white/5" />
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-white/5 border-white/5 hover:bg-white/10"
                            onClick={() => setShowForgeInline((prev) => !prev)}
                          >
                            {showForgeInline ? "Close Forge" : "Open In-line"}
                          </Button>
                          <Link href={`/proof/${activeQueryId}`}>
                            <Button variant="primary" size="sm" className="shadow-lg shadow-emerald-500/20">
                              Full Forge
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showForgeInline && data.summary && activeQueryId && (
                <div className="md:col-span-2">
                  <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ForgeViewer summary={data.summary} mode="news" queryId={activeQueryId} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Empty State - Enhanced Landing */}
        {!queryId && !isProcessing && (
          <div className="space-y-12 py-8 animate-in fade-in duration-700">
            {/* How It Works - Visual Flow */}
            <div className="relative p-8 glass rounded-[2rem] border-white/10 overflow-hidden group">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-[100px] animate-pulse" />

              <div className="flex flex-col items-center text-center mb-12 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 mb-4">
                  <Sparkles className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white">
                  The Intelligence Engine
                </h3>
                <p className="text-xs font-mono text-white/40 mt-2 uppercase tracking-widest">
                  Verifiable analysis via decentralized AI consensus
                </p>
              </div>

              {/* Flow Diagram */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                {/* Step 1 */}
                <div className="flex flex-col items-center text-center p-4 rounded-2xl transition-all hover:bg-white/5">
                  <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-2xl glass border-cyan-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                      <Zap className="w-8 h-8 text-cyan-400" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-lg bg-black border border-white/10 flex items-center justify-center text-[10px] font-black text-cyan-400">01</div>
                  </div>
                  <h4 className="text-sm font-black uppercase mb-2 text-white">Thesis Entry</h4>
                  <p className="text-[11px] leading-relaxed text-white/40 font-mono">Define your research scope and platform selection.</p>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center text-center p-4 rounded-2xl transition-all hover:bg-white/5 relative">
                  <div className="hidden lg:block absolute top-8 -left-10 w-20 h-px bg-gradient-to-r from-white/10 to-transparent" />
                  <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-2xl glass border-amber-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                      <Search className="w-8 h-8 text-amber-500" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-lg bg-black border border-white/10 flex items-center justify-center text-[10px] font-black text-amber-500">02</div>
                  </div>
                  <h4 className="text-sm font-black uppercase mb-2 text-white">Agent Harvest</h4>
                  <p className="text-[11px] leading-relaxed text-white/40 font-mono">Distributed agents collect cross-platform signal clusters.</p>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center text-center p-4 rounded-2xl transition-all hover:bg-white/5 relative">
                  <div className="hidden lg:block absolute top-8 -left-10 w-20 h-px bg-gradient-to-r from-white/10 to-transparent" />
                  <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-2xl glass border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                      <Shield className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-lg bg-black border border-white/10 flex items-center justify-center text-[10px] font-black text-emerald-400">03</div>
                  </div>
                  <h4 className="text-sm font-black uppercase mb-2 text-white">TEE Consensus</h4>
                  <div className="text-[11px] leading-relaxed text-white/40 font-mono">Multi-model validation with hardware-secured proof.</div>
                </div>

                {/* Step 4 */}
                <div className="flex flex-col items-center text-center p-4 rounded-2xl transition-all hover:bg-white/5 relative">
                  <div className="hidden lg:block absolute top-8 -left-10 w-20 h-px bg-gradient-to-r from-white/10 to-transparent" />
                  <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-2xl glass border-violet-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                      <FileCheck className="w-8 h-8 text-violet-400" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-lg bg-black border border-white/10 flex items-center justify-center text-[10px] font-black text-violet-400">04</div>
                  </div>
                  <h4 className="text-sm font-black uppercase mb-2 text-white">Verified Intel</h4>
                  <p className="text-[11px] leading-relaxed text-white/40 font-mono">Final conviction brief with cryptographic attestation.</p>
                </div>
              </div>
            </div>

            {/* CTA + Footer */}
            <div className="text-center py-8 border-t-2 border-[var(--border-color)]">
              <h3 className="text-2xl font-black uppercase mb-3">
                Ready to Discover Conviction?
              </h3>
              <p className="text-[var(--text-muted)] font-mono text-sm max-w-lg mx-auto mb-6">
                Enter your research brief above. Trende executes in a TEE-secured
                environment and returns cryptographically verifiable intelligence.
              </p>

              {/* Footer Links */}
              <div className="flex flex-wrap justify-center gap-6 pt-6 border-t border-[var(--border-color)]">
                <a
                  href="https://github.com/thisyearnofear/trende"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors"
                >
                  <Github className="w-4 h-4" />
                  <span className="font-mono">GitHub</span>
                </a>
                <a
                  href="https://farcaster.xyz/papa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent-amber)] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="font-mono">Developer</span>
                </a>
                <Link
                  href="/commons"
                  className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent-emerald)] transition-colors"
                >
                  <ListTree className="w-4 h-4" />
                  <span className="font-mono">Community Commons</span>
                </Link>
              </div>

              <p className="text-[10px] text-[var(--text-muted)] mt-6 font-mono">
                © 2026 Trende • TEE-SECURED INTELLIGENCE
              </p>
            </div>
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
