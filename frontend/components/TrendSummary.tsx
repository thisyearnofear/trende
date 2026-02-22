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
      <Card accent="cyan" className={cn("p-6 animate-pulse glass", isSoft ? "soft-ui-out border-0" : "border-cyan-500/30")}>
        <div className={cn("h-6 w-48 mb-4 rounded", isSoft ? "bg-[var(--text-muted)]/10" : "bg-cyan-500/10")} />
        <div className={cn("h-4 w-full mb-2 rounded", isSoft ? "bg-[var(--text-muted)]/5" : "bg-white/5")} />
        <div className={cn("h-4 w-3/4 mb-4 rounded", isSoft ? "bg-[var(--text-muted)]/5" : "bg-white/5")} />
        <div className="flex gap-2">
          <div className={cn("h-6 w-20 rounded", isSoft ? "bg-[var(--text-muted)]/5" : "bg-white/5")} />
          <div className={cn("h-6 w-20 rounded", isSoft ? "bg-[var(--text-muted)]/5" : "bg-white/5")} />
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
    <Card accent="white" shadow="md" className={cn("p-0 overflow-hidden group", isSoft ? "soft-ui-out border-0" : "glass border-white/10")}>
      {/* Premium Header */}
      <div className={cn(
        "border-b p-5 flex items-center justify-between",
        isSoft ? "border-[var(--text-muted)]/10" : "bg-gradient-to-r from-transparent via-white/5 to-transparent border-white/10"
      )}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={cn("absolute inset-0 blur-lg animate-pulse", isSoft ? "bg-[var(--accent-cyan)]/30" : "bg-cyan-500 opacity-20")} />
            <Sparkles className="w-6 h-6 text-[var(--accent-cyan)] relative z-10" />
          </div>
          <div>
            <h3 className="font-black uppercase tracking-[0.2em] text-sm text-[var(--text-primary)]">Conviction Report</h3>
            <p className="text-[10px] text-[var(--accent-cyan)]/70 font-mono">ID: {summary.generatedAt.slice(-8)}</p>
          </div>
        </div>
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full",
          isSoft ? "soft-ui-in" : "glass border-white/5"
        )}>
          {getSentimentIcon()}
          <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">{summary.sentiment}</span>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Executive Summary Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className={cn("h-px flex-1", isSoft ? "bg-gradient-to-r from-transparent to-[var(--text-muted)]/10" : "bg-gradient-to-r from-transparent to-white/10")} />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Executive Summary</h4>
            <div className={cn("h-px flex-1", isSoft ? "bg-gradient-to-l from-transparent to-[var(--text-muted)]/10" : "bg-gradient-to-l from-transparent to-white/10")} />
          </div>
          <p className="text-sm text-[var(--text-primary)]/80 leading-relaxed font-light italic text-center px-4">
            &ldquo;{summary.overview}&rdquo;
          </p>
        </section>

        {/* Neural Consensus Matrix */}
        {consensus && (
          <section className={cn(
            "rounded-xl p-5 relative overflow-hidden",
            isSoft ? "soft-ui-in" : "glass border-amber-500/20"
          )}>
            <div className="absolute top-0 right-0 p-2">
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-[var(--accent-amber)] animate-pulse" />
                <div className="w-1 h-1 rounded-full bg-[var(--accent-amber)] animate-pulse delay-75" />
                <div className="w-1 h-1 rounded-full bg-[var(--accent-amber)] animate-pulse delay-150" />
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Radar className="w-4 h-4 text-[var(--accent-amber)]" />
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--accent-amber)]">Neural Consensus Matrix</h4>
              </div>
              <Badge variant="amber" className={isSoft ? "soft-ui-out border-0" : "bg-amber-500/10 border-amber-500/30 text-amber-400"}>
                {consensus.diversity_level || 'low'} Diversity
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Model Agreement</p>
                  <p className="text-2xl font-black text-[var(--text-primary)]">{agreement}%</p>
                </div>
                <Progress value={agreement} accent="amber" className="h-1.5" />
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Participating Oracles</p>
                <div className="flex flex-wrap gap-2">
                  {consensus.providers?.map((p) => (
                    <div key={p} className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded-md",
                      isSoft ? "soft-ui-out" : "glass border-white/5"
                    )}>
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)]" />
                      <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-tight">{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {consensus.main_divergence && (
              <div className={cn(
                "mt-6 pt-4",
                isSoft ? "border-t border-[var(--text-muted)]/10" : "border-t border-white/5"
              )}>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--accent-amber)]/60 mb-2">Divergence Signal</p>
                <div className={cn(
                  "p-3 border-l-2",
                  isSoft ? "soft-ui-out border-[var(--accent-amber)]/40" : "bg-amber-500/5 border-amber-500/40"
                )}>
                  <p className="text-xs text-[var(--accent-amber)] italic leading-relaxed font-mono">
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
              <Flame className="w-4 h-4 text-[var(--accent-cyan)]" />
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">High-Impact Signals</h4>
            </div>
            <div className="space-y-2">
              {summary.topTrends.slice(0, 3).map((trend, index) => (
                <div key={index} className={cn(
                  "flex items-start gap-3 p-3 rounded-lg group/item transition-colors",
                  isSoft ? "soft-ui-out" : "glass-cyan border-cyan-500/10 hover:bg-cyan-500/10"
                )}>
                  <span className={cn(
                    "text-[10px] font-black w-5 h-5 flex items-center justify-center rounded",
                    isSoft ? "bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]" : "text-cyan-400 bg-cyan-500/10"
                  )}>
                    0{index + 1}
                  </span>
                  <p className={cn(
                    "text-xs transition-colors",
                    isSoft ? "text-[var(--text-secondary)] group-hover/item:text-[var(--text-primary)]" : "text-white/80 group-hover/item:text-white"
                  )}>
                    {typeof trend === 'object' && 'title' in trend ? (trend.title as string) : String(trend)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Research Integrity */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--accent-emerald)]" />
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">Integrity Score</h4>
            </div>
            <div className={cn(
              "rounded-xl p-4 space-y-4",
              isSoft ? "soft-ui-out" : "glass border-emerald-500/10"
            )}>
              <div className="flex items-baseline justify-between">
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Confidence Index</p>
                <p className="text-xl font-black text-[var(--accent-emerald)]">{confidence}%</p>
              </div>
              <Progress value={confidence} accent="emerald" className="h-1.5" />

              {summary.validationResults && summary.validationResults.length > 0 && (
                <div className={cn(
                  "pt-4 space-y-2",
                  isSoft ? "border-t border-[var(--text-muted)]/10" : "border-t border-white/5"
                )}>
                  {summary.validationResults.slice(0, 3).map((log, i) => (
                    <div key={i} className={cn(
                      "flex gap-2 text-[10px] font-mono",
                      isSoft ? "text-[var(--text-muted)]" : "text-white/50"
                    )}>
                      <span className="text-[var(--accent-emerald)]/50">▶</span>
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
      <div className={cn(
        "px-6 py-4 flex items-center justify-between",
        isSoft ? "soft-ui-in rounded-none" : "bg-black/40 border-t border-white/5"
      )}>
        <div className={cn(
          "flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]",
          isSoft ? "text-[var(--text-muted)]" : "text-white/30"
        )}>
          <Clock className="w-3 h-3" />
          <span>Fulfillment: {formatDistanceToNow(new Date(summary.generatedAt), { addSuffix: true })}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse" />
          <span className={cn(
            "text-[10px] font-black uppercase",
            isSoft ? "text-[var(--text-muted)]" : "text-white/40"
          )}>Attested on EigenCompute</span>
        </div>
      </div>
    </Card>
  );
}
