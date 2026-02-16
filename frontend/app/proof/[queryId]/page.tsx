'use client';

import { use } from 'react';
import { useTrendData } from '@/hooks/useTrendData';
import { ForgeViewer } from '@/components/ForgeViewer';
import { ShieldCheck, ArrowLeft, Loader2, Link2 } from 'lucide-react';
import Link from 'next/link';

export default function ProofPage({ params }: { params: Promise<{ queryId: string }> }) {
    const { queryId } = use(params);
    const { data, isProcessing, status } = useTrendData(queryId);

    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-emerald-500/30">
            {/* Verification Matrix Background */}
            <div className="fixed inset-0 pointer-events-none opacity-20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#10b981_0%,transparent_50%)] blur-[120px] -top-1/2" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
            </div>

            <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-2xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
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

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Attested</span>
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                            >
                                <Link2 className="w-3.5 h-3.5" />
                                Copy Proof URL
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12 relative z-10">
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
                            <h2 className="text-4xl font-bold tracking-tight text-white leading-tight">
                                Proof of Technical & Social Research
                            </h2>
                            <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
                                This document serves as a permanent cryptographic record of the multi-model consensus reached for the topic
                                <span className="text-emerald-400 font-medium whitespace-nowrap px-1">&quot;{data.query?.idea}&quot;</span>.
                            </p>
                        </div>

                        {/* Verification Content */}
                        <div className="grid grid-cols-1 gap-12">
                            {data.summary && (
                                <ForgeViewer summary={data.summary} mode="news" queryId={queryId} />
                            )}
                        </div>

                        {/* Immutable Footnote */}
                        <div className="rounded-2xl border border-white/5 bg-white/5 p-8 space-y-6">
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                                <h3 className="text-lg font-semibold text-white">Trust Minimization</h3>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                This report was synthesized from parallel inferences across independent AI providers including Venice,
                                AIsa, and OpenRouter. The resulting consensus was cryptographically signed via EigenCompute (TEE)
                                to ensure non-repudiation and bias suppression.
                            </p>
                            <div className="pt-4 border-t border-white/5 flex flex-wrap gap-8">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Generated At</p>
                                    <p className="text-sm text-slate-200 font-mono">{new Date(data.summary?.generatedAt || '').toUTCString()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Oracle Version</p>
                                    <p className="text-sm text-slate-200 font-mono">Institutional-v2.1</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Network</p>
                                    <p className="text-sm text-slate-200">Monad Agentic Layer</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <footer className="max-w-4xl mx-auto px-6 py-20 border-t border-white/5 text-center space-y-6">
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
