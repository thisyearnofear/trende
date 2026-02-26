'use client';

import { use, useEffect } from 'react';
import { useTrendData } from '@/hooks/useTrendData';
import { ReportViewer } from '@/components/ReportViewer';
import { AttestationBadge } from '@/components/AttestationBadge';
import { ShieldCheck, ArrowLeft, Loader2, Link2, Fingerprint, Lock } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

export default function ProofPage({ params }: { params: Promise<{ queryId: string }> }) {
    const { queryId } = use(params);
    const { data, isProcessing, status } = useTrendData(queryId);
    const { showToast } = useToast();

    useEffect(() => {
        if (typeof window !== 'undefined' && queryId) {
            window.localStorage.setItem('trende:last_query_id', queryId);
        }
    }, [queryId]);

    const handleDownloadReport = async () => {
        try {
            showToast('Generating report export...', 'success');
            const { blob, filename, contentType } = await api.downloadReport(queryId, 'pdf');
            if (!contentType?.includes('application/pdf')) {
                throw new Error('Export did not return a PDF');
            }
            if (!blob || blob.size < 1024) {
                throw new Error('Generated report is empty');
            }
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `trende-report-${queryId.slice(0, 8)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showToast('Report downloaded successfully.', 'success');
        } catch (error) {
            console.error('Download failed:', error);
            showToast('Failed to download report.', 'error');
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-emerald-500/30">
            {/* Verification Matrix Background */}
            <div className="fixed inset-0 pointer-events-none opacity-20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#10b981_0%,transparent_50%)] blur-[120px] -top-1/2" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
            </div>

            <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-2xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <Link href="/" className="p-2 rounded-full hover:bg-white/5 transition-colors group">
                                <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-slate-100" />
                            </Link>
                            <div>
                                <h1 className="text-sm font-bold tracking-tight text-slate-100 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                    Institutional Proof
                                </h1>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-[0.2em]">
                                    Verifiable Alpha Layer
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            <button
                                onClick={handleDownloadReport}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                            >
                                <Fingerprint className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Download</span> Report
                            </button>
                            <AttestationBadge
                                attestation={data?.summary?.attestationData}
                                size="md"
                                showDetails
                            />
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    showToast('Proof URL copied to clipboard', 'success');
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                            >
                                <Link2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Copy Proof URL</span>
                                <span className="sm:hidden">Copy URL</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-12 relative z-10">
                {!data || isProcessing ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-8">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-[2rem] bg-emerald-500/20 blur-2xl absolute -inset-4 animate-pulse" />
                            <div className="w-24 h-24 bg-slate-900 border border-slate-700/50 rounded-[2rem] flex items-center justify-center relative backdrop-blur-xl">
                                <Loader2 className="w-10 h-10 animate-spin text-emerald-400 stroke-[1.5]" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h2 className="text-xl font-semibold text-slate-100 tracking-tight">Retrieving Consensus Data</h2>
                            <p className="text-slate-500 text-xs uppercase tracking-[0.3em] font-medium">
                                {status || 'Verifying Attestation...'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Header section for the proof */}
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Resource ID: <span className="text-slate-100">{queryId}</span>
                            </div>
                            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                                Proof of Technical & Social Research
                            </h2>
                            <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
                                This document serves as a permanent cryptographic record of the multi-model consensus reached for the topic
                                <span className="text-emerald-400 font-medium px-1">&quot;{data.query?.idea}&quot;</span>.
                            </p>
                        </div>

                        {/* Verification Content */}
                        <div className="grid grid-cols-1 gap-12">
                            {data.summary && (
                                <ReportViewer summary={data.summary} mode="news" queryId={queryId} />
                            )}
                        </div>

                        {/* Immutable Footnote */}
                        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4 sm:p-8 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                    <Lock className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Cryptographically Secured</h3>
                                    <p className="text-xs text-emerald-400 font-mono">TEE Attestation • Non-Repudiable</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
                                    <div className="flex items-start gap-3">
                                        <Fingerprint className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-bold text-white mb-1">What is TEE Attestation?</h4>
                                            <p className="text-sm text-slate-400 leading-relaxed">
                                                A Trusted Execution Environment (TEE) is a secure area of a processor that guarantees
                                                code and data are protected. This report was generated inside a TEE and cryptographically
                                                signed, providing verifiable proof that the consensus process was executed securely without
                                                tampering.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
                                        <ShieldCheck className="w-5 h-5 text-emerald-400 mb-2" />
                                        <h4 className="text-xs font-bold text-white mb-1 uppercase tracking-wider">Non-Repudiation</h4>
                                        <p className="text-xs text-slate-400">
                                            Cryptographic signature proves this came from our TEE
                                        </p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
                                        <Lock className="w-5 h-5 text-emerald-400 mb-2" />
                                        <h4 className="text-xs font-bold text-white mb-1 uppercase tracking-wider">Integrity</h4>
                                        <p className="text-xs text-slate-400">
                                            Any tampering with the data is immediately detectable
                                        </p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
                                        <Fingerprint className="w-5 h-5 text-emerald-400 mb-2" />
                                        <h4 className="text-xs font-bold text-white mb-1 uppercase tracking-wider">Verifiable</h4>
                                        <p className="text-xs text-slate-400">
                                            Anyone can independently verify the signature
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm text-slate-400 leading-relaxed">
                                This report was synthesized from parallel inferences across independent AI providers including Venice,
                                AIsa, and OpenRouter. The resulting consensus was cryptographically attested using a Trusted Execution
                                Environment (TEE) to ensure non-repudiation, verifiable provenance, and bias suppression.
                            </p>

                            <div className="pt-4 border-t border-slate-700/50 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Generated At</p>
                                    <p className="text-xs text-slate-200 font-mono">{new Date(data.summary?.generatedAt || '').toUTCString()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Attestation</p>
                                    <p className="text-xs text-emerald-400 font-mono">{data.summary?.attestationData?.attestation_id?.slice(0, 16) || 'n/a'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Oracle Version</p>
                                    <p className="text-xs text-slate-200 font-mono">Institutional-v2.1</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Network</p>
                                    <p className="text-xs text-slate-200">Base Sepolia / Arbitrum Sepolia</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <footer className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-20 border-t border-white/5 text-center space-y-6">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em]">Powered by Trende Sovereign Agent</p>
                <div className="flex items-center justify-center gap-8 opacity-40">
                    {/* Add partner logos or icons here */}
                    <div className="w-8 h-8 rounded-full bg-slate-800" />
                    <div className="w-8 h-8 rounded-full bg-slate-800" />
                    <div className="w-8 h-8 rounded-full bg-slate-800" />
                </div>
            </footer>
        </div>
    );
}
