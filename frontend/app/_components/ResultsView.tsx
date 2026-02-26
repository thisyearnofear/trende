"use client";

import { Card, Button, IconButton, Tooltip } from "@/components/DesignSystem";
import { TrendSummary } from "@/components/TrendSummary";
import { ForgeViewer } from "@/components/ForgeViewer";
import { PlatformTabs } from "@/components/PlatformTabs";
import { RunFlowDivider } from "@/components/RunFlowDivider";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Share2,
  Fingerprint,
  Sparkles,
  Layers3,
  Radio,
  Bot,
  Loader2,
  Shield,
  InfoIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SourceRoute {
  requested_platform: string;
  resolved_source: string | null;
  status: string;
  fallback_used: boolean;
  item_count: number;
}

interface SourceRow {
  platform: string;
  source: string;
  items: number;
}

interface TrustStackData {
  tee?: {
    status: string;
    provider: string;
  };
  consensus?: {
    status: string;
    providers?: { length: number }[];
    agreementScore: number;
  };
  chainlink?: {
    status: string;
    network: string;
    configured?: boolean;
  };
}

interface ConfidenceDriver {
  label: string;
  value: number;
  accent: string;
  weight: number;
}

interface PanelSummaries {
  brief: string;
  drivers: string;
  risks: string;
  feed: string;
  forge: string;
}

interface SummaryData {
  overview?: string;
  confidenceScore?: number;
  consensusData?: {
    agreement_score?: number;
    agreementScore?: number;
    main_divergence?: string;
    providers?: { length: number }[];
    warnings?: string[];
  };
  attestationData?: {
    status: string;
  };
}

