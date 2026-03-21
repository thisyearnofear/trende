"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTrendData, useTrendHistory, useCommons, useSavedResearch } from "@/hooks/useTrendData";
import { QueryInput, MISSION_PROFILES } from "@/components/QueryInput";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { QueryRequest } from "@/lib/types";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import {
  RefreshCw,
  History,
  Github,
  MessageCircle,
  ListTree,
  Loader2,
  Sparkles,
  Zap,
  Shield,
  FileCheck,
  Search,
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, Button, IconButton, Tooltip, InfoIcon } from "@/components/DesignSystem";
import { Onboarding } from "@/components/Onboarding";
import { useWallet } from "@/components/WalletProvider";
import { useTheme } from "@/components/ThemeProvider";
import { ParagraphConnectModal } from "@/components/integrations/ParagraphConnectModal";
import { WalletButton } from "@/components/WalletButton";
import { RunFlowDivider } from "@/components/RunFlowDivider";

import { HeroSection } from "./_components/HeroSection";
import { IntelligenceEngineSection } from "./_components/IntelligenceEngineSection";
import { CommonsSection } from "./_components/CommonsSection";
import { VerificationCard } from "./_components/VerificationCard";
import { HistoryPanel } from "./_components/HistoryPanel";
import { ResultsView } from "./_components/ResultsView";
import { AskTrende } from "./_components/AskTrende";

const LAST_QUERY_STORAGE_KEY = "trende:last_query_id";
const AGENT_THREAD_STORAGE_KEY = "trende:agent_threads";

type AgentReply = {
  q: string;
  a: string;
  citations: string[];
  ts: number;
};

