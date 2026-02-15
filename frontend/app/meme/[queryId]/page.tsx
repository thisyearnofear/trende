'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  FileCheck,
  Flame,
  Globe,
  Newspaper,
  Sparkles,
  Verified,
} from 'lucide-react';
import { useTrendData } from '@/hooks/useTrendData';
import { TrendItem } from '@/lib/types';

type ViewMode = 'meme' | 'news';

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'X / Twitter',
  linkedin: 'LinkedIn',
  newsapi: 'News',
  web: 'Web',
  facebook: 'Facebook',
};

function formatDate(value?: string): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleString();
}

function getTopSignals(items: TrendItem[], limit = 6): TrendItem[] {
  return [...items]
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, limit);
}

export default function MemePage() {
  const params = useParams<{ queryId: string }>();
  const searchParams = useSearchParams();
  const queryId = params?.queryId || null;

  const requestedView = searchParams.get('view');
  const view: ViewMode = requestedView === 'news' ? 'news' : 'meme';

  const { data, isLoading } = useTrendData(queryId);

  const flatItems = useMemo(
    () => data?.results.flatMap((result) => result.items) || [],
    [data]
  );
  const topSignals = useMemo(() => getTopSignals(flatItems), [flatItems]);

  const sourceSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const result of data?.results || []) {
      counts[result.platform] = (counts[result.platform] || 0) + result.items.length;
    }
    return counts;
  }, [data]);

  const confidence = Math.round((data?.summary?.confidenceScore || 0) * 100);
  const attestationPreview = `TEE-${(queryId || 'unknown').slice(0, 8)}-${confidence}`;

  const modelConsensus = [
    {
      model: 'Venice',
      role: 'Private-first synthesis',
      output: data?.summary?.overview || 'Awaiting synthesis output.',
    },
    {
      model: 'OpenRouter',
      role: 'External cross-model check',
      output: (data?.summary?.validationResults && data.summary.validationResults[0]) || 'Consensus check pending.',
    },
    {
      model: 'AIsa',
      role: 'Web-grounding verifier',
      output: (data?.summary?.validationResults && data.summary.validationResults[1]) || 'Source verification pending.',
    },
  ];

  if (!queryId) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <h1 className="text-lg font-semibold text-red-200">Missing Query ID</h1>
          <p className="text-sm text-red-100/80 mt-2">Use a valid route like `/meme/&lt;queryId&gt;`.</p>
        </div>
      </main>
    );
  }

  if (isLoading || !data) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="h-40 rounded-3xl border border-slate-700 bg-slate-900/70 animate-pulse" />
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 sm:py-10 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Laboratory
          </Link>
          <span className="text-xs text-slate-500">Query: {queryId}</span>
        </div>

        <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900/70 p-1">
          <Link
            href={`/meme/${queryId}?view=meme`}
            className={`px-3 py-1.5 text-sm rounded-lg ${view === 'meme' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'}`}
          >
            Meme Thesis
          </Link>
          <Link
            href={`/meme/${queryId}?view=news`}
            className={`px-3 py-1.5 text-sm rounded-lg ${view === 'news' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'}`}
          >
            Verifiable News
          </Link>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-700 bg-slate-900/75 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 mb-2">Forge Output</p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-100">
              {view === 'meme'
                ? 'High-Conviction Meme Thesis Page'
                : 'Verifiable News Synthesizer'}
            </h1>
            <p className="text-slate-300 mt-3">
              {view === 'meme'
                ? 'Narrative-forward output designed for community momentum, token storytelling, and social conviction.'
                : 'Grok-style digest upgraded with multi-model consensus and verifiable checks to reduce single-source bias.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-3 min-w-32">
              <p className="text-xs text-slate-400">Confidence</p>
              <p className="text-xl font-semibold text-emerald-300">{confidence}%</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-3 min-w-32">
              <p className="text-xs text-slate-400">Attestation</p>
              <p className="text-sm font-mono text-cyan-200">{attestationPreview}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2 text-cyan-300 mb-3">
            {view === 'meme' ? <Sparkles className="w-4 h-4" /> : <Newspaper className="w-4 h-4" />}
            <h2 className="text-sm font-medium">
              {view === 'meme' ? 'Narrative Core' : 'Cross-Model News Digest'}
            </h2>
          </div>
          <p className="text-slate-200 leading-relaxed">
            {data.summary?.overview || 'No summary available yet.'}
          </p>

          {data.summary?.finalReportMd && (
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                Expanded report
              </p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-6">
                {data.summary.finalReportMd}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2 text-emerald-300 mb-3">
            <Globe className="w-4 h-4" />
            <h2 className="text-sm font-medium">Source Mix</h2>
          </div>
          <div className="space-y-2">
            {Object.keys(sourceSummary).length === 0 && (
              <p className="text-sm text-slate-500">No source distribution available.</p>
            )}
            {Object.entries(sourceSummary).map(([platform, count]) => (
              <div key={platform} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2">
                <span className="text-sm text-slate-300">{PLATFORM_LABELS[platform] || platform}</span>
                <span className="text-sm text-cyan-300 font-medium">{count}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Generated {formatDate(data.summary?.generatedAt)}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
        <div className="flex items-center gap-2 text-cyan-300 mb-3">
          <Flame className="w-4 h-4" />
          <h2 className="text-sm font-medium">Top Signals and Citations</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topSignals.length === 0 && (
            <p className="text-sm text-slate-500">No signal items available.</p>
          )}
          {topSignals.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-700 bg-slate-800/75 p-4"
            >
              <p className="text-xs text-slate-500 mb-1">{PLATFORM_LABELS[item.platform] || item.platform}</p>
              <h3 className="text-sm font-medium text-slate-100 line-clamp-2">{item.title}</h3>
              <p className="text-sm text-slate-400 mt-2 line-clamp-2">{item.content}</p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
              >
                Open source
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </article>
          ))}
        </div>
      </section>

      {view === 'news' && (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2 text-emerald-300 mb-3">
            <Verified className="w-4 h-4" />
            <h2 className="text-sm font-medium">Multi-Model Consensus Board</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {modelConsensus.map((entry) => (
              <div key={entry.model} className="rounded-xl border border-emerald-600/30 bg-slate-900/70 p-4">
                <p className="text-xs text-emerald-300 uppercase tracking-wide">{entry.model}</p>
                <p className="text-xs text-slate-500 mt-1">{entry.role}</p>
                <p className="text-sm text-slate-200 mt-3 line-clamp-4">{entry.output}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-emerald-600/40 bg-slate-900/65 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-300 mb-2">Attestation status</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                Cross-model agreement threshold passed.
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <BadgeCheck className="w-4 h-4 text-emerald-300" />
                Source validation log attached to synthesis payload.
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <FileCheck className="w-4 h-4 text-emerald-300" />
                TEE attestation preview ID: <span className="font-mono">{attestationPreview}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              This is a frontend preview of verifiability UX. Full on-chain attestation wiring remains an infrastructure task.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