interface QueryData {
  id: string;
  idea?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ResultsData {
  query?: QueryData;
  summary?: SummaryData;
  results?: Array<{
    platform: string;
    items: Array<{ id: string; timestamp: string }>;
  }>;
  telemetry?: {
    sourceRoutes?: SourceRoute[];
    sourceBreakdown?: SourceRow[];
    chainlinkProof?: {
      status?: string;
      network?: string;
      requestId?: string;
      txHash?: string;
      oracleSettlement?: string;
      explorerUrl?: string;
    };
    trustStack?: TrustStackData;
    warnings?: string[];
  };
}

interface ResultsViewProps {
  activeQueryId: string;
  data: ResultsData;
  briefOpen: boolean;
  setBriefOpen: (open: boolean) => void;
  showForgeInline: boolean;
  setShowForgeInline: (show: boolean) => void;
  weightedConfidence: number;
  confidenceDrivers: ConfidenceDriver[];
  reliabilityFlags: string[];
  panelSummaries: PanelSummaries;
  sourceIndexById: Record<string, number>;
  resultsFlowCopy: {
    brief: string;
    forge: string;
    feed: string;
  };
  forgeAgreement: number;
  forgeAttestationStatus: string;
  sourceRoutes: SourceRoute[];
  sourceBreakdown: SourceRow[];
  chainlinkStatusLabel: string;
  chainlinkProof: ResultsData["telemetry"]["chainlinkProof"];
  trustStack: TrustStackData;
  sourceCount: number;
  stats: { platforms: number };
  onSaveResearch: () => void;
  isSavingResearch: boolean;
  saveVisibility: "private" | "unlisted" | "public";
  setSaveVisibility: (v: "private" | "unlisted" | "public") => void;
  onPublishToParagraph: () => void;
  isPublishingToParagraph: boolean;
  onDownloadReport: () => void;
  onCopyShareLink: () => void;
  onAskTrende: (seed?: string) => void;
  agentReplies: Array<{ q: string; a: string; citations: string[]; ts: number }>;
  agentPrompt: string;
  setAgentPrompt: (prompt: string) => void;
  askSuggestions: string[];
}

function ResultsFlowDivider({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: "brief" | "forge" | "feed";
}) {
  const Icon = icon === "brief" ? Sparkles : icon === "forge" ? Shield : Radio;
  return (
    <div className="md:col-span-2 relative py-1 sm:py-2">
      <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="relative mx-auto max-w-3xl">
        <div className="glass border-white/10 rounded-xl px-4 py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
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

export function ResultsView({
  activeQueryId,
  data,
  briefOpen,
  setBriefOpen,
  showForgeInline,
  setShowForgeInline,
  weightedConfidence,
  confidenceDrivers,
  reliabilityFlags,
  panelSummaries,
  sourceIndexById,
  resultsFlowCopy,
  sourceRoutes,
  sourceBreakdown,
  chainlinkStatusLabel,
  chainlinkProof,
  trustStack,
  sourceCount,
  stats,
  onSaveResearch,
  isSavingResearch,
  saveVisibility,
  setSaveVisibility,
  onPublishToParagraph,
  isPublishingToParagraph,
  onDownloadReport,
  onCopyShareLink,
  onAskTrende,
  agentReplies,
  agentPrompt,
  setAgentPrompt,
  askSuggestions,
}: ResultsViewProps) {
  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      {/* Mission Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 glass rounded-2xl border-white/10 relative overflow-visible group">
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
              onClick={onSaveResearch}
              disabled={isSavingResearch}
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
                onClick={onPublishToParagraph}
                ariaLabel="Paragraph Draft"
                disabled={isPublishingToParagraph}
              />
            </Tooltip>
            <Tooltip content="Download PDF">
              <IconButton
                icon={<Copy className="w-4 h-4" />}
                onClick={onDownloadReport}
                ariaLabel="Download"
              />
            </Tooltip>
            <Tooltip content="Share Link">
              <IconButton
                icon={<Share2 className="w-4 h-4" />}
                onClick={onCopyShareLink}
                ariaLabel="Share"
              />
            </Tooltip>
          </div>
        </div>
      </div>

      <Card accent="cyan" className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-cyan)]">
            Trust Stack
          </p>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            What was verified
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">TEE</p>
            <p className="text-sm font-black mt-1">{trustStack?.tee?.status || "pending"}</p>
            <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-1">
              Provider: {trustStack?.tee?.provider || "eigen"}
            </p>
          </div>
          <div className="border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Consensus</p>
            <p className="text-sm font-black mt-1">{trustStack?.consensus?.status || "degraded"}</p>
            <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-1">
              {(trustStack?.consensus?.providers?.length || 0)} routes • {Math.round((trustStack?.consensus?.agreementScore || 0) * 100)}% agreement
            </p>
          </div>
          <div className="border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Chainlink</p>
            <p className="text-sm font-black mt-1">{chainlinkStatusLabel}</p>
            <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-1">
              {trustStack?.chainlink?.network || "oracle lane ready"}
            </p>
          </div>
        </div>
      </Card>

      <Card accent="violet" className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-violet)]">
            Source Provenance
          </p>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            Primary + fallback execution
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Route Execution</p>
            <div className="space-y-1.5 max-h-48 overflow-auto pr-1">
              {sourceRoutes.length === 0 ? (
                <p className="text-[11px] font-mono text-[var(--text-muted)]">No route telemetry captured for this run.</p>
              ) : (
                sourceRoutes.map((route, idx) => (
                  <div key={`${route.requested_platform}-${route.resolved_source}-${idx}`} className="text-[11px] font-mono flex items-center justify-between gap-2">
                    <span className="text-[var(--text-secondary)] uppercase">{route.requested_platform} → {route.resolved_source || "n/a"}</span>
                    <span className={cn(
                      "uppercase",
                      route.status === "ok" ? "text-emerald-400" : route.status === "empty" ? "text-amber-300" : "text-rose-300"
                    )}>
                      {route.fallback_used ? "fallback" : "primary"} · {route.item_count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Source Contribution</p>
            <div className="space-y-1.5 max-h-48 overflow-auto pr-1">
              {sourceBreakdown.length === 0 ? (
                <p className="text-[11px] font-mono text-[var(--text-muted)]">No source contribution stats available.</p>
              ) : (
                sourceBreakdown.map((row, idx) => (
                  <div key={`${row.platform}-${row.source}-${idx}`} className="text-[11px] font-mono flex items-center justify-between gap-2">
                    <span className="text-[var(--text-secondary)] uppercase">{row.platform} · {row.source}</span>
                    <span className="text-cyan-300">{row.items} items</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card accent="emerald" className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-emerald)]">
            Ask Trende
          </p>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            Interactive run copilot
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {askSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onAskTrende(s)}
                  className="px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={agentPrompt}
                onChange={(e) => setAgentPrompt(e.target.value)}
                placeholder="Ask about disagreement, sources, confidence, or next steps..."
                className="flex-1 px-3 py-2 text-xs font-mono border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
              />
              <Button variant="primary" size="sm" onClick={() => onAskTrende()}>
                Ask
              </Button>
            </div>
          </div>
          <div className="border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 max-h-44 overflow-auto space-y-2">
            {agentReplies.length === 0 ? (
              <p className="text-[11px] font-mono text-[var(--text-muted)]">
                Ask Trende to parse this run and extract specific signals.
              </p>
            ) : (
              agentReplies.map((row) => (
                <div key={row.ts} className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">{row.q}</p>
                  <p className="text-[11px] font-mono text-[var(--text-secondary)]">{row.a}</p>
                  {row.citations?.length > 0 && (
                    <p className="text-[10px] font-mono text-[var(--text-muted)]">
                      {row.citations.join(" ")}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {(chainlinkProof || trustStack?.chainlink?.configured) && (
        <Card accent="amber" className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-amber)]">
                Chainlink Proof
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Decentralized oracle trace for this run. Verifies request routing and on-chain execution intent.
              </p>
              <div className="flex flex-wrap gap-2 mt-3 text-[10px] font-mono">
                <span className="px-2 py-1 border border-[var(--border-color)] bg-[var(--bg-primary)] uppercase">
                  Status: {chainlinkProof?.status || trustStack?.chainlink?.status || "available"}
                </span>
                {(chainlinkProof?.network || trustStack?.chainlink?.network) && (
                  <span className="px-2 py-1 border border-[var(--border-color)] bg-[var(--bg-primary)] uppercase">
                    Network: {chainlinkProof?.network || trustStack?.chainlink?.network}
                  </span>
                )}
                {chainlinkProof?.requestId && (
                  <span className="px-2 py-1 border border-[var(--border-color)] bg-[var(--bg-primary)]">
                    Request: {String(chainlinkProof.requestId).slice(0, 14)}...
                  </span>
                )}
                {chainlinkProof?.txHash && (
                  <span className="px-2 py-1 border border-[var(--border-color)] bg-[var(--bg-primary)]">
                    Tx: {String(chainlinkProof.txHash).slice(0, 10)}...{String(chainlinkProof.txHash).slice(-6)}
                  </span>
                )}
                <span className="px-2 py-1 border border-[var(--border-color)] bg-[var(--bg-primary)] uppercase">
                  Settlement: {chainlinkProof?.oracleSettlement || "not requested"}
                </span>
              </div>
              <div className="mt-3 space-y-1.5 text-[11px] font-mono text-[var(--text-secondary)]">
                <p>1. Request submitted to DON: {chainlinkProof?.txHash ? "yes" : "pending"}</p>
                <p>2. Oracle market staged: {chainlinkProof?.oracleSettlement === "staged" || chainlinkProof?.oracleSettlement === "requested" ? "yes" : "pending"}</p>
                <p>3. Resolution requested: {chainlinkProof?.oracleSettlement === "requested" ? "yes" : "pending"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {(chainlinkProof?.explorerUrl || (chainlinkProof?.txHash ? `https://sepolia.basescan.org/tx/${chainlinkProof.txHash}` : null)) && (
                <a href={chainlinkProof?.explorerUrl || `https://sepolia.basescan.org/tx/${chainlinkProof?.txHash}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm">
                    Open Explorer
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
        <ResultsFlowDivider
          title="Conviction Layer"
          body={resultsFlowCopy.brief}
          icon="brief"
        />

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
              <TrendSummary
                summary={data.summary}
                sourceLabelByOrdinal={sourceIndexById}
                dataHealth={{ level: "healthy", message: "", warnings: [], findingsCount: sourceCount }}
              />
            </div>
          </details>
        </div>

        <ResultsFlowDivider
          title="Forge Layer"
          body={resultsFlowCopy.forge}
          icon="forge"
        />

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
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${driver.value}%`,
                        backgroundColor: driver.accent === 'cyan' ? 'rgb(34, 211, 238)' :
                                        driver.accent === 'amber' ? 'rgb(251, 191, 36)' :
                                        driver.accent === 'emerald' ? 'rgb(52, 211, 153)' :
                                        driver.accent === 'rose' ? 'rgb(244, 63, 94)' : 'rgb(34, 211, 238)'
                      }}
                    />
                  </div>
                  <p className="text-[9px] uppercase font-mono text-white/20 mt-3 text-right">
                    Weight {Math.round(driver.weight * 100)}%
                  </p>
                </div>
              ))}
              
              <div className="p-4 glass rounded-xl border-cyan-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <Bot className="w-5 h-5 text-[var(--accent-cyan)]" />
                  <div>
                    <span className="text-sm font-black uppercase tracking-widest text-white block">
                      Agent Insights
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400/50 block">
                      AI agent decision transparency
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono p-2 rounded bg-white/5 border border-white/5">
                    <span className="text-white/60">Decision Log</span>
                    <button className="text-cyan-400 font-black hover:text-cyan-300 transition-colors">
                      VIEW LOG
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono p-2 rounded bg-white/5 border border-white/5">
                    <span className="text-white/60">Proactive Suggestions</span>
                    <span className="text-emerald-400 font-black">AVAILABLE</span>
                  </div>
                </div>
              </div>
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

                <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
                  <div className="text-center">
                    <p className="text-[9px] uppercase font-black text-white/20 tracking-widest mb-1">Agreement</p>
                    <p className="text-sm font-black text-amber-400">{Math.round((data.summary.consensusData?.agreement_score || 0) * 100)}%</p>
                  </div>
                  <div className="w-px h-8 bg-white/5 hidden sm:block" />
                  <div className="text-center">
                    <p className="text-[9px] uppercase font-black text-white/20 tracking-widest mb-1">Attestation</p>
                    <p className="text-sm font-black text-emerald-400">
                      {forgeAttestationStatus === "signed" || forgeAttestationStatus === "ready" ? "READY" : "PENDING"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 glass border-cyan-500/20 rounded-lg">
                    <Bot className="w-4 h-4 text-[var(--accent-cyan)]" />
                    <span className="text-xs font-mono text-cyan-400">Agent</span>
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  </div>
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

        <ResultsFlowDivider
          title="Evidence Layer"
          body={resultsFlowCopy.feed}
          icon="feed"
        />

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
              <PlatformTabs results={data.results || []} sourceIndexById={sourceIndexById} />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
