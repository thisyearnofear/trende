'use client';

import { useEffect, useMemo, useState } from 'react';
import { TrendSummary as TrendSummaryType } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, Clock, ShieldCheck, Flame, Sparkles, Radar, ExternalLink, AlertCircle, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, Badge, Progress, Alert } from './DesignSystem';
import { useTheme } from './ThemeProvider';

interface TrendSummaryProps {
  summary?: TrendSummaryType;
  sourceLabelByOrdinal?: Record<number, string>;
  isLoading?: boolean;
  dataHealth?: {
    level: 'healthy' | 'partial' | 'sparse' | 'unknown';
    message: string;
    findingsCount: number;
    warnings: string[];
  };
}

export function TrendSummary({ summary, sourceLabelByOrdinal = {}, isLoading, dataHealth }: TrendSummaryProps) {
  const { isSoft } = useTheme();
  void sourceLabelByOrdinal;
  const sentiment = summary?.sentiment || 'neutral';

  const getSentimentIcon = () => {
    switch (sentiment) {
      case 'positive': return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      case 'negative': return <TrendingDown className="w-5 h-5 text-rose-400" />;
      default: return <Minus className="w-5 h-5 text-amber-400" />;
    }
  };

  const confidence = Math.round((summary?.confidenceScore || 0) * 100);
  const consensus = summary?.consensusData;
  const agreement = Math.round((consensus?.agreement_score || 0) * 100);
  const financial = summary?.financialIntelligence;
  const assetRows = financial?.assets?.slice(0, 3) || [];
  const lpRows = financial?.lp_optimization || [];
  const hasDivergence = financial?.summary?.toLowerCase().includes('divergence');
  const hasArbitrage = financial?.summary?.toLowerCase().includes('arbitrage');
  const relatedMarkets = useMemo(() => summary?.relatedMarkets || [], [summary?.relatedMarkets]);
  const [highFitOnly, setHighFitOnly] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const rawPrefs = window.localStorage.getItem('trende:market_prefs');
      if (!rawPrefs) return false;
      const prefs = JSON.parse(rawPrefs) as { highFitOnly?: boolean };
      return Boolean(prefs.highFitOnly);
    } catch {
      return false;
    }
  });
  const [hideLowLiquidity, setHideLowLiquidity] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const rawPrefs = window.localStorage.getItem('trende:market_prefs');
      if (!rawPrefs) return true;
      const prefs = JSON.parse(rawPrefs) as { hideLowLiquidity?: boolean };
      return prefs.hideLowLiquidity === undefined ? true : Boolean(prefs.hideLowLiquidity);
    } catch {
      return true;
    }
  });
  const [minExpiryDays, setMinExpiryDays] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const rawPrefs = window.localStorage.getItem('trende:market_prefs');
      if (!rawPrefs) return 0;
      const prefs = JSON.parse(rawPrefs) as { minExpiryDays?: number };
      return Number.isFinite(prefs.minExpiryDays) ? Number(prefs.minExpiryDays) : 0;
    } catch {
      return 0;
    }
  });
  const [marketDisclaimerAccepted, setMarketDisclaimerAccepted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('trende:market_disclaimer_ack') === '1';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      'trende:market_prefs',
      JSON.stringify({ highFitOnly, hideLowLiquidity, minExpiryDays })
    );
  }, [highFitOnly, hideLowLiquidity, minExpiryDays]);

  const filteredMarkets = useMemo(() => {
    return relatedMarkets
      .filter((market) => (highFitOnly ? (market.fitLabel === 'high' || market.actionable) : true))
      .filter((market) => (hideLowLiquidity ? (market.liquidityScore ?? 100) >= 20 : true))
      .filter((market) =>
        minExpiryDays > 0 ? (market.daysToResolution == null ? false : market.daysToResolution >= minExpiryDays) : true
      )
      .slice(0, 5);
  }, [relatedMarkets, highFitOnly, hideLowLiquidity, minExpiryDays]);

  const readinessMarket = useMemo(() => {
    if (filteredMarkets.length === 0) return null;
    return [...filteredMarkets].sort(
      (a, b) => Number(b.fitScore || 0) - Number(a.fitScore || 0)
    )[0];
  }, [filteredMarkets]);

  const marketGating = summary?.marketSignals?.gating;

  const handleOpenMarket = (url: string, marketTitle: string, provider: string, fitScore?: number) => {
    if (typeof window === 'undefined') return;
    if (!marketDisclaimerAccepted) {
      const accepted = window.confirm(
        "External market links are informational only. Verify jurisdiction rules and do your own diligence before participating."
      );
      if (!accepted) return;
      window.localStorage.setItem('trende:market_disclaimer_ack', '1');
      setMarketDisclaimerAccepted(true);
    }
    try {
      const endpoint = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/telemetry/mission-event`;
      const payload = JSON.stringify({
        name: 'market_link_open',
        source: 'trend_summary',
        stage: 'results',
        payload: {
          url,
          title: marketTitle,
          provider,
          fitScore: fitScore ?? null,
        },
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }));
      } else {
        void fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });
      }
    } catch {
      // no-op
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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

  return (
    <Card accent="white" shadow="md" className={cn("p-0 overflow-hidden group", isSoft ? "soft-ui-out border-0" : "glass border-white/10")}>
      {/* Premium Header */}
      <div className={cn(
        "border-b p-4 sm:p-5 flex items-center justify-between gap-3",
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
          "flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full shrink-0",
          isSoft ? "soft-ui-in" : "glass border-white/5"
        )}>
          {getSentimentIcon()}
          <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)] whitespace-nowrap">{summary.sentiment}</span>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {dataHealth && dataHealth.level !== 'healthy' && (
          <Alert
            variant={dataHealth.level === 'sparse' ? 'warning' : 'info'}
            className={cn(
              isSoft ? 'soft-ui-out border-0' : 'border-white/10',
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-widest mb-1">
              {dataHealth.level === 'sparse' ? 'Limited Evidence Coverage' : 'Partial Evidence Coverage'}
            </p>
            <p className="text-xs leading-relaxed">{dataHealth.message}</p>
            <div className="mt-2 text-[10px] font-mono opacity-80">
              findings={dataHealth.findingsCount} {dataHealth.warnings.length > 0 ? `• alerts=${dataHealth.warnings.length}` : ''}
            </div>
          </Alert>
        )}

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
            "rounded-xl p-4 sm:p-5 relative overflow-hidden",
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Model Agreement</p>
                  <p className="text-2xl font-black text-[var(--text-primary)]">{agreement}%</p>
                </div>
                <Progress value={agreement} accent="amber" className="h-1.5" />
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Participating Oracles</p>
                <div className="flex flex-wrap gap-1 sm:gap-1.5">
                  {consensus.providers?.map((p) => (
                    <div key={p} className={cn(
                      "flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-[10px]",
                      isSoft ? "soft-ui-out" : "glass border-white/5"
                    )}>
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)]" />
                      <span className="uppercase font-bold text-[var(--text-secondary)] tracking-tight truncate">{p}</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* High Impact Signals */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[var(--accent-cyan)]" />
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">High-Impact Signals</h4>
            </div>
            <div className="space-y-2">
              {(summary.topTrends && summary.topTrends.length > 0
                ? summary.topTrends.slice(0, 3)
                : (summary.validationResults || []).slice(0, 3).map((log) => ({ title: log }))
              ).map((trend, index) => (
                <div key={index} className={cn(
                  "flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg group/item transition-colors",
                  isSoft ? "soft-ui-out" : "glass-cyan border-cyan-500/10 hover:bg-cyan-500/10"
                )}>
                  <span className={cn(
                    "text-[10px] font-black w-5 h-5 flex items-center justify-center rounded shrink-0",
                    isSoft ? "bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]" : "text-cyan-400 bg-cyan-500/10"
                  )}>
                    0{index + 1}
                  </span>
                  <p className={cn(
                    "text-[11px] sm:text-xs transition-colors leading-relaxed",
                    isSoft ? "text-[var(--text-secondary)] group-hover/item:text-[var(--text-primary)]" : "text-white/80 group-hover/item:text-white"
                  )}>
                    {typeof trend === 'object' && 'title' in trend ? (trend.title as string) : String(trend)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Research Integrity */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--accent-emerald)]" />
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">Integrity Score</h4>
            </div>
            <div className={cn(
              "rounded-xl p-3 sm:p-4 space-y-3 sm:space-y-4",
              isSoft ? "soft-ui-out" : "glass border-emerald-500/10"
            )}>
              <div className="flex items-baseline justify-between">
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Confidence Index</p>
                <p className="text-lg sm:text-xl font-black text-[var(--accent-emerald)]">{confidence}%</p>
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

        {financial && (
          <section className={cn(
            "rounded-xl p-4 sm:p-5 space-y-4",
            isSoft ? "soft-ui-in" : "glass border-cyan-500/15"
          )}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Radar className="w-4 h-4 text-[var(--accent-cyan)]" />
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">Financial Intelligence</h4>
                <Badge variant="emerald" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-black text-[9px] px-1.5 py-0.5 uppercase tracking-tighter">
                  Verifiable Alpha
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {hasDivergence && (
                  <Badge variant="rose" className={isSoft ? "soft-ui-out border-0" : "bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse"}>
                    <AlertCircle className="w-3 h-3 mr-1" /> Risk Divergence
                  </Badge>
                )}
                {hasArbitrage && (
                  <Badge variant="cyan" className={isSoft ? "soft-ui-out border-0" : "bg-cyan-500/20 border-cyan-500/40 text-cyan-200"}>
                    <Zap className="w-3 h-3 mr-1" /> Arbitrage Opportunity
                  </Badge>
                )}
                {financial.aggregate_metrics?.overall_risk && (
                  <Badge variant="amber" className={isSoft ? "soft-ui-out border-0" : "bg-amber-500/10 border-amber-500/30 text-amber-300"}>
                    Risk: {financial.aggregate_metrics.overall_risk}
                  </Badge>
                )}
              </div>
            </div>

            {financial.summary && (
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{financial.summary}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {assetRows.map((asset) => {
                const p50 = asset.forecast_7d?.p50 ?? asset.forecast_7d?.median;
                return (
                  <div key={asset.symbol} className={cn("rounded-lg p-3", isSoft ? "soft-ui-out" : "bg-slate-900/40 border border-white/5")}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">{asset.symbol}</p>
                    {typeof asset.current_price === "number" && (
                      <p className="text-xs text-[var(--text-primary)] font-mono">Now: ${asset.current_price.toLocaleString()}</p>
                    )}
                    {typeof p50 === "number" && (
                      <p className="text-xs text-[var(--accent-cyan)] font-mono">7d p50: ${p50.toLocaleString()}</p>
                    )}
                    {asset.risk_level && (
                      <p className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] mt-2">risk level {asset.risk_level}</p>
                    )}
                  </div>
                );
              })}

              {lpRows.slice(0, 3).map((lp, i) => (
                <div key={i} className={cn("rounded-lg p-3", isSoft ? "soft-ui-out" : "bg-emerald-900/20 border border-emerald-500/10")}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">LP Opt: {lp.pool}</p>
                    <Badge variant="emerald" className="text-[8px] h-3 px-1">Efficient</Badge>
                  </div>
                  <p className="text-xs text-emerald-100 font-mono">${lp.lower_bound?.toLocaleString()} - ${lp.upper_bound?.toLocaleString()}</p>
                  <p className="text-[9px] uppercase tracking-wider text-emerald-500/60 mt-2">confidence {Math.round((lp.probability_in_range || 0) * 100)}%</p>
                </div>
              ))}
            </div>
            
            <p className="text-[9px] font-mono text-[var(--text-muted)] flex items-center gap-1.5 opacity-50">
              <ShieldCheck className="w-2.5 h-2.5" />
              Verifiable Alpha powered by SynthData (Bittensor Subnet 50)
            </p>
          </section>
        )}

        {relatedMarkets.length > 0 && (
          <section className={cn(
            "rounded-xl p-5 space-y-4",
            isSoft ? "soft-ui-in" : "glass border-violet-500/20"
          )}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Radar className="w-4 h-4 text-[var(--accent-violet)]" />
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">Related Prediction Markets</h4>
              </div>
              <Badge variant="violet" className={isSoft ? "soft-ui-out border-0" : "bg-violet-500/10 border-violet-500/30 text-violet-300"}>
                Beta
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <label className="text-[10px] font-mono flex items-center gap-1.5 sm:gap-2">
                <input type="checkbox" checked={highFitOnly} onChange={(e) => setHighFitOnly(e.target.checked)} className="shrink-0" />
                <span className="whitespace-nowrap">Show only high-fit</span>
              </label>
              <label className="text-[10px] font-mono flex items-center gap-1.5 sm:gap-2">
                <input type="checkbox" checked={hideLowLiquidity} onChange={(e) => setHideLowLiquidity(e.target.checked)} className="shrink-0" />
                <span className="whitespace-nowrap">Hide low-liquidity</span>
              </label>
              <label className="text-[10px] font-mono flex items-center gap-1.5 sm:gap-2">
                <span className="whitespace-nowrap">Min expiry</span>
                <select
                  value={minExpiryDays}
                  onChange={(e) => setMinExpiryDays(Number(e.target.value))}
                  className={cn("bg-transparent border rounded px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px]", isSoft ? "border-[var(--text-muted)]/20" : "border-white/20")}
                >
                  <option value={0}>Any</option>
                  <option value={1}>1d+</option>
                  <option value={7}>7d+</option>
                  <option value={30}>30d+</option>
                </select>
              </label>
            </div>
            {marketGating && (
              <div className={cn("text-[10px] font-mono p-2 rounded", isSoft ? "soft-ui-out" : "bg-white/5 border border-white/10")}>
                {marketGating.actionable ? "Actionable market suggestions enabled." : "Exploratory only: run quality gate is not fully met."}
                <span className="ml-2 opacity-80">
                  suff={marketGating.dataSufficiency} • findings={marketGating.findingsCount} • agreement={Math.round((marketGating.agreementScore || 0) * 100)}%
                </span>
              </div>
            )}
            {readinessMarket && (
              <div className={cn("rounded-lg p-3 space-y-1", isSoft ? "soft-ui-out" : "bg-violet-500/10 border border-violet-500/20")}>
                <p className="text-[10px] uppercase tracking-widest font-black text-[var(--accent-violet)]">Market Readiness</p>
                <p className="text-xs text-[var(--text-primary)]">{readinessMarket.title}</p>
                <p className="text-[10px] font-mono text-[var(--text-muted)]">
                  fit {readinessMarket.fitScore ?? 0}% ({readinessMarket.fitLabel || 'weak'}) • liquidity {readinessMarket.liquidityScore ?? 0}% • edge {readinessMarket.edgeDelta ?? 0}pp
                </p>
                {(readinessMarket.disconfirmers || []).length > 0 && (
                  <p className="text-[10px] font-mono text-[var(--text-muted)]">
                    Risks: {(readinessMarket.disconfirmers || []).join(' | ')}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              {filteredMarkets.map((market, index) => (
                <div key={`${market.url}-${index}`} className={cn("rounded-lg p-2.5 sm:p-3 space-y-2", isSoft ? "soft-ui-out" : "bg-slate-900/60 border border-white/5")}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs text-[var(--text-primary)] leading-relaxed">{market.title}</p>
                    <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] shrink-0">{market.provider}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[10px] font-mono">
                    {typeof market.fitScore === "number" && (
                      <span className={cn("px-1.5 sm:px-2 py-0.5 rounded", market.fitLabel === 'high' ? "bg-emerald-500/15 text-emerald-300" : market.fitLabel === 'medium' ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300")}>
                        Fit {market.fitScore}%
                      </span>
                    )}
                    {typeof market.probability === "number" && (
                      <span className={cn("px-1.5 sm:px-2 py-0.5 rounded", isSoft ? "bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]" : "bg-cyan-500/10 text-cyan-300")}>
                        {(market.probability * 100).toFixed(1)}%
                      </span>
                    )}
                    {typeof market.volume === "number" && (
                      <span className={cn("px-1.5 sm:px-2 py-0.5 rounded", isSoft ? "bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]" : "bg-amber-500/10 text-amber-300")}>
                        Vol ${market.volume.toLocaleString()}
                      </span>
                    )}
                    {typeof market.daysToResolution === "number" && (
                      <span className={cn("px-1.5 sm:px-2 py-0.5 rounded", isSoft ? "bg-[var(--accent-violet)]/10 text-[var(--accent-violet)]" : "bg-violet-500/10 text-violet-300")}>
                        {market.daysToResolution.toFixed(1)}d
                      </span>
                    )}
                  </div>
                  {market.relevanceReason && (
                    <p className="text-[10px] text-[var(--text-muted)] font-mono line-clamp-2">{market.relevanceReason}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenMarket(market.url, market.title, market.provider, market.fitScore)}
                    className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-black text-[var(--accent-violet)] hover:opacity-80"
                  >
                    Open Market
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            {filteredMarkets.length === 0 && (
              <p className="text-[10px] font-mono text-[var(--text-muted)]">No markets match current filters.</p>
            )}
          </section>
        )}
      </div>

      {/* Footer Meta */}
      <div className={cn(
        "px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0",
        isSoft ? "soft-ui-in rounded-none" : "bg-black/40 border-t border-white/5"
      )}>
        <div className={cn(
          "flex items-center gap-2 text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em]",
          isSoft ? "text-[var(--text-muted)]" : "text-white/30"
        )}>
          <Clock className="w-3 h-3 shrink-0" />
          <span className="truncate">Fulfillment: {formatDistanceToNow(new Date(summary.generatedAt), { addSuffix: true })}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-pulse" />
          <span className={cn(
            "text-[9px] sm:text-[10px] font-black uppercase whitespace-nowrap",
            isSoft ? "text-[var(--text-muted)]" : "text-white/40"
          )}>Attested on EigenCompute</span>
        </div>
      </div>
    </Card>
  );
}
