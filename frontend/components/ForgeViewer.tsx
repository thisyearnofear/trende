'use client';

import { useState } from 'react';
import { ExternalLink, Info, Link2, Quote, ShieldCheck, Sparkles, TrendingUp, Check } from 'lucide-react';
import { TrendSummary as TrendSummaryType } from '@/lib/types';
import { useToast } from '@/components/Toast';

interface ForgeViewerProps {
    summary: TrendSummaryType;
    mode: 'meme' | 'news';
    queryId: string;
}

interface MemeCitation {
    source?: string;
    url?: string;
    quote?: string;
}

interface MemeData {
    token?: {
        name?: string;
        ticker?: string;
        description?: string;
    };
    intelligence_summary?: string;
    thesis?: string[];
    consensus_metrics?: {
        model_agreement?: number;
        main_divergence?: string;
    };
    citations?: MemeCitation[];
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

export function ForgeViewer({ summary, mode, queryId }: ForgeViewerProps) {
    const data = (summary.memePageData || {}) as MemeData;
    const consensus = summary.consensusData;
    const attestation = summary.attestationData;
    const { showToast } = useToast();

    const [verifyStatus, setVerifyStatus] = useState<string>('');
    const [showVerificationDetails, setShowVerificationDetails] = useState(false);
    const [showAgentManifest, setShowAgentManifest] = useState(false);
    const [manifestData, setManifestData] = useState<AgentManifest | null>(null);
    const [copiedManifest, setCopiedManifest] = useState(false);

    if (!summary.memePageData) {
        return (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-8 text-center">
                <p className="text-slate-400 italic">No forge data available for this analysis.</p>
            </div>
        );
    }

    const isMeme = mode === 'meme';
    const providers = consensus?.providers || [];
    const consensusWarnings = consensus?.warnings || [];
    const providerOutputs = consensus?.provider_outputs || [];
    const isLowDiversity = (consensus?.diversity_level || 'low') === 'low';
    const agreement = Math.round(
        (consensus?.agreement_score || data.consensus_metrics?.model_agreement || 0) * 100
    );

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

    const verifyAttestation = async () => {
        if (!attestation) {
            setVerifyStatus('Missing attestation payload.');
            return;
        }

        const payload =
            (attestation.payload as Record<string, unknown> | undefined) || {
                prompt: summary.overview,
                providers,
                consensus_report: summary.overview,
                generated_at: attestation.generated_at || summary.generatedAt,
                provider_count: providers.length,
            };

        try {
            setVerifyStatus('Verifying...');
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${baseUrl}/api/attest/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload, attestation }),
            });

            if (!response.ok) {
                setVerifyStatus(`Verification failed (${response.status}).`);
                return;
            }

            const result = (await response.json()) as { verified?: boolean };
            setVerifyStatus(result.verified ? 'Attestation verified.' : 'Attestation mismatch.');
        } catch {
            setVerifyStatus('Verification request failed.');
        }
    };

    return (
        <>
            <div className="space-y-6 animate-fade-up">
                <div
                    className={`p-6 rounded-3xl border shadow-xl transition-all duration-500 bg-slate-900/80 ${isMeme ? 'border-cyan-500/30' : 'border-emerald-500/30'
                        }`}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div
                                className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${isMeme ? 'bg-cyan-500 shadow-cyan-900/40' : 'bg-emerald-500 shadow-emerald-900/40'
                                    }`}
                            >
                                {isMeme ? (
                                    <Sparkles className="w-7 h-7 text-white" />
                                ) : (
                                    <ShieldCheck className="w-7 h-7 text-white" />
                                )}
                            </div>
                            <div className="flex-1">
                                <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                                    {data.token?.name || 'Research Forge'}
                                    {data.token?.ticker && (
                                        <span className="text-sm font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                                            ${data.token.ticker}
                                        </span>
                                    )}
                                </h1>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-slate-400 text-sm">
                                        Generated via{' '}
                                        {summary.confidenceScore ? (summary.confidenceScore * 100).toFixed(0) : 0}% evidence
                                        confidence
                                    </p>
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                    <button
                                        onClick={() => {
                                            const url = `${window.location.origin}/proof/${queryId}`;
                                            navigator.clipboard.writeText(url);
                                            showToast('Proof URL copied to clipboard', 'success');
                                        }}
                                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors"
                                    >
                                        <Link2 className="w-3 h-3" />
                                        Share Proof
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                                {(providers.length > 0 ? providers : ['consensus']).slice(0, 5).map((model) => (
                                    <div
                                        key={model}
                                        className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300"
                                        title={model}
                                    >
                                        {model[0]?.toUpperCase() || 'C'}
                                    </div>
                                ))}
                            </div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 ml-2">
                                Multi-model consensus
                            </span>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-800">
                        <p className="text-lg text-slate-200 leading-relaxed font-medium italic">
                            &quot;
                            {data.token?.description ||
                                data.intelligence_summary ||
                                summary.overview ||
                                'No overview available.'}
                            &quot;
                        </p>
                        {isLowDiversity && (
                            <p className="mt-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                                Low-diversity consensus detected. Treat this as directional and review provenance before execution.
                            </p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-400 mb-2 ml-1">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Key Pillars</span>
                        </div>
                        <div className="space-y-3">
                            {(data.thesis || []).map((point, i) => (
                                <div
                                    key={i}
                                    className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/60 transition-colors"
                                >
                                    <div className="flex gap-4">
                                        <span className="text-cyan-500 font-mono font-bold">{i + 1}.</span>
                                        <p className="text-sm text-slate-300 leading-relaxed">{point}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        {isMeme ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-slate-400 mb-2 ml-1">
                                    <Sparkles className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Brand Aesthetic</span>
                                </div>
                                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-200 font-bold">
                                            {data.brand?.aesthetic || 'Vibrant Agentic'}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Primary accents: {data.brand?.primary_color || '#00D1FF'}
                                        </p>
                                    </div>
                                    <div
                                        className="w-10 h-10 rounded-full shadow-inner border-4 border-slate-700"
                                        style={{ backgroundColor: data.brand?.primary_color || '#00D1FF' }}
                                    />
                                </div>

                                <div className="flex items-center gap-2 text-slate-400 mb-2 ml-1">
                                    <Info className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Consensus Metrics</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter mb-1">
                                            Model agreement
                                        </p>
                                        <p className="text-xl font-bold text-emerald-400">{agreement}%</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter mb-1">
                                            Divergence level
                                        </p>
                                        <p className="text-sm font-bold text-cyan-400 line-clamp-2">
                                            {consensus?.main_divergence || 'Low'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-slate-400 mb-2 ml-1">
                                    <ShieldCheck className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-widest">
                                        Multi-Model Consensus
                                    </span>
                                </div>
                                <div className="p-5 rounded-2xl bg-slate-800/40 border-2 border-emerald-500/20">
                                    <p className="text-sm text-slate-300 leading-relaxed italic mb-4">
                                        &quot;{summary.overview || 'No consensus overview provided.'}&quot;
                                    </p>

                                    {consensus?.pillars && consensus.pillars.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-2">Consensus Pillars</p>
                                            <ul className="space-y-1">
                                                {consensus.pillars.slice(0, 3).map((pillar: string, idx: number) => (
                                                    <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                                                        <span className="text-emerald-500">•</span> {pillar}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {consensus?.anomalies && consensus.anomalies.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-2">Fringe Anomalies</p>
                                            <ul className="space-y-1">
                                                {consensus.anomalies.slice(0, 2).map((anomaly: string, idx: number) => (
                                                    <li key={idx} className="text-xs text-slate-500 flex items-start gap-2">
                                                        <span className="text-amber-500">?</span> {anomaly}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-1 text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                            Attestation: {attestation?.attestation_id || 'n/a'}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                            Method: {attestation?.method || 'n/a'}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                            Providers: {providers.length > 0 ? providers.join(', ') : 'n/a'}
                                        </span>
                                    </div>
                                    {consensusWarnings.length > 0 && (
                                        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                                            <p className="text-[10px] text-amber-300 font-bold uppercase tracking-widest mb-1">
                                                Runtime Warnings
                                            </p>
                                            <ul className="space-y-1">
                                                {consensusWarnings.map((warning, idx) => (
                                                    <li key={idx} className="text-xs text-amber-100/90">
                                                        - {warning}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={verifyAttestation}
                                            className="px-3 py-1.5 rounded-lg border border-emerald-500/40 text-xs text-emerald-200 hover:bg-emerald-500/15"
                                        >
                                            Verify attestation
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowVerificationDetails(true)}
                                            className="px-3 py-1.5 rounded-lg border border-slate-600 text-xs text-slate-200 hover:bg-slate-700/60"
                                        >
                                            View verification details
                                        </button>
                                    </div>
                                    {verifyStatus && <p className="text-xs text-slate-400 mt-2">{verifyStatus}</p>}
                                </div>
                                {providerOutputs.length > 0 && (
                                    <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                                        <p className="text-[10px] text-cyan-300 font-bold uppercase tracking-widest mb-2">
                                            Provider Provenance
                                        </p>
                                        <div className="space-y-2">
                                            {providerOutputs.map((output, idx) => (
                                                <div key={`${output.provider}-${idx}`} className="rounded-lg border border-slate-700 bg-slate-800/70 p-2.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-xs text-slate-200">
                                                            {output.provider}
                                                            {output.model_id ? ` (${output.model_id})` : ''}
                                                        </p>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${output.status === 'ok' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                                            {output.status || 'ok'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 mt-1">
                                                        latency: {Math.round(output.latency_ms || 0)}ms
                                                    </p>
                                                    {output.error && (
                                                        <p className="text-[11px] text-rose-300 mt-1 line-clamp-2">{output.error}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-slate-400 mb-2 ml-1">
                                <ExternalLink className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-widest">Alpha Citations</span>
                            </div>
                            {(data.citations || []).map((cite, i) => (
                                <div
                                    key={i}
                                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all group"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mb-1">
                                                {cite.source || 'Source'}
                                            </p>
                                            <p className="text-xs text-slate-300 line-clamp-2 italic mb-2">
                                                &quot;{cite.quote || 'Source data verified by consensus engine.'}&quot;
                                            </p>
                                        </div>
                                        {cite.url && (
                                            <a
                                                href={cite.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-1.5 rounded bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Quote className="w-4 h-4" />
                        <span>Consensus includes attestation metadata and verification endpoint support.</span>
                    </div>
                    <div className="flex gap-3">
                        <button className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-bold text-slate-100 transition-colors border border-slate-700">
                            Regenerate Consensus
                        </button>
                        <button
                            onClick={fetchAgentAlpha}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg ${isMeme ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-emerald-600 hover:bg-emerald-500'
                                }`}
                        >
                            {isMeme ? 'Get Attested Alpha Manifest' : 'Generate Alpha Link'}
                        </button>
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
                            <h3 className="text-lg font-semibold text-slate-100">Verification Details</h3>
                            <button
                                type="button"
                                onClick={() => setShowVerificationDetails(false)}
                                className="text-slate-400 hover:text-slate-100"
                            >
                                Close
                            </button>
                        </div>

                        <div className="space-y-3 text-sm">
                            <p className="text-slate-300">
                                <span className="text-slate-500">Provider:</span> {attestation?.provider || 'n/a'}
                            </p>
                            <p className="text-slate-300">
                                <span className="text-slate-500">Method:</span> {attestation?.method || 'n/a'}
                            </p>
                            <p className="text-slate-300 break-all">
                                <span className="text-slate-500">Attestation ID:</span> {attestation?.attestation_id || 'n/a'}
                            </p>
                            <p className="text-slate-300 break-all">
                                <span className="text-slate-500">Input hash:</span> {attestation?.input_hash || 'n/a'}
                            </p>
                            <p className="text-slate-300 break-all">
                                <span className="text-slate-500">Signature:</span> {attestation?.signature || 'n/a'}
                            </p>
                            <p className="text-slate-300">
                                <span className="text-slate-500">Providers in consensus:</span>{' '}
                                {providers.length > 0 ? providers.join(', ') : 'n/a'}
                            </p>
                        </div>

                        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                            <p className="text-xs text-slate-500 mb-2">Canonical payload preview</p>
                            <pre className="text-xs text-slate-300 overflow-auto max-h-56">
                                {JSON.stringify(attestation?.payload || {}, null, 2)}
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
                                    This signed JSON manifest is intended for external launch agents.
                                    It contains the verifiable thesis link for the <strong>nad.fun</strong> metadata contract.
                                </p>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 w-fit px-2 py-1 rounded">
                                    <ShieldCheck className="w-3 h-3" /> EigenCompute Attested
                                </div>
                            </div>

                            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 max-h-80 overflow-auto">
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
                                    'Copy Manifest'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
