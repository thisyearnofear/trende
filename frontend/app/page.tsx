'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTrendData, useTrendHistory } from '@/hooks/useTrendData';
import { QueryInput } from '@/components/QueryInput';
import { PlatformTabs } from '@/components/PlatformTabs';
import { TrendSummary } from '@/components/TrendSummary';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { KineticHeader, HeroText } from '@/components/KineticHeader';
import { GlassContainer } from '@/components/GlassContainer';
import { AttestationSeal } from '@/components/AttestationSeal';
import { QueryRequest } from '@/lib/types';
import {
  RefreshCw,
  History,
  Zap,
  Database,
  Network,
  LockKeyhole,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Fingerprint,
} from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [queryId, setQueryId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

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

  const handleSubmit = useCallback(async (request: QueryRequest) => {
    try {
      const response = await startAnalysis(request);
      setQueryId(response.id);
    } catch (error) {
      console.error('Failed to start analysis:', error);
    }
  }, [startAnalysis]);

  const handleSelectHistory = (id: string) => {
    setQueryId(id);
    setShowHistory(false);
  };

  const stats = useMemo(() => {
    const platforms = new Set(data?.results.map((result) => result.platform) || []);
    const itemCount = data?.results.reduce((sum, result) => sum + result.items.length, 0) || 0;

    return {
      platforms: platforms.size,
      itemCount,
      confidence: Math.round((data?.summary?.confidenceScore || 0) * 100),
    };
  }, [data]);

  const providerCount =
    data?.telemetry?.providerCount ?? data?.summary?.consensusData?.providers?.length ?? 0;
  const agreementScore = Math.round(
    ((data?.telemetry?.agreementScore ?? data?.summary?.consensusData?.agreement_score ?? 0) * 100)
  );
  const attestationStatus = (
    data?.telemetry?.attestationStatus ||
    data?.summary?.attestationData?.status ||
    (isProcessing ? 'pending' : 'unknown')
  ).toLowerCase();
  const attestationHealthy = attestationStatus === 'signed' || attestationStatus === 'verified';
  const pipelineProgress = progress ?? 0;

  const stages = [
    {
      title: 'Ingest',
      description: 'Collect signals from memes, news, and social sources.',
      icon: Database,
      isDone: Boolean(queryId),
      isActive: !queryId || (isProcessing && pipelineProgress < 35),
    },
    {
      title: 'Consensus',
      description: 'Cross-check multiple model outputs for convergent claims.',
      icon: Network,
      isDone: Boolean(data?.summary && !isProcessing),
      isActive: isProcessing && pipelineProgress >= 35 && pipelineProgress < 80,
    },
    {
      title: 'TEE Attest',
      description: 'Sign consensus in Eigen TEE for verifiable reproducibility.',
      icon: LockKeyhole,
      isDone: attestationHealthy,
      isActive: (isProcessing && pipelineProgress >= 80) || (Boolean(data?.summary) && !attestationHealthy),
    },
  ];

  const activeQueryId = data?.query?.id || queryId;

  return (
    <div className="min-h-screen text-slate-100 pb-10">
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <KineticHeader />

            <div className="flex items-center gap-2">
              <button
                onClick={() => refresh()}
                disabled={!queryId}
                className="p-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
                title="History"
              >
                <History className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/55 animate-overlay"
            onClick={() => setShowHistory(false)}
          />
          <div className="relative w-full sm:w-96 bg-slate-900/95 border-l border-slate-700/70 p-5 overflow-y-auto shadow-2xl animate-slide-in-right">
            <h3 className="font-semibold text-slate-100 mb-4">Recent Missions</h3>
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="text-slate-500 text-sm">No recent analyses</p>
            ) : (
              <div className="space-y-2.5">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectHistory(item.id)}
                    className="w-full text-left p-3 bg-slate-800/85 rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
                  >
                    <p className="text-sm text-slate-200 line-clamp-2">{item.idea}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          item.status === 'completed'
                            ? 'bg-green-500/20 text-green-300'
                            : item.status === 'processing'
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-7 sm:py-10 space-y-8">
        <GlassContainer variant="attested" className="animate-fade-up" sealAnimation>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between p-5 sm:p-7">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/90 mb-3 flex items-center gap-2">
                <Fingerprint className="w-3 h-3" />
                Source. Synthesize. Sovereignize.
              </p>
              <HeroText className="text-2xl sm:text-3xl font-semibold leading-tight text-slate-100">
                Turn social signal into a conviction-ready thesis.
              </HeroText>
              <p className="mt-3 text-slate-300">
                Run multi-platform research, validate confidence, then prepare the output for the Forge and Launchpad workflows.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 w-full lg:w-[52rem]">
              {stages.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className={`rounded-2xl border p-3 sm:p-4 transition-colors ${
                      step.isDone
                        ? 'bg-emerald-500/10 border-emerald-400/35'
                        : step.isActive
                        ? 'bg-cyan-500/10 border-cyan-400/30'
                        : 'bg-slate-800/70 border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-slate-200 mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{step.title}</span>
                      </div>
                      {step.isDone && <CheckCircle2 className="w-4 h-4 text-emerald-300" />}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>
                    {index < stages.length - 1 && (
                      <div className="mt-3 hidden sm:block h-px bg-gradient-to-r from-cyan-400/0 via-cyan-400/60 to-cyan-400/0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </GlassContainer>

        <section className="animate-fade-up" style={{ animationDelay: '80ms' }}>
          <QueryInput
            onSubmit={handleSubmit}
            isLoading={isProcessing}
            disabled={isProcessing}
          />
        </section>

        <section className="animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="rounded-3xl border border-emerald-500/20 bg-slate-900/70 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Trust Rail</p>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="rounded-full border border-slate-700 px-2 py-0.5">Models {providerCount}</span>
                <span className="rounded-full border border-slate-700 px-2 py-0.5">Agreement {agreementScore}%</span>
                <span
                  className={`rounded-full border px-2 py-0.5 ${
                    attestationHealthy
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                      : 'border-amber-500/35 bg-amber-500/10 text-amber-200'
                  }`}
                >
                  TEE {attestationStatus}
                </span>
                <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-cyan-200">
                  Monad-ready
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-300">
              Cross-checked across independent models, then signed through Eigen TEE so the output can be shared as verifiable research.
            </p>
          </div>
        </section>

        {(isProcessing || status === 'processing') && (
          <section className="animate-fade-up" style={{ animationDelay: '120ms' }}>
            <ProcessingStatus
              status={status}
              progress={progress}
              events={events}
              isProcessing={isProcessing}
            />
          </section>
        )}

        {data && data.results && data.results.length > 0 && !isProcessing && (
          <section className="space-y-5 animate-fade-up" style={{ animationDelay: '120ms' }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Sources analyzed</p>
                <p className="text-2xl font-semibold mt-1 text-slate-100">{stats.platforms}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Signals captured</p>
                <p className="text-2xl font-semibold mt-1 text-slate-100">{stats.itemCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Confidence</p>
                <p className="text-2xl font-semibold mt-1 text-emerald-300">{stats.confidence}%</p>
              </div>
            </div>

            {data.telemetry && (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/75 p-4">
                <div className="flex items-center justify-between mb-3 gap-3">
                  <p className="text-sm font-medium text-slate-200">Mission Timeline</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Providers: {data.telemetry.providerCount}</span>
                    <span>Agreement: {Math.round(data.telemetry.agreementScore * 100)}%</span>
                    <span>Diversity: {data.telemetry.diversityLevel}</span>
                  </div>
                </div>
                {data.telemetry.warnings.length > 0 && (
                  <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                    {data.telemetry.warnings.map((warning, index) => (
                      <p key={index} className="text-xs text-amber-200">- {warning}</p>
                    ))}
                  </div>
                )}
                <div className="space-y-2 max-h-44 overflow-auto pr-1">
                  {(data.telemetry.logs || []).map((line, idx) => (
                    <div key={idx} className="text-xs text-slate-400 rounded-md border border-slate-800 bg-slate-950/50 px-2 py-1.5">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              <div className="lg:col-span-1 space-y-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-emerald-200">Consensus Integrity</p>
                    <span className="text-xs text-slate-300">{providerCount} routes</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Agreement</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-300">{agreementScore}%</p>
                    </div>
                    <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">TEE status</p>
                      <p className={`mt-1 text-sm font-semibold ${attestationHealthy ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {attestationStatus}
                      </p>
                    </div>
                  </div>
                </div>

                <TrendSummary summary={data.summary} />

                <div className="rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-900 to-slate-900/70 p-4">
                  <div className="flex items-center gap-2 text-cyan-300 mb-2">
                    <Sparkles className="w-4 h-4" />
                    <p className="text-sm font-medium">Forge Preview</p>
                  </div>
                  <p className="text-sm text-slate-300 mb-4">
                    Your conviction dashboard is ready to be shaped into a public thesis page for memes, news, and hybrid narratives.
                  </p>
                  <Link
                    href={activeQueryId ? `/meme/${activeQueryId}?view=meme` : '#'}
                    aria-disabled={!activeQueryId}
                    className={`w-full rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20 transition-colors inline-flex items-center justify-center ${
                      !activeQueryId ? 'pointer-events-none opacity-50' : ''
                    }`}
                  >
                    Open Meme Page Builder <ArrowRight className="w-4 h-4 inline ml-1" />
                  </Link>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
                  <div className="flex items-center gap-2 text-emerald-300 mb-2">
                    <ShieldCheck className="w-4 h-4" />
                    <p className="text-sm font-medium">Launchpad Readiness</p>
                  </div>
                  <p className="text-sm text-slate-300">
                    Token-launch integration is pending, but this report can already act as your metadata base and social proof layer.
                  </p>
                  <Link
                    href={activeQueryId ? `/meme/${activeQueryId}?view=news` : '#'}
                    aria-disabled={!activeQueryId}
                    className={`mt-3 inline-flex items-center text-sm text-emerald-300 hover:text-emerald-200 ${
                      !activeQueryId ? 'pointer-events-none opacity-50' : ''
                    }`}
                  >
                    Open Verifiable News Synthesizer <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-2">
                <PlatformTabs results={data.results} />
              </div>
            </div>
          </section>
        )}

        {!queryId && !isProcessing && (
          <section className="rounded-3xl border border-slate-700 bg-slate-900/70 p-8 text-center animate-fade-up" style={{ animationDelay: '120ms' }}>
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
              <Zap className="w-10 h-10 text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-200 mb-2">
              Start in the Laboratory
            </h3>
            <p className="text-slate-400 max-w-xl mx-auto">
              Submit a precise brief, select your worlds, and Trende will map signal, validate cross-references, and generate an actionable conviction summary.
            </p>
          </section>
        )}

        {data?.query?.status === 'failed' && (
          <section className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
            <h3 className="text-red-400 font-semibold mb-2">Analysis Failed</h3>
            <p className="text-slate-400 text-sm">
              {data.query.errorMessage || 'An error occurred while processing your request.'}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