function inferMissionProfileId(input: {
  platforms: string[];
  models?: string[];
  threshold?: number;
}): string | null {
  const platforms = input.platforms || [];
  if (platforms.length === 0) return null;
  const models = input.models || [];
  const threshold = input.threshold ?? 0.6;

  let bestId: string | null = null;
  let bestScore = -1;

  for (const profile of MISSION_PROFILES) {
    const sharedPlatforms = profile.platforms.filter((p) => platforms.includes(p)).length;
    const platformUnion = new Set([...profile.platforms, ...platforms]).size;
    const platformScore = platformUnion > 0 ? (sharedPlatforms / platformUnion) * 5 : 0;

    let modelScore = 0;
    if (models.length > 0) {
      const sharedModels = profile.models.filter((m) => models.includes(m)).length;
      const modelUnion = new Set([...profile.models, ...models]).size;
      modelScore = modelUnion > 0 ? (sharedModels / modelUnion) * 3 : 0;
    }

    const thresholdScore = Math.max(0, 2 - Math.abs(profile.threshold - threshold) * 4);
    const score = platformScore + modelScore + thresholdScore;

    if (score > bestScore) {
      bestScore = score;
      bestId = profile.id;
    }
  }

  return bestScore >= 2.5 ? bestId : null;
}

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
  const [runStartedAtMs, setRunStartedAtMs] = useState<number | null>(null);
  const [showReportInline, setShowReportInline] = useState(false);
  const reportAutoInitForQueryRef = useRef<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(true);
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentReplies, setAgentReplies] = useState<AgentReply[]>([]);
  const [showCommons, setShowCommons] = useState(true);
  const [commonsSearch, setCommonsSearch] = useState("");
  const [commonsVisibleCount, setCommonsVisibleCount] = useState(2);
  const [pendingProcessingFocus, setPendingProcessingFocus] = useState(false);


  const { showToast } = useToast();
  const { isConnected } = useWallet();
  const missionFocusRef = useRef<HTMLDivElement | null>(null);
  const commonsFocusRef = useRef<HTMLDivElement | null>(null);

  const focusProcessingSection = useCallback(() => {
    missionFocusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleStaleQuery = useCallback(
    (staleId: string) => {
      setQueryId((current) => (current === staleId ? null : current));
      setLastQuery(null);
      setRunStartedAtMs(null);
      setElapsedSeconds(0);
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(LAST_QUERY_STORAGE_KEY);
        if (stored === staleId) {
          window.localStorage.removeItem(LAST_QUERY_STORAGE_KEY);
        }
      }
      showToast("Previous research was not found on backend. Please start a new research.", "info");
    },
    [showToast],
  );

  const {
    status,
    data,
    isProcessing,
    progress,
    events,
    startAnalysis,
    refresh,
  } = useTrendData(queryId, { onNotFound: handleStaleQuery });
  const activeQueryId = data?.query?.id || queryId;
  const { queries: history, isLoading: historyLoading, refresh: refreshHistory } = useTrendHistory();
  const { saved: savedResearch, isLoading: savedLoading, refresh: refreshSaved } = useSavedResearch(isConnected);
  const { research: commonsResearch, isLoading: commonsLoading, refresh: refreshCommons } = useCommons();

  const filteredCommons = useMemo(() => {
    const search = commonsSearch.trim().toLowerCase();
    if (!search) return commonsResearch;

    return commonsResearch.filter((item) => {
      const topicMatch = item.topic?.toLowerCase().includes(search);
      const sponsorMatch = (item.sponsor ?? "").toLowerCase().includes(search);
      const platformsMatch = (item.platforms ?? []).some((p) => p.toLowerCase().includes(search));
      return topicMatch || sponsorMatch || platformsMatch;
    });
  }, [commonsResearch, commonsSearch]);

  const visibleCommons = useMemo(
    () => filteredCommons.slice(0, commonsVisibleCount),
    [filteredCommons, commonsVisibleCount]
  );
  const [saveVisibility, setSaveVisibility] = useState<"private" | "unlisted" | "public">("private");
  const [isSavingResearch, setIsSavingResearch] = useState(false);
  const isRunActive = isProcessing || ["pending", "planning", "researching", "analyzing", "processing"].includes(status || "");
  const latestCompletedQueryId = useMemo(
    () => history.find((item) => item.status === "completed")?.id || null,
    [history]
  );

  const activeMissionProfileId = useMemo(() => {
    const platforms = lastQuery?.platforms ?? data?.query?.platforms ?? [];
    const models = lastQuery?.models;
    const threshold = lastQuery?.relevanceThreshold ?? data?.query?.relevanceThreshold;
    return inferMissionProfileId({ platforms, models, threshold });
  }, [lastQuery, data?.query?.platforms, data?.query?.relevanceThreshold]);

  const resultsFlowCopy = useMemo(() => {
    if (activeMissionProfileId === "due-diligence") {
      return {
        brief: "Technical conviction, reliability gating, and proof-led findings.",
        report: "Consensus integrity checks and proof-ready synthesis for verifiable use.",
        feed: "Source-level evidence prioritized for reproducibility and deep validation.",
      };
    }
    if (activeMissionProfileId === "market-intel") {
      return {
        brief: "Macro narrative, market context, and directional confidence summary.",
        report: "Model divergence compressed into actionable market intelligence pathways.",
        feed: "Platform-by-platform signal tape with market-relevant evidence trails.",
      };
    }
    return {
      brief: "Top-line thesis, confidence drivers, and reliability gaps.",
      report: "Consensus outputs prepared for proof packaging and downstream actions.",
      feed: "Source-level signal feed and platform breakdown.",
    };
  }, [activeMissionProfileId]);

  const handleSubmit = useCallback(
    async (request: QueryRequest) => {
      try {
        const requestWithVisibility: QueryRequest = {
          ...request,
          visibility: saveVisibility,
        };
        setLastQuery(requestWithVisibility);
        setRunStartedAtMs(Date.now());
        setElapsedSeconds(0);
        setPendingProcessingFocus(true);
        const response = await startAnalysis(requestWithVisibility);
        setQueryId(response.id);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LAST_QUERY_STORAGE_KEY, response.id);
        }
        window.setTimeout(() => {
          focusProcessingSection();
        }, 160);
      } catch (error) {
        console.error("Failed to start analysis:", error);
        showToast("Failed to start analysis. Please try again.", "error");
      }
    },
    [saveVisibility, startAnalysis, focusProcessingSection, showToast]
  );

  const handleHistorySelect = useCallback(
    (id: string) => {
      setQueryId(id);
      setShowHistory(false);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LAST_QUERY_STORAGE_KEY, id);
      }
    },
    []
  );

  const handleSaveResearch = useCallback(
    async (label: string, tags: string[]) => {
      if (!activeQueryId) return;
      setIsSavingResearch(true);
      try {
        await api.saveResearch(activeQueryId, {
          visibility: saveVisibility,
          saveLabel: label,
          tags,
        });
        showToast("Research saved successfully!", "success");
        refreshSaved();
      } catch (error) {
        console.error("Failed to save research:", error);
        showToast("Failed to save research. Please try again.", "error");
      } finally {
        setIsSavingResearch(false);
      }
    },
    [activeQueryId, saveVisibility, showToast, refreshSaved]
  );

  // Real AI-powered Ask Trende (Phase 3b improvement)
  const handleAskTrende = useCallback(async (seed?: string) => {
    const question = (seed ?? agentPrompt).trim();
    if (!question || !queryId) return;

    // Add user question immediately
    setAgentReplies((prev) => [...prev.slice(-7), { 
      q: question, 
      a: "Thinking...", 
      citations: [], 
      ts: Date.now() 
    }]);
    setAgentPrompt("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/trends/${queryId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error('Failed to get answer');
      }

      const result = await response.json();
      
      // Update with real answer
      setAgentReplies((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (updated[lastIndex]?.q === question) {
          updated[lastIndex] = {
            q: question,
            a: result.answer,
            citations: result.citations || [],
            ts: Date.now(),
          };
        }
        return updated;
      });
    } catch (error) {
      console.error('Ask Trende error:', error);
      // Update with error message
      setAgentReplies((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (updated[lastIndex]?.q === question) {
          updated[lastIndex] = {
            q: question,
            a: "Sorry, I couldn't generate an answer. Please try again.",
            citations: [],
            ts: Date.now(),
          };
        }
        return updated;
      });
    }
  }, [agentPrompt, queryId]);

  const askTrendeSuggestions = useMemo(
    () => [
      "What are the key disagreements?",
      "Which sources contributed most?",
      "What's the confidence level?",
      "What should I do next?",
    ],
    []
  );

  // Agent thread persistence
  useEffect(() => {
    if (!activeQueryId || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(AGENT_THREAD_STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      const thread = Array.isArray(all?.[activeQueryId]) ? all[activeQueryId] : [];
      setAgentReplies(thread);
    } catch {
      setAgentReplies([]);
    }
  }, [activeQueryId]);

  useEffect(() => {
    if (!activeQueryId || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(AGENT_THREAD_STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[activeQueryId] = agentReplies;
      window.localStorage.setItem(AGENT_THREAD_STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Ignore storage errors
    }
  }, [activeQueryId, agentReplies]);

  // Elapsed time tracking
  useEffect(() => {
    if (!isRunActive || !runStartedAtMs) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - runStartedAtMs) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunActive, runStartedAtMs]);

  // Auto-scroll to processing section
  useEffect(() => {
    if (pendingProcessingFocus && isRunActive) {
      setPendingProcessingFocus(false);
      window.setTimeout(() => {
        focusProcessingSection();
      }, 300);
    }
  }, [pendingProcessingFocus, isRunActive, focusProcessingSection]);

  // Auto-show report when completed
  useEffect(() => {
    if (status === "completed" && activeQueryId && reportAutoInitForQueryRef.current !== activeQueryId) {
      reportAutoInitForQueryRef.current = activeQueryId;
      setShowReportInline(true);
    }
  }, [status, activeQueryId]);

  const [paragraphModalOpen, setParagraphModalOpen] = useState(false);

  const handleParagraphConnect = useCallback((apiKey: string) => {
    if (typeof window === "undefined") return;
    // Store locally for now; backend can read it if needed via headers/env in the future.
    window.localStorage.setItem("trende:paragraph_api_key", apiKey);
    showToast("Paragraph connected.", "success");
  }, [showToast]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Onboarding />
      <ParagraphConnectModal
        isOpen={paragraphModalOpen}
        onClose={() => setParagraphModalOpen(false)}
        onConnect={handleParagraphConnect}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/5 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">Trende</span>
          </Link>

          <div className="flex items-center gap-2">
            <IconButton
              icon={<History className="w-4 h-4" />}
              onClick={() => setShowHistory(!showHistory)}
              ariaLabel="Research History"
            />
            <ThemeToggle />
            <WalletButton />
            <Link
              href="https://github.com/thisyearnofear/trende"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconButton icon={<Github className="w-4 h-4" />} ariaLabel="GitHub" />
            </Link>
            <Link
              href="https://discord.gg/trende"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconButton icon={<MessageCircle className="w-4 h-4" />} ariaLabel="Discord" />
            </Link>
          </div>
        </div>
      </header>

      {/* History Panel */}
      <HistoryPanel
        showHistory={showHistory}
        onClose={() => setShowHistory(false)}
        historyMode={historyMode}
        setHistoryMode={setHistoryMode}
        history={history}
        historyLoading={historyLoading}
        savedResearch={savedResearch}
        savedLoading={savedLoading}
        isConnected={isConnected}
        onSelectHistory={handleHistorySelect}
      />

      <main className="container mx-auto px-4 py-8 space-y-12">
        {/* Hero Section */}
        <HeroSection />

        {/* Intelligence Engine Steps */}
        <IntelligenceEngineSection
          onCopyOpenClawStarter={async () => {
            try {
              const snippet = `# OpenClaw ACP starter\n# Docs: https://github.com/Virtual-Protocol/openclaw-acp\n\nexport TRENDE_API_URL=${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}\n# TODO: configure your x402 / wallet signing\n`;
              await navigator.clipboard.writeText(snippet);
              showToast("Copied OpenClaw starter.", "success");
            } catch {
              showToast("Failed to copy starter.", "error");
            }
          }}
        />

        {/* Research Control */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Zap className="w-6 h-6 text-[var(--accent-amber)]" />
              Research Control
            </h2>
            {activeQueryId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={refresh}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            )}
          </div>

          <QueryInput
            onSubmit={handleSubmit}
            isLoading={isProcessing}
          />
        </section>

        {/* Processing Status */}
        {isRunActive && (
          <div ref={missionFocusRef}>
            <ProcessingStatus
              status={status}
              progress={progress}
              events={events}
              isProcessing={isProcessing}
              elapsedSeconds={elapsedSeconds}
            />
          </div>
        )}

        {/* Results */}
        {data && status === "completed" && (
          <ResultsView
            data={data}
            activeQueryId={activeQueryId}
            briefOpen={briefOpen}
            setBriefOpen={setBriefOpen}
            showReportInline={showReportInline}
            setShowReportInline={setShowReportInline}
            resultsFlowCopy={resultsFlowCopy}
            onSaveResearch={handleSaveResearch}
            isSavingResearch={isSavingResearch}
          />
        )}

        {/* Ask Trende - Only show when results are available */}
        {data && status === "completed" && (
          <AskTrende
            agentPrompt={agentPrompt}
            setAgentPrompt={setAgentPrompt}
            agentReplies={agentReplies}
            onAsk={handleAskTrende}
            suggestions={askTrendeSuggestions}
          />
        )}

        {/* Verification */}
        {data && (
          <VerificationCard
            variant={status === "completed" ? "results" : "info"}
            verification={data.telemetry?.trustStack}
            chainlinkStatusLabel={data.telemetry?.chainlinkProof?.status || data.telemetry?.trustStack?.chainlink?.status || "available"}
          />
        )}

        {/* Commons Section */}
        <div ref={commonsFocusRef}>
          <CommonsSection
            showCommons={showCommons}
            setShowCommons={setShowCommons}
            commonsResearch={commonsResearch}
            commonsLoading={commonsLoading}
            commonsSearch={commonsSearch}
            setCommonsSearch={setCommonsSearch}
            visibleCommons={visibleCommons}
            filteredCommons={filteredCommons}
            setCommonsVisibleCount={setCommonsVisibleCount}
            onLoadItem={(id) => {
              setQueryId(id);
              setShowCommons(false);
              if (typeof window !== "undefined") {
                window.localStorage.setItem(LAST_QUERY_STORAGE_KEY, id);
              }
              void refreshCommons();
            }}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-[var(--text-muted)]">
          <p>
            Built with{" "}
            <Link href="https://venice.ai" className="text-[var(--accent-cyan)] hover:underline">
              Venice AI
            </Link>
            {" • "}
            <Link href="https://www.hetzner.com" className="text-[var(--accent-purple)] hover:underline">
              Hetzner
            </Link>
            {" • "}
            <Link href="https://chain.link" className="text-[var(--accent-amber)] hover:underline">
              Chainlink
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
