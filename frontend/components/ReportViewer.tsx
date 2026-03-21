'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Info, Link2, Quote, ShieldCheck, Sparkles, TrendingUp, Check, Copy, Zap, PenLine, Rocket, Download, Mic } from 'lucide-react';
import { AgentAction, TrendSummary as TrendSummaryType } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { AttestationBadge } from '@/components/AttestationBadge';
import { cn } from '@/lib/utils';
import { useTheme } from './ThemeProvider';
import { api } from '@/lib/api';

interface ReportViewerProps {
    summary: TrendSummaryType;
    mode: 'meme' | 'news';
    queryId: string;
}

interface Citation {
    source?: string;
    url?: string;
    quote?: string;
}

interface ResearchData {
    title?: string;
    intelligence_summary?: string;
    thesis?: string[];
    consensus_metrics?: {
        model_agreement?: number;
        main_divergence?: string;
    };
    citations?: Citation[];
    brand?: {
        aesthetic?: string;
        primary_color?: string;
    };
}

interface AgentManifest {
    signal: string;
    confidence: number;
    execution_path: string[];
    attestation_id: string;
    propose_to_buy?: {
        action: string;
        amount_usdc: number;
    };
}

export function ReportViewer({ summary, mode, queryId }: ReportViewerProps) {
    const fallbackData: ResearchData = {
        title: "Consensus Brief",
        intelligence_summary: summary.overview || "No intelligence summary available.",
        thesis: summary.keyThemes?.length
            ? summary.keyThemes.slice(0, 4).map((theme) => `Theme: ${theme}`)
            : [summary.overview || "No thesis data available."],
        consensus_metrics: {
            model_agreement: summary.consensusData?.agreement_score || summary.confidenceScore || 0,
            main_divergence: summary.consensusData?.main_divergence || "No major divergence reported.",
        },
        citations: [],
    };
    const data = ((((summary as unknown as { researchPayload?: unknown })?.researchPayload as ResearchData) || fallbackData) as ResearchData);
    const consensus = summary.consensusData;
    const attestation = summary.attestationData;
    const { showToast } = useToast();
    const { isSoft } = useTheme();

    const [verifyStatus, setVerifyStatus] = useState<string>('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verified, setVerified] = useState<boolean | null>(null);
    const [showVerificationDetails, setShowVerificationDetails] = useState(false);
    const [showAgentManifest, setShowAgentManifest] = useState(false);
    const [manifestData, setManifestData] = useState<AgentManifest | null>(null);
    const [copiedManifest, setCopiedManifest] = useState(false);
    const [copiedSignature, setCopiedSignature] = useState(false);
    const [isDrafting, setIsDrafting] = useState(false);
    const [isPodcasting, setIsPodcasting] = useState(false);
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [actions, setActions] = useState<AgentAction[]>([]);
    const [selectedActionPayload, setSelectedActionPayload] = useState<AgentAction | null>(null);
    const [copiedCurl, setCopiedCurl] = useState(false);

    // Derived oracle state from actions — DRY, no new state needed
    const oracleAction = useMemo(() =>
        actions.find(a => a.action_type === 'stage_oracle_market' || a.action_type === 'resolve_oracle_market'),
        [actions]
    );
    const oracleResolutionAction = useMemo(() =>
        actions.find(a => a.action_type === 'resolve_oracle_market' && a.status === 'succeeded'),
        [actions]
    );
    const isMeme = mode === 'meme';
    const providers = useMemo(() => consensus?.providers || [], [consensus?.providers]);
    const consensusWarnings = consensus?.warnings || [];
    const providerOutputs = consensus?.provider_outputs || [];
    const isLowDiversity = (consensus?.diversity_level || 'low') === 'low';
    const agreement = Math.round(
        (consensus?.agreement_score || data.consensus_metrics?.model_agreement || 0) * 100
    );
    const activeActions = useMemo(
        () => actions.filter((a) => !['succeeded', 'failed', 'compensated'].includes(a.status)),
        [actions]
    );
    const proofLink = useMemo(() => {
        if (typeof window === 'undefined') return '';
        return `${window.location.origin}/proof/${queryId}`;
    }, [queryId]);
    const attestedPayload = useMemo(
        () =>
            (attestation?.payload as Record<string, unknown> | undefined) || {
                prompt: summary.overview,
                providers,
                consensus_report: summary.overview,
                generated_at: attestation?.generated_at || summary.generatedAt,
                provider_count: providers.length,
            },
        [attestation?.generated_at, attestation?.payload, providers, summary.generatedAt, summary.overview]
    );
    const proofJson = useMemo(
        () => ({
            verification_result: verified === null ? 'not-run' : verified ? 'verified' : 'failed',
            attestation_id: attestation?.attestation_id || null,
            signer: attestation?.signer || null,
            method: attestation?.method || null,
            payload_hash: attestation?.input_hash || null,
            generated_at: attestation?.generated_at || summary.generatedAt || null,
            verify_endpoint: attestation?.verify_endpoint || null,
            payload: attestedPayload,
        }),
        [
            attestation?.attestation_id,
            attestation?.generated_at,
            attestation?.input_hash,
            attestation?.method,
            attestation?.signer,
            attestation?.verify_endpoint,
            attestedPayload,
            summary.generatedAt,
            verified,
        ]
    );
    const podcastActionEnabled = process.env.NEXT_PUBLIC_ENABLE_PODCAST_ACTION === 'true';

    useEffect(() => {
        if (activeActions.length === 0) return;

        const timer = setInterval(async () => {
            await Promise.all(
                activeActions.map(async (existing) => {
                    try {
                        const latest = await api.getAction(existing.action_id);
                        setActions((prev) => {
                            const idx = prev.findIndex((a) => a.action_id === existing.action_id);
                            if (idx === -1) return prev;
                            const copy = [...prev];
                            copy[idx] = latest.action;
                            return copy;
                        });
                    } catch {
                        // Keep existing action state on polling failure.
                    }
                })
            );
        }, 2000);

        return () => clearInterval(timer);
    }, [activeActions]);

    const addOrUpdateAction = (nextAction: AgentAction) => {
        setActions((prev) => {
            const idx = prev.findIndex((a) => a.action_id === nextAction.action_id);
            if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = nextAction;
                return copy;
            }
            return [nextAction, ...prev];
        });
    };

    const fetchAgentAlpha = async () => {
        try {
            setShowAgentManifest(true);
            setVerifyStatus('Fetching manifest...');
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${baseUrl}/api/agent/alpha/${queryId}`);
            if (response.ok) {
                const payload = await response.json();
                setManifestData(payload.manifest);
                setVerifyStatus('');
            } else {
                setVerifyStatus('Failed to fetch agent manifest.');
            }
        } catch {
            setVerifyStatus('Error connecting to Alpha API.');
        }
    };

    const handleDraftArticle = async () => {
        setIsDrafting(true);
        showToast('Submitting draft action...', 'info');
        try {
            const response = await api.submitAction({
                action_type: 'draft_paragraph',
                task_id: queryId,
                input: {
                    title: `Trende Brief: ${summary.overview?.slice(0, 60) || 'Research'}`,
                },
            });
            addOrUpdateAction(response.action);
            showToast(`Action queued: ${response.action.action_type}`, 'success');
        } catch {
            showToast('Failed to queue draft action.', 'error');
        } finally {
            setIsDrafting(false);
        }
    };

    const handleDraftPodcast = async () => {
        setIsPodcasting(true);
        showToast('Submitting podcast draft action...', 'info');
        try {
            const response = await api.submitAction({
                action_type: 'draft_podcast',
                task_id: queryId,
                input: {
                    title: `Trende Podcast Draft: ${summary.overview?.slice(0, 54) || 'Research'}`,
                    tone: 'analyst',
                    duration_minutes: 8,
                },
            });
            addOrUpdateAction(response.action);
            showToast(`Action queued: ${response.action.action_type}`, 'success');
        } catch {
            showToast('Failed to queue podcast action.', 'error');
        } finally {
            setIsPodcasting(false);
        }
    };

    const verifyAttestation = async () => {
        if (!attestation) {
            setVerifyStatus('Missing proof payload.');
            setVerified(false);
            return;
        }

        try {
            setIsVerifying(true);
            setVerifyStatus('Verifying runtime signature...');
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${baseUrl}/api/attest/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload: attestedPayload, attestation }),
            });

            if (!response.ok) {
                setVerifyStatus(`Verification failed (HTTP ${response.status}).`);
                setVerified(false);
                return;
            }

            const result = (await response.json()) as { verified?: boolean };
            setVerified(result.verified || false);
            setVerifyStatus(result.verified ? 'Signature verified successfully!' : 'Signature verification failed.');
        } catch {
            setVerifyStatus('Verification request failed.');
            setVerified(false);
        } finally {
            setIsVerifying(false);
        }
    };

    const openVerificationPanel = async () => {
        setShowVerificationDetails(true);
        if (verified === null && !isVerifying) {
            await verifyAttestation();
        }
    };

    return (
        <>
            {/* Oracle Status Banner — derived from actions state, always visible when market is staged */}
            {oracleAction && (() => {
                const txHash = oracleAction.result_payload?.tx_hash ? String(oracleAction.result_payload.tx_hash) : null;
                return (
                    <div className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-2xl border text-xs font-mono transition-all",
                        oracleResolutionAction
                            ? (isSoft ? 'soft-ui-out text-[var(--accent-emerald)]' : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300')
                            : oracleAction.status === 'running' || oracleAction.action_type === 'resolve_oracle_market'
                                ? (isSoft ? 'soft-ui-out text-[var(--accent-cyan)] animate-pulse' : 'bg-blue-950/40 border-blue-500/40 text-blue-300 animate-pulse')
                                : (isSoft ? 'soft-ui-out text-[var(--accent-amber)]' : 'bg-slate-900/60 border-amber-500/30 text-amber-300')
                    )}>
                        <div className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            oracleResolutionAction ? 'bg-[var(--accent-emerald)]' :
                                oracleAction.status === 'running' ? 'bg-[var(--accent-cyan)] animate-pulse' : 'bg-[var(--accent-amber)]'
                        )} />
                        <span className="flex-1">
                            {oracleResolutionAction
                                ? `✅ Oracle settlement recorded on-chain on Arbitrum Sepolia`
                                : oracleAction.action_type === 'resolve_oracle_market'
                                    ? `🔵 Chainlink resolution requested... awaiting oracle callback`
                                    : `🟡 Market staged on Arbitrum Sepolia — receiver path live, awaiting resolution trigger`
                            }
                        </span>
                        {txHash && (
                            <a
                                href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 underline underline-offset-2 opacity-70 hover:opacity-100 shrink-0"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Arbiscan
                            </a>
                        )}
                    </div>
                );
            })()}

            <div className="space-y-6 animate-fade-up">
                <div
                    className={cn(
                        "p-6 border transition-all duration-500",
                        isSoft ? 'soft-ui-out border-0' : `rounded-3xl shadow-xl bg-slate-900/80 ${isMeme ? 'border-cyan-500/30' : 'border-emerald-500/30'}`
                    )}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div
                                className={cn(
                                    "w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center transition-all",
                                    isSoft ? 'soft-ui-out rounded-2xl' : `rounded-2xl shadow-lg ${isMeme ? 'bg-cyan-500 shadow-cyan-900/40' : 'bg-emerald-500 shadow-emerald-900/40'}`
                                )}
                                style={{ backgroundColor: isSoft ? 'transparent' : undefined }}
                            >
                                {isMeme ? (
                                    <Sparkles className={cn("w-7 h-7", isSoft ? 'text-[var(--accent-cyan)]' : 'text-white')} />
                                ) : (
                                    <ShieldCheck className={cn("w-7 h-7", isSoft ? 'text-[var(--accent-emerald)]' : 'text-white')} />
                                )}
                            </div>
                            <div className="flex-1">
                                <h1 className={cn("text-xl sm:text-2xl font-bold flex items-center gap-2", isSoft ? "text-[var(--text-primary)]" : "text-slate-100")}>
                                    {data.title || 'Research Report'}
                                </h1>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className={`text-sm ${isSoft ? 'text-[var(--text-secondary)]' : 'text-slate-400'}`}>
                                        Generated via{' '}
                                        {summary.confidenceScore ? (summary.confidenceScore * 100).toFixed(0) : 0}% evidence
                                        confidence
                                    </p>
                                    <div className={`w-1.5 h-1.5 rounded-full ${isSoft ? 'bg-[var(--text-muted)]' : 'bg-slate-700'}`} />
                                    <button
                                        onClick={() => {
                                            const url = `${window.location.origin}/proof/${queryId}`;
                                            navigator.clipboard.writeText(url);
                                            showToast('Proof URL copied to clipboard', 'success');
                                        }}
                                        className={cn(
                                            "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-colors",
                                            isSoft ? "text-[var(--accent-emerald)]" : "text-emerald-400"
                                        )}
                                    >
                                        <Link2 className="w-3 h-3" />
                                        Share Proof
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex -space-x-2 flex-wrap">
                                {(providers.length > 0 ? providers : ['consensus']).slice(0, 5).map((model) => (
                                    <div
                                        key={model}
                                        className={cn(
                                            "w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-bold",
                                            isSoft ? "soft-ui-out border-[var(--bg-primary)] text-[var(--text-secondary)]" : "border-slate-900 bg-slate-800 text-slate-300"
                                        )}
                                        title={model}
                                    >
                                        {model[0]?.toUpperCase() || 'C'}
                                    </div>
                                ))}
                            </div>
                            <span className={cn("text-[10px] uppercase tracking-wider ml-2", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>
                                Multi-model consensus
                            </span>
                        </div>
                    </div>

                    <div className={cn("mt-6 pt-6 border-t", isSoft ? "border-[var(--text-muted)]/10" : "border-slate-800")}>
                        <p className={cn("text-lg leading-relaxed font-medium italic", isSoft ? "text-[var(--text-primary)]" : "text-slate-200")}>
                            &quot;
                            {data.intelligence_summary ||
                                summary.overview ||
                                'No overview available.'}
                            &quot;
                        </p>
                        {isLowDiversity && (
                            <p className={cn(
                                "mt-3 text-xs rounded-lg px-3 py-2 border",
                                isSoft ? "soft-ui-out text-[var(--accent-amber)] border-[var(--accent-amber)]/30" : "text-amber-300 bg-amber-500/10 border-amber-500/30"
                            )}>
                                Low-diversity consensus detected. Treat this as directional and review provenance before execution.
                            </p>
                        )}
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    <section className={cn(
                        "sm:col-span-2 p-3 sm:p-5 rounded-2xl",
                        isSoft ? 'soft-ui-out border-0' : 'border border-slate-700/50 bg-slate-900/70'
                    )}>
                        <div className={cn("flex items-center gap-2 mb-3", isSoft ? "text-[var(--text-muted)]" : "text-slate-400")}>
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Key Pillars</span>
                        </div>
                        <div className="grid gap-2 sm:gap-3 grid-cols-1">
                            {(data.thesis || []).map((point, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "p-2.5 sm:p-3 md:p-4 transition-all rounded-lg sm:rounded-xl",
                                        isSoft ? 'soft-ui-in' : 'bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800/70'
                                    )}
                                >
                                    <div className="flex gap-2 sm:gap-3">
                                        <span className={cn("font-mono font-bold text-sm", isSoft ? 'text-[var(--accent-cyan)]' : 'text-cyan-400')}>{i + 1}.</span>
                                        <p className={cn("text-xs sm:text-sm leading-relaxed", isSoft ? 'text-[var(--text-secondary)]' : 'text-slate-300')}>{point}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {isMeme ? (
                        <>
                            <section className={cn(
                                "p-3 sm:p-4 rounded-2xl",
                                isSoft ? 'soft-ui-out border-0' : 'border border-slate-700/50 bg-slate-900/70'
                            )}>
                                <div className={cn("flex items-center gap-2 mb-3", isSoft ? "text-[var(--text-muted)]" : "text-slate-400")}>
                                    <Sparkles className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Brand Aesthetic</span>
                                </div>
                                <div className={cn(
                                    "p-3 sm:p-4 rounded-xl border flex items-center justify-between",
                                    isSoft ? "soft-ui-in border-0" : "bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700"
                                )}>
                                    <div>
                                        <p className={cn("text-sm font-bold", isSoft ? "text-[var(--text-primary)]" : "text-slate-200")}>
                                            {data.brand?.aesthetic || 'Vibrant Agentic'}
                                        </p>
                                        <p className={cn("text-xs mt-1", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>
                                            Primary accents: {data.brand?.primary_color || '#00D1FF'}
                                        </p>
                                    </div>
                                    <div
                                        className={cn("w-10 h-10 rounded-full", isSoft ? "soft-ui-out" : "shadow-inner border-4 border-slate-700")}
                                        style={{ backgroundColor: data.brand?.primary_color || '#00D1FF' }}
                                    />
                                </div>
                            </section>

                            <section className={cn(
                                "p-3 sm:p-4 rounded-2xl",
                                isSoft ? 'soft-ui-out border-0' : 'border border-slate-700/50 bg-slate-900/70'
                            )}>
                                <div className={cn("flex items-center gap-2 mb-3", isSoft ? "text-[var(--text-muted)]" : "text-slate-400")}>
                                    <Info className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Consensus Metrics</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className={cn("p-3 sm:p-4 rounded-xl", isSoft ? "soft-ui-in" : "bg-slate-800/40 border border-slate-700/50")}>
                                        <p className={cn("text-[10px] uppercase font-bold tracking-tighter mb-1", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>
                                            Model agreement
                                        </p>
                                        <p className="text-xl font-bold text-[var(--accent-emerald)]">{agreement}%</p>
                                    </div>
                                    <div className={cn("p-3 sm:p-4 rounded-xl", isSoft ? "soft-ui-in" : "bg-slate-800/40 border border-slate-700/50")}>
                                        <p className={cn("text-[10px] uppercase font-bold tracking-tighter mb-1", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>
                                            Divergence level
                                        </p>
                                        <p className={cn("text-sm font-bold line-clamp-2", isSoft ? "text-[var(--accent-cyan)]" : "text-cyan-400")}>
                                            {consensus?.main_divergence || 'Low'}
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </>
                    ) : (
                        <>
                            <section className={cn(
                                "sm:col-span-2 xl:col-span-2 p-4 sm:p-5 rounded-2xl shadow-lg",
                                isSoft ? 'soft-ui-out' : 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-2 border-emerald-500/30'
                            )}>
                                <div className="flex items-start justify-between mb-4">
                                    <AttestationBadge attestation={attestation} size="lg" showDetails />
                                    <button
                                        onClick={() => {
                                            if (attestation?.signature) {
                                                navigator.clipboard.writeText(attestation.signature);
                                                setCopiedSignature(true);
                                                showToast('Signature copied to clipboard', 'success');
                                                setTimeout(() => setCopiedSignature(false), 2000);
                                            }
                                        }}
                                        className={cn("p-2 rounded-lg transition-colors", isSoft ? "soft-ui-button" : "hover:bg-emerald-500/10")}
                                        title="Copy signature"
                                    >
                                        {copiedSignature ? (
                                            <Check className="w-4 h-4 text-[var(--accent-emerald)]" />
                                        ) : (
                                            <Copy className={cn("w-4 h-4", isSoft ? "text-[var(--text-muted)]" : "text-slate-400")} />
                                        )}
                                    </button>
                                </div>

                                <p className={cn("text-sm leading-relaxed italic mb-4", isSoft ? "text-[var(--text-secondary)]" : "text-slate-300")}>
                                    &quot;{summary.overview || 'No consensus overview provided.'}&quot;
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                    <div className={cn("p-3 rounded-lg border", isSoft ? "soft-ui-in border-0" : "bg-slate-900/50 border-slate-700/50")}>
                                        <p className={cn("text-[10px] uppercase font-bold tracking-wider mb-1", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>
                                            Attestation ID
                                        </p>
                                        <p className="text-xs text-[var(--accent-emerald)] font-mono break-all">
                                            {attestation?.attestation_id || 'n/a'}
                                        </p>
                                    </div>
                                    <div className={cn("p-3 rounded-lg border", isSoft ? "soft-ui-in border-0" : "bg-slate-900/50 border-slate-700/50")}>
                                        <p className={cn("text-[10px] uppercase font-bold tracking-wider mb-1", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>
                                            Method
                                        </p>
                                        <p className={cn("text-xs font-mono", isSoft ? "text-[var(--text-secondary)]" : "text-slate-300")}>
                                            {attestation?.method || 'n/a'}
                                        </p>
                                    </div>
                                </div>

                                <div className={cn("p-3 rounded-lg border mb-4", isSoft ? "soft-ui-in border-0" : "bg-slate-900/50 border-emerald-500/20")}>
                                    <p className={cn("text-[10px] uppercase font-bold tracking-wider mb-1", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>
                                        Signer Address
                                    </p>
                                    {attestation?.signer ? (
                                        <a
                                            href={`https://etherscan.io/address/${attestation.signer}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-[var(--accent-emerald)] hover:opacity-80 font-mono flex items-center gap-2 transition-colors break-all"
                                        >
                                            {attestation.signer}
                                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                        </a>
                                    ) : (
                                        <p className={cn("text-xs font-mono", isSoft ? "text-[var(--text-muted)]" : "text-slate-400")}>n/a</p>
                                    )}
                                </div>

                                <div className={cn("p-3 rounded-lg border", isSoft ? "soft-ui-in border-0" : "bg-slate-950/70 border-slate-700/50")}>
                                    <p className={cn("text-[10px] uppercase font-bold tracking-wider mb-1", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>
                                        Cryptographic Signature
                                    </p>
                                    <p className={cn("text-xs font-mono break-all", isSoft ? "text-[var(--text-muted)]" : "text-slate-400")}>
                                        {attestation?.signature ? `${attestation.signature.slice(0, 66)}...` : 'n/a'}
                                    </p>
                                </div>

                                {consensus?.pillars && consensus.pillars.length > 0 && (
                                    <div className={cn("mt-4 pt-4 border-t", isSoft ? "border-[var(--text-muted)]/10" : "border-slate-700/50")}>
                                        <p className="text-[10px] text-[var(--accent-emerald)] font-bold uppercase tracking-widest mb-2">Consensus Pillars</p>
                                        <ul className="space-y-1">
                                            {consensus.pillars.slice(0, 3).map((pillar: string, idx: number) => (
                                                <li key={idx} className={cn("text-xs flex items-start gap-2", isSoft ? "text-[var(--text-secondary)]" : "text-slate-400")}>
                                                    <span className="text-[var(--accent-emerald)]">•</span> {pillar}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {consensus?.anomalies && consensus.anomalies.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-[10px] text-[var(--accent-amber)] font-bold uppercase tracking-widest mb-2">Fringe Anomalies</p>
                                        <ul className="space-y-1">
                                            {consensus.anomalies.slice(0, 2).map((anomaly: string, idx: number) => (
                                                <li key={idx} className={cn("text-xs flex items-start gap-2", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>
                                                    <span className="text-[var(--accent-amber)]">?</span> {anomaly}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {consensusWarnings.length > 0 && (
                                    <div className={cn(
                                        "mt-4 rounded-lg border p-3",
                                        isSoft ? "soft-ui-out border-[var(--accent-amber)]/30" : "bg-amber-500/10 border-amber-500/30"
                                    )}>
                                        <p className="text-[10px] text-[var(--accent-amber)] font-bold uppercase tracking-widest mb-1">
                                            Runtime Warnings
                                        </p>
                                        <ul className="space-y-1">
                                            {consensusWarnings.map((warning, idx) => (
                                                <li key={idx} className={cn("text-xs", isSoft ? "text-[var(--accent-amber)]/90" : "text-amber-100/90")}>
                                                    - {warning}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className={cn("mt-4 pt-4 border-t", isSoft ? "border-[var(--text-muted)]/10" : "border-slate-700/50")}>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={openVerificationPanel}
                                            className={cn(
                                                "px-4 py-2 rounded-lg border text-sm font-semibold transition-all flex items-center gap-2",
                                                isSoft ? "soft-ui-button border-0 text-[var(--accent-emerald)]" : "border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/15"
                                            )}
                                        >
                                            <ShieldCheck className="w-4 h-4" />
                                            Verify Proof
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!proofLink) return;
                                                navigator.clipboard.writeText(proofLink);
                                                showToast('Proof URL copied to clipboard', 'success');
                                            }}
                                            className={cn(
                                                "px-3 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5",
                                                isSoft ? "soft-ui-button border-0 text-[var(--text-secondary)]" : "border-slate-700 text-slate-300 hover:bg-slate-800/70"
                                            )}
                                        >
                                            <Link2 className="w-3.5 h-3.5" />
                                            Share Proof
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const blob = new Blob([JSON.stringify(proofJson, null, 2)], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.download = `trende-proof-${queryId.slice(0, 8)}.json`;
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                                URL.revokeObjectURL(url);
                                            }}
                                            className={cn(
                                                "px-3 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5",
                                                isSoft ? "soft-ui-button border-0 text-[var(--text-secondary)]" : "border-slate-700 text-slate-300 hover:bg-slate-800/70"
                                            )}
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            Download Proof JSON
                                        </button>
                                    </div>
                                    {verifyStatus && (
                                        <p className={cn("text-xs mt-2", isSoft ? "text-[var(--text-muted)]" : "text-slate-400")}>{verifyStatus}</p>
                                    )}
                                </div>
                            </section>

                            {providerOutputs.length > 0 && (
                                <section className={cn(
                                    "p-4 rounded-2xl border",
                                    isSoft ? 'soft-ui-out border-0' : 'border-slate-700 bg-slate-900/70'
                                )}>
                                    <p className="text-[10px] text-[var(--accent-cyan)] font-bold uppercase tracking-widest mb-2">
                                        Provider Provenance
                                    </p>
                                    <div className="space-y-2">
                                        {providerOutputs.map((output, idx) => (
                                            <div key={`${output.provider}-${idx}`} className={cn(
                                                "rounded-lg border p-2.5",
                                                isSoft ? "soft-ui-in border-0" : "border-slate-700 bg-slate-800/70"
                                            )}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={cn("text-xs", isSoft ? "text-[var(--text-primary)]" : "text-slate-200")}>
                                                        {output.provider}
                                                        {output.model_id ? ` (${output.model_id})` : ''}
                                                    </p>
                                                    <span className={cn(
                                                        "text-[10px] px-1.5 py-0.5 rounded",
                                                        output.status === 'ok' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                                    )}>
                                                        {output.status || 'ok'}
                                                    </span>
                                                </div>
                                                <p className={cn("text-[11px] mt-1", isSoft ? "text-[var(--text-muted)]" : "text-slate-400")}>
                                                    latency: {Math.round(output.latency_ms || 0)}ms
                                                </p>
                                                {output.error && (
                                                    <p className="text-[11px] text-rose-300 mt-1 line-clamp-2">{output.error}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </>
                    )}

                    <section className={cn(
                        "sm:col-span-2 xl:col-span-2 p-3 sm:p-4 rounded-2xl",
                        isSoft ? 'soft-ui-out border-0' : 'border border-slate-700/50 bg-slate-900/70'
                    )}>
                        <div className={cn("flex items-center gap-2 mb-3", isSoft ? "text-[var(--text-muted)]" : "text-slate-400")}>
                            <ExternalLink className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Alpha Citations</span>
                        </div>
                        <div className="grid gap-2 sm:gap-3 grid-cols-1">
                            {(data.citations || []).map((cite, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl border transition-all group",
                                        isSoft ? "soft-ui-in border-0" : "bg-slate-900 border-slate-800 hover:border-slate-700"
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className={cn("text-[10px] font-bold uppercase tracking-tighter mb-1", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>
                                                {cite.source || 'Source'}
                                            </p>
                                            <p className={cn("text-xs line-clamp-2 italic mb-2", isSoft ? "text-[var(--text-secondary)]" : "text-slate-300")}>
                                                &quot;{cite.quote || 'Source data verified by consensus engine.'}&quot;
                                            </p>
                                        </div>
                                        {cite.url && (
                                            <a
                                                href={cite.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={cn("p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0", isSoft ? "soft-ui-button" : "bg-slate-800 text-slate-400")}
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className={cn("pt-6 border-t", isSoft ? "border-[var(--text-muted)]/10" : "border-slate-800")}>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                        <div className={cn("flex items-center gap-2 text-xs", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>
                            <Quote className="w-4 h-4" />
                            <span>Verifiable outputs can be trusted and settled by other agents, not just viewed by one user.</span>
                        </div>
                        <div className="flex gap-3">
                            <button className={cn(
                                "px-6 py-2.5 rounded-xl text-sm font-bold transition-colors border",
                                isSoft ? "soft-ui-button border-0 text-[var(--text-primary)]" : "bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700"
                            )}>
                                Regenerate Consensus
                            </button>
                            <button
                                onClick={fetchAgentAlpha}
                                className={cn(
                                    "px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg",
                                    isMeme ? (isSoft ? 'bg-[var(--accent-cyan)]' : 'bg-cyan-600 hover:bg-cyan-500') : (isSoft ? 'bg-[var(--accent-emerald)]' : 'bg-emerald-600 hover:bg-emerald-500')
                                )}
                            >
                                {isMeme ? 'Get Verified Alpha Manifest' : 'Generate Alpha Link'}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                        <div className={cn("rounded-xl border p-2.5 sm:p-3", isSoft ? "soft-ui-in border-0" : "border-slate-800 bg-slate-900/70")}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-emerald)] mb-1">Trader Flow</p>
                            <p className={cn("text-xs", isSoft ? "text-[var(--text-secondary)]" : "text-slate-400")}>Trader agent requests thesis, execution agent acts only when proof is verified.</p>
                        </div>
                        <div className={cn("rounded-xl border p-2.5 sm:p-3", isSoft ? "soft-ui-in border-0" : "border-slate-800 bg-slate-900/70")}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-cyan)] mb-1">DAO Risk Flow</p>
                            <p className={cn("text-xs", isSoft ? "text-[var(--text-secondary)]" : "text-slate-400")}>Risk agent submits verified findings for governance review and vote staging.</p>
                        </div>
                        <div className={cn("rounded-xl border p-2.5 sm:p-3", isSoft ? "soft-ui-in border-0" : "border-slate-800 bg-slate-900/70")}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-amber)] mb-1">Creator Flow</p>
                            <p className={cn("text-xs", isSoft ? "text-[var(--text-secondary)]" : "text-slate-400")}>Publishing agent drafts from citations while preserving provenance and proof links.</p>
                        </div>
                    </div>

                    {/* Agentic Action Matrix */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 pt-6 border-t border-white/5">
                        <button
                            onClick={handleDraftArticle}
                            disabled={isDrafting}
                            className={cn(
                                "flex items-center justify-between p-3 sm:p-4 rounded-2xl transition-all group",
                                isSoft ? "soft-ui-button" : "bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-500/5"
                            )}
                        >
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className={cn(
                                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border group-hover:scale-110 transition-transform",
                                    isSoft ? "soft-ui-out border-0" : "bg-cyan-500/10 border-cyan-500/20"
                                )}>
                                    <PenLine className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-cyan)]" />
                                </div>
                                <div className="text-left">
                                    <div className={cn("text-[11px] sm:text-xs font-bold uppercase tracking-wider", isSoft ? "text-[var(--text-primary)]" : "text-slate-100")}>Draft Article</div>
                                    <div className={cn("text-[9px] sm:text-[10px]", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>Construct Paragraph post with citations</div>
                                </div>
                            </div>
                            <Zap className={cn("w-4 h-4 transition-colors", isSoft ? "text-[var(--text-muted)] group-hover:text-[var(--accent-cyan)]" : "text-slate-700 group-hover:text-cyan-500")} />
                        </button>

                        {podcastActionEnabled && (
                            <button
                                onClick={handleDraftPodcast}
                                disabled={isPodcasting}
                                className={cn(
                                    "flex items-center justify-between p-3 sm:p-4 rounded-2xl transition-all group lg:col-span-1",
                                    isSoft ? "soft-ui-button" : "bg-slate-950 border border-slate-800 hover:border-fuchsia-500/50 hover:bg-fuchsia-500/5"
                                )}
                            >
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className={cn(
                                        "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border group-hover:scale-110 transition-transform",
                                        isSoft ? "soft-ui-out border-0" : "bg-fuchsia-500/10 border-fuchsia-500/20"
                                    )}>
                                        <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-fuchsia-400" />
                                    </div>
                                    <div className="text-left">
                                        <div className={cn("text-[11px] sm:text-xs font-bold uppercase tracking-wider", isSoft ? "text-[var(--text-primary)]" : "text-slate-100")}>Draft Podcast</div>
                                        <div className={cn("text-[9px] sm:text-[10px]", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>Generate transcript + citations pack</div>
                                    </div>
                                </div>
                                <Zap className={cn("w-4 h-4 transition-colors", isSoft ? "text-[var(--text-muted)] group-hover:text-fuchsia-400" : "text-slate-700 group-hover:text-fuchsia-400")} />
                            </button>
                        )}

                        <button
                            onClick={async () => {
                                setIsMonitoring(true);
                                try {
                                    const response = await api.submitAction({
                                        action_type: 'activate_sentinel',
                                        task_id: queryId,
                                        input: {
                                            interval: 'daily',
                                            alert_threshold: 0.8
                                        }
                                    });
                                    addOrUpdateAction(response.action);
                                    showToast('Sentinel activated. Monitoring for alpha divergence...', 'success');
                                } catch {
                                    showToast('Failed to activate Sentinel.', 'error');
                                } finally {
                                    setIsMonitoring(false);
                                }
                            }}
                            disabled={isMonitoring}
                            className={cn(
                                "flex items-center justify-between p-3 sm:p-4 rounded-2xl transition-all group lg:col-span-1",
                                isSoft ? "soft-ui-button" : "bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                            )}
                        >
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className={cn(
                                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border group-hover:scale-110 transition-transform",
                                    isSoft ? "soft-ui-out border-0" : "bg-emerald-500/10 border-emerald-500/20"
                                )}>
                                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-emerald)]" />
                                </div>
                                <div className="text-left">
                                    <div className={cn("text-[11px] sm:text-xs font-bold uppercase tracking-wider", isSoft ? "text-[var(--text-primary)]" : "text-slate-100")}>Activate Sentinel</div>
                                    <div className={cn("text-[9px] sm:text-[10px]", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>Enable recursive monitoring & alerts</div>
                                </div>
                            </div>
                            <Sparkles className={cn("w-4 h-4 transition-colors", isSoft ? "text-[var(--text-muted)] group-hover:text-[var(--accent-emerald)]" : "text-slate-700 group-hover:text-emerald-500")} />
                        </button>

                        <button
                            onClick={async () => {
                                showToast('Staging on-chain oracle market...', 'info');
                                try {
                                    const response = await api.submitAction({
                                        action_type: 'stage_oracle_market',
                                        task_id: queryId,
                                        input: {
                                            duration: 86400 * 7 // 1 week duration for prediction
                                        }
                                    });
                                    addOrUpdateAction(response.action);
                                    showToast('Oracle market production sequence initiated.', 'success');
                                } catch {
                                    showToast('Failed to stage oracle market.', 'error');
                                }
                            }}
                            className={cn(
                                "flex items-center justify-between p-3 sm:p-4 rounded-2xl transition-all group lg:col-span-1",
                                isSoft ? "soft-ui-button" : "bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-500/5"
                            )}
                        >
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className={cn(
                                    "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border group-hover:scale-110 transition-transform",
                                    isSoft ? "soft-ui-out border-0" : "bg-cyan-500/10 border-cyan-500/20"
                                )}>
                                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-cyan)]" />
                                </div>
                                <div className="text-left">
                                    <div className={cn("text-[11px] sm:text-xs font-bold uppercase tracking-wider", isSoft ? "text-[var(--text-primary)]" : "text-slate-100")}>Oracle Settlement</div>
                                    <div className={cn("text-[9px] sm:text-[10px]", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>Stage on-chain prediction for Base/Arb</div>
                                </div>
                            </div>
                            <TrendingUp className={cn("w-4 h-4 transition-colors", isSoft ? "text-[var(--text-muted)] group-hover:text-[var(--accent-cyan)]" : "text-slate-700 group-hover:text-cyan-500")} />
                        </button>

                        {/* If already staged, show resolution button */}
                        {actions.find(a => a.action_type === 'stage_oracle_market' && a.status === 'succeeded') && (
                            <button
                                onClick={async () => {
                                    showToast('Requesting on-chain resolution...', 'info');
                                    try {
                                        const response = await api.submitAction({
                                            action_type: 'resolve_oracle_market',
                                            task_id: queryId,
                                        });
                                        addOrUpdateAction(response.action);
                                        showToast('Final settlement request sent to DID/DON.', 'success');
                                    } catch {
                                        showToast('Failed to trigger resolution.', 'error');
                                    }
                                }}
                                className={cn(
                                    "flex items-center justify-between p-3 sm:p-4 rounded-2xl transition-all group lg:col-span-1 animate-pulse",
                                    isSoft ? "soft-ui-button border-[var(--accent-emerald)]/30" : "bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/10"
                                )}
                            >
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className={cn(
                                        "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border group-hover:scale-110 transition-transform",
                                        isSoft ? "soft-ui-out border-0" : "bg-emerald-500/10 border-emerald-500/20"
                                    )}>
                                        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-emerald)]" />
                                    </div>
                                    <div className="text-left">
                                        <div className={cn("text-[11px] sm:text-xs font-bold uppercase tracking-wider", isSoft ? "text-[var(--text-primary)]" : "text-slate-100")}>Finalize Oracle</div>
                                        <div className={cn("text-[9px] sm:text-[10px]", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>Trigger final settlement consensus</div>
                                    </div>
                                </div>
                                <ShieldCheck className="w-4 h-4 text-[var(--accent-emerald)] transition-colors" />
                            </button>
                        )}
                    </div>

                    <div className={cn("pt-6 border-t", isSoft ? "border-[var(--text-muted)]/10" : "border-white/5")}>
                        <div className="flex items-center justify-between mb-3">
                            <p className={cn("text-xs font-bold uppercase tracking-widest", isSoft ? "text-[var(--text-muted)]" : "text-slate-400")}>Agent Actions</p>
                            <span className={cn("text-[10px] uppercase tracking-widest", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>
                                {actions.length} total
                            </span>
                        </div>
                        {actions.length === 0 ? (
                            <div className={cn("rounded-xl border p-4 text-xs", isSoft ? "soft-ui-in border-0 text-[var(--text-muted)]" : "border-slate-800 bg-slate-900/70 text-slate-500")}>
                                No actions yet. Trigger a report action to start the timeline.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {actions.map((action) => {
                                    const statusColor =
                                        action.status === 'succeeded'
                                            ? 'text-emerald-300 bg-emerald-500/20'
                                            : action.status === 'failed'
                                                ? 'text-rose-300 bg-rose-500/20'
                                                : 'text-amber-300 bg-amber-500/20';
                                    const hasResult = action.result_payload && Object.keys(action.result_payload).length > 0;
                                    return (
                                        <div key={action.action_id} className={cn("rounded-xl border p-3", isSoft ? "soft-ui-in border-0" : "border-slate-800 bg-slate-900/70")}>
                                            <div className="flex items-center justify-between gap-3">
                                                <p className={cn("text-xs font-medium", isSoft ? "text-[var(--text-primary)]" : "text-slate-200")}>{action.action_type}</p>
                                                <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold ${statusColor}`}>
                                                    {action.status}
                                                </span>
                                            </div>
                                            <p className={cn("text-[11px] mt-1 font-mono", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>{action.action_id}</p>
                                            {action.error && (
                                                <p className="text-[11px] text-rose-300 mt-1">{action.error}</p>
                                            )}
                                            {hasResult && (
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    {(() => {
                                                        const payload = action.result_payload as Record<string, unknown>;
                                                        const directProof = typeof payload?.proof_url === 'string' ? payload.proof_url : null;
                                                        const manifest = payload?.manifest as Record<string, unknown> | undefined;
                                                        const manifestWebsite =
                                                            manifest && typeof manifest.website === 'string'
                                                                ? manifest.website
                                                                : null;
                                                        const proofHref = directProof || manifestWebsite;
                                                        return proofHref ? (
                                                            <a
                                                                href={proofHref}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-[11px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                                                            >
                                                                Open Proof
                                                            </a>
                                                        ) : null;
                                                    })()}
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedActionPayload(action)}
                                                        className="text-[11px] px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
                                                    >
                                                        View Payload
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showVerificationDetails && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                    onClick={() => setShowVerificationDetails(false)}
                    role="presentation"
                >
                    <div
                        className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Verification details"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-100">Proof Verification</h3>
                            <button
                                type="button"
                                onClick={() => setShowVerificationDetails(false)}
                                className="text-slate-400 hover:text-slate-100"
                            >
                                Close
                            </button>
                        </div>

                        <div
                            className={`mb-4 rounded-xl border px-3 py-2 text-sm font-semibold ${verified === null
                                ? 'border-slate-700 bg-slate-800/50 text-slate-300'
                                : verified
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                    : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                                }`}
                        >
                            Verification Result:{' '}
                            {verified === null ? 'Not yet verified' : verified ? 'Verified' : 'Failed'}
                        </div>

                        <div className="space-y-3 text-sm mb-4">
                            <div className="grid grid-cols-[140px,1fr] gap-2">
                                <span className="text-slate-500">Method</span>
                                <span className="text-slate-300 font-mono">{attestation?.method || 'n/a'}</span>
                            </div>
                            <div className="grid grid-cols-[140px,1fr] gap-2 items-start">
                                <span className="text-slate-500">Attestation ID</span>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-slate-300 font-mono break-all">{attestation?.attestation_id || 'n/a'}</span>
                                    {attestation?.attestation_id && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(attestation.attestation_id || '');
                                                showToast('Attestation ID copied', 'success');
                                            }}
                                            className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                                        >
                                            Copy
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-[140px,1fr] gap-2 items-start">
                                <span className="text-slate-500">Signer</span>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-slate-300 font-mono break-all">{attestation?.signer || 'n/a'}</span>
                                    {attestation?.signer && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(attestation.signer || '');
                                                    showToast('Signer copied', 'success');
                                                }}
                                                className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                                            >
                                                Copy
                                            </button>
                                            <a
                                                href={`https://etherscan.io/address/${attestation.signer}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[11px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                                            >
                                                Explorer
                                            </a>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-[140px,1fr] gap-2">
                                <span className="text-slate-500">Payload Hash</span>
                                <span className="text-slate-300 font-mono break-all">{attestation?.input_hash || 'n/a'}</span>
                            </div>
                            <div className="grid grid-cols-[140px,1fr] gap-2">
                                <span className="text-slate-500">Code Release</span>
                                <span className="text-slate-300 font-mono break-all">
                                    {(attestedPayload['build_commit'] as string) ||
                                        (attestedPayload['git_commit'] as string) ||
                                        (attestedPayload['release_id'] as string) ||
                                        'n/a'}
                                </span>
                            </div>
                            <div className="grid grid-cols-[140px,1fr] gap-2">
                                <span className="text-slate-500">Timestamp (UTC)</span>
                                <span className="text-slate-300 font-mono">
                                    {attestation?.generated_at
                                        ? new Date(attestation.generated_at).toUTCString()
                                        : summary.generatedAt
                                            ? new Date(summary.generatedAt).toUTCString()
                                            : 'n/a'}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <button
                                type="button"
                                onClick={verifyAttestation}
                                disabled={isVerifying}
                                className="text-xs px-3 py-2 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                            >
                                {isVerifying ? 'Verifying…' : 'Re-verify'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!proofLink) return;
                                    navigator.clipboard.writeText(proofLink);
                                    showToast('Proof URL copied to clipboard', 'success');
                                }}
                                className="text-xs px-3 py-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                            >
                                Share Proof Link
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const blob = new Blob([JSON.stringify(proofJson, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `trende-proof-${queryId.slice(0, 8)}.json`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    URL.revokeObjectURL(url);
                                }}
                                className="text-xs px-3 py-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                            >
                                Download Proof JSON
                            </button>
                        </div>

                        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                            <p className="text-xs text-slate-500 mb-2">Canonical payload preview</p>
                            <pre className="text-xs text-slate-300 overflow-auto max-h-56">
                                {JSON.stringify(attestedPayload, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
            {showAgentManifest && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setShowAgentManifest(false)}
                >
                    <div
                        className="w-full max-w-2xl rounded-3xl border border-cyan-500/30 bg-slate-900 shadow-2xl p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/40">
                                    <Sparkles className="w-5 h-5 text-cyan-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Agent Alpha Manifest</h3>
                            </div>
                            <button onClick={() => setShowAgentManifest(false)} className="text-slate-400 hover:text-white">Close</button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700">
                                <p className="text-sm text-slate-300 mb-2">
                                    This signed JSON manifest is intended for external launch agents operating in the A2A economy.
                                    Any agent with the query ID can fetch and verify this intelligence payload.
                                </p>
                                <div className="flex gap-2 flex-wrap">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 w-fit px-2 py-1 rounded">
                                        <ShieldCheck className="w-3 h-3" /> Server Proof Attached
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-400 uppercase tracking-widest bg-cyan-500/10 w-fit px-2 py-1 rounded">
                                        <Link2 className="w-3 h-3" /> A2A Compatible
                                    </div>
                                </div>
                            </div>

                            {/* A2A Curl Demo — copy this to call Trende from another agent */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Agent Call (curl)</span>
                                    <button
                                        onClick={() => {
                                            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.trende.famile.xyz';
                                            const curlCmd = `curl -X GET "${apiUrl}/api/agent/alpha/${queryId}" \\\n  -H "X-Agent-Id: your-agent-id" \\\n  -H "X-Payment: x402-payment-token"`;
                                            navigator.clipboard.writeText(curlCmd);
                                            setCopiedCurl(true);
                                            showToast('curl command copied!', 'success');
                                            setTimeout(() => setCopiedCurl(false), 2000);
                                        }}
                                        className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors"
                                    >
                                        {copiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                        {copiedCurl ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                <div className="rounded-xl bg-slate-950 border border-slate-800/80 p-3 font-mono text-[10px] text-slate-400 leading-relaxed">
                                    <span className="text-emerald-400">GET</span>{' '}
                                    <span className="text-cyan-300">/api/agent/alpha/<span className="text-amber-300">{queryId.slice(0, 8)}...</span></span>
                                    <br />
                                    <span className="text-slate-600">X-Agent-Id:</span> your-agent-id
                                    <br />
                                    <span className="text-slate-600">X-Payment:</span> x402-token {'// Optional: enables premium alpha'}
                                </div>
                            </div>

                            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 max-h-64 overflow-auto">
                                {manifestData ? (
                                    <pre className="text-xs text-cyan-300 font-mono leading-relaxed">
                                        {JSON.stringify(manifestData, null, 2)}
                                    </pre>
                                ) : (
                                    <div className="flex items-center justify-center py-10 text-slate-500 italic">
                                        {verifyStatus || 'Preparing Alpha Manifest...'}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                disabled={!manifestData}
                                onClick={() => {
                                    navigator.clipboard.writeText(JSON.stringify(manifestData, null, 2));
                                    setCopiedManifest(true);
                                    showToast('Manifest copied for agent handoff!', 'success');
                                    setTimeout(() => setCopiedManifest(false), 2000);
                                }}
                                className="flex-1 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {copiedManifest ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Copied!
                                    </>
                                ) : (
                                    'Copy Manifest JSON'
                                )}
                            </button>
                            <a
                                href={`${process.env.NEXT_PUBLIC_API_URL || 'https://api.trende.famile.xyz'}/api/agent/alpha/${queryId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-3 rounded-2xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all flex items-center gap-2 text-sm font-bold"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Live
                            </a>
                        </div>
                    </div>
                </div>
            )}
            {selectedActionPayload && (
                <div
                    className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
                    onClick={() => setSelectedActionPayload(null)}
                    role="presentation"
                >
                    <div
                        className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Action payload details"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-100">Action Payload</h3>
                                <p className="text-xs text-slate-500 font-mono mt-1">{selectedActionPayload.action_id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(
                                            JSON.stringify(selectedActionPayload.result_payload || {}, null, 2)
                                        );
                                        showToast('Payload JSON copied', 'success');
                                    }}
                                    className="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
                                >
                                    Copy JSON
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const payload = selectedActionPayload.result_payload as Record<string, unknown> | null | undefined;
                                        const attestationId =
                                            (typeof payload?.attestation_id === 'string' && payload.attestation_id) ||
                                            (payload?.manifest &&
                                                typeof (payload.manifest as Record<string, unknown>).attestation === 'object'
                                                ? ((payload.manifest as Record<string, unknown>).attestation as Record<string, unknown>).attestation_id
                                                : null);
                                        if (typeof attestationId === 'string' && attestationId) {
                                            navigator.clipboard.writeText(attestationId);
                                            showToast('Attestation ID copied', 'success');
                                        } else {
                                            showToast('No attestation ID found in payload', 'info');
                                        }
                                    }}
                                    className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                                >
                                    Copy Attestation ID
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedActionPayload(null)}
                                    className="text-slate-400 hover:text-slate-100"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                        {selectedActionPayload.action_type === 'draft_podcast' && (
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const payload = (selectedActionPayload.result_payload || {}) as Record<string, unknown>;
                                        const assets = (payload.assets || {}) as Record<string, unknown>;
                                        const transcript = typeof assets.transcript_markdown === 'string' ? assets.transcript_markdown : '';
                                        if (!transcript) {
                                            showToast('No transcript available in payload', 'info');
                                            return;
                                        }
                                        navigator.clipboard.writeText(transcript);
                                        showToast('Transcript copied', 'success');
                                    }}
                                    className="text-xs px-2 py-1 rounded bg-fuchsia-500/20 text-fuchsia-300 hover:bg-fuchsia-500/30"
                                >
                                    Copy Transcript
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const payload = (selectedActionPayload.result_payload || {}) as Record<string, unknown>;
                                        const assets = (payload.assets || {}) as Record<string, unknown>;
                                        const transcript = typeof assets.transcript_markdown === 'string' ? assets.transcript_markdown : '';
                                        if (!transcript) {
                                            showToast('No transcript available in payload', 'info');
                                            return;
                                        }
                                        const blob = new Blob([transcript], { type: 'text/markdown;charset=utf-8' });
                                        const url = URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.download = `trende-podcast-${queryId.slice(0, 8)}.md`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
                                >
                                    Download Transcript
                                </button>
                            </div>
                        )}
                        <pre className="text-xs text-slate-300 overflow-auto max-h-[60vh] rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                            {JSON.stringify(selectedActionPayload.result_payload || {}, null, 2)}
                        </pre>
                    </div>
                </div>
            )}
        </>
    );
}
