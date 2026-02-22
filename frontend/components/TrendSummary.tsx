'use client';

import { TrendSummary as TrendSummaryType } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, Lightbulb, Clock, ShieldCheck, Flame, Sparkles, Radar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, Badge, Progress, Alert } from './DesignSystem';
import { useTheme } from './ThemeProvider';

interface TrendSummaryProps {
  summary?: TrendSummaryType;
  sourceLabelByOrdinal?: Record<number, string>;
  isLoading?: boolean;
}

export function TrendSummary({ summary, sourceLabelByOrdinal = {}, isLoading }: TrendSummaryProps) {
  const { isSoft } = useTheme();
  if (isLoading) {
    return (
      <Card accent="cyan" className="p-6 animate-pulse glass border-cyan-500/30">
        <div className="h-6 w-48 bg-cyan-500/10 mb-4 rounded" />
        <div className="h-4 w-full bg-white/5 mb-2 rounded" />
        <div className="h-4 w-3/4 bg-white/5 mb-4 rounded" />
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-white/5 rounded" />
          <div className="h-6 w-20 bg-white/5 rounded" />
        </div>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  const getSentimentIcon = () => {
    switch (summary.sentiment) {
      case 'positive': return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      case 'negative': return <TrendingDown className="w-5 h-5 text-rose-400" />;
      default: return <Minus className="w-5 h-5 text-amber-400" />;
    }
  };

  const confidence = Math.round((summary.confidenceScore || 0) * 100);
  const consensus = summary.consensusData;
  const agreement = Math.round((consensus?.agreement_score || 0) * 100);

  return (
    <Card accent="white" shadow="md" className="p-0 overflow-hidden glass border-white/10 group">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-transparent via-white/5 to-transparent border-b border-white/10 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-20 animate-pulse" />
            <Sparkles className="w-6 h-6 text-cyan-400 relative z-10" />
          </div>
          <div>
            <h3 className="font-black uppercase tracking-[0.2em] text-sm text-white">Conviction Report</h3>
            <p className="text-[10px] text-cyan-400/70 font-mono">ID: {summary.generatedAt.slice(-8)}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full glass border-white/5`}>
          {getSentimentIcon()}
          <span className="text-xs font-black uppercase tracking-wider">{summary.sentiment}</span>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Executive Summary Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Executive Summary</h4>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
          </div>
          <p className="text-sm text-white/80 leading-relaxed font-light italic text-center px-4">
            &ldquo;{summary.overview}&rdquo;
          </p>
        </section>

        {/* Neural Consensus Matrix */}
        {consensus && (
          <section className="glass rounded-xl p-5 border-amber-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2">
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                <div className="w-1 h-1 rounded-full bg-amber-400 animate-pulse delay-75" />
                <div className="w-1 h-1 rounded-full bg-amber-400 animate-pulse delay-150" />
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Radar className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-500">Neural Consensus Matrix</h4>
              </div>
              <Badge variant="amber" className="bg-amber-500/10 border-amber-500/30 text-amber-400">
                {consensus.diversity_level || 'low'} Diversity
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Model Agreement</p>
                  <p className="text-2xl font-black text-white">{agreement}%</p>
                </div>
                <Progress value={agreement} accent="amber" className="h-1.5" />
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Participating Oracles</p>
                <div className="flex flex-wrap gap-2">
                  {consensus.providers?.map((p) => (
                    <div key={p} className="flex items-center gap-2 glass px-2 py-1 rounded-md border-white/5">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_var(--accent-cyan)]" />
                      <span className="text-[10px] uppercase font-bold text-white/70 tracking-tight">{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {consensus.main_divergence && (
              <div className="mt-6 pt-4 border-t border-white/5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500/60 mb-2">Divergence Signal</p>
                <div className="bg-amber-500/5 p-3 border-l-2 border-amber-500/40">
                  <p className="text-xs text-amber-200/70 italic leading-relaxed font-mono">
                    {consensus.main_divergence}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Signals & Trust */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* High Impact Signals */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-white/60">High-Impact Signals</h4>
            </div>
            <div className="space-y-2">
              {summary.topTrends.slice(0, 3).map((trend, index) => (
                <div key={index} className="flex items-start gap-3 p-3 glass-cyan rounded-lg border-cyan-500/10 group/item hover:bg-cyan-500/10 transition-colors">
                  <span className="text-[10px] font-black text-cyan-400 bg-cyan-500/10 w-5 h-5 flex items-center justify-center rounded">
                    0{index + 1}
                  </span>
                  <p className="text-xs text-white/80 group-hover/item:text-white transition-colors">
                    {typeof trend === 'object' && 'title' in trend ? (trend.title as string) : String(trend)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Research Integrity */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-white/60">Integrity Score</h4>
            </div>
            <div className="glass rounded-xl p-4 border-emerald-500/10 space-y-4">
              <div className="flex items-baseline justify-between">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Confidence Index</p>
                <p className="text-xl font-black text-emerald-400">{confidence}%</p>
              </div>
              <Progress value={confidence} accent="emerald" className="h-1.5" />

              {summary.validationResults && summary.validationResults.length > 0 && (
                <div className="pt-4 space-y-2 border-t border-white/5">
                  {summary.validationResults.slice(0, 3).map((log, i) => (
                    <div key={i} className="flex gap-2 text-[10px] text-white/50 font-mono">
                      <span className="text-emerald-500/50">▶</span>
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Meta */}
      <div className="bg-black/40 border-t border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-[0.2em]">
          <Clock className="w-3 h-3" />
          <span>Fulfillment: {formatDistanceToNow(new Date(summary.generatedAt), { addSuffix: true })}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black text-white/40 uppercase">Attested on EigenCompute</span>
        </div>
      </div>
    </Card>
  );
}
