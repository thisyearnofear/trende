'use client';

import { TrendSummary as TrendSummaryType } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, Lightbulb, Clock, ShieldCheck, Flame, Sparkles } from 'lucide-react';
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
      <Card accent="cyan" className="p-6 animate-pulse">
        <div className="h-6 w-48 bg-[var(--bg-tertiary)] mb-4" />
        <div className="h-4 w-full bg-[var(--bg-tertiary)] mb-2" />
        <div className="h-4 w-3/4 bg-[var(--bg-tertiary)] mb-4" />
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-[var(--bg-tertiary)]" />
          <div className="h-6 w-20 bg-[var(--bg-tertiary)]" />
          <div className="h-6 w-20 bg-[var(--bg-tertiary)]" />
        </div>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  const getSentimentIcon = () => {
    switch (summary.sentiment) {
      case 'positive': return <TrendingUp className="w-5 h-5" style={{ color: 'var(--accent-emerald)' }} />;
      case 'negative': return <TrendingDown className="w-5 h-5" style={{ color: 'var(--accent-rose)' }} />;
      default: return <Minus className="w-5 h-5" style={{ color: 'var(--accent-amber)' }} />;
    }
  };

  const getSentimentColor = () => {
    switch (summary.sentiment) {
      case 'positive': return 'var(--accent-emerald)';
      case 'negative': return 'var(--accent-rose)';
      default: return 'var(--accent-amber)';
    }
  };

  const confidence = Math.round((summary.confidenceScore || 0) * 100);
  const consensus = summary.consensusData;
  const renderedValidationNotes = (summary.validationResults || []).slice(0, 4).map((log) =>
    log.replace(/source\s+(\d+)/i, (_, rawIndex) => {
      const idx = Number(rawIndex);
      const label = sourceLabelByOrdinal[idx] || `S${idx + 1}`;
      return `Source ${label}`;
    }),
  );

  return (
    <Card accent="white" shadow="md" className="p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5" style={{ color: 'var(--accent-cyan)' }} />
          <h3 className="font-black uppercase tracking-wider">Conviction Brief</h3>
        </div>
        <div className="flex items-center gap-2" style={{ color: getSentimentColor() }}>
          {getSentimentIcon()}
          <span className="text-sm font-black uppercase tracking-wider capitalize">{summary.sentiment}</span>
        </div>
      </div>

      {/* Overview */}
      <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">{summary.overview}</p>

      {/* Key Themes */}
      {summary.keyThemes.length > 0 && (
        <div className="mb-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">Dominant Themes</h4>
          <div className="flex flex-wrap gap-2">
            {summary.keyThemes.map((theme, index) => (
              <Badge key={index} variant="cyan">{theme}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Top Trends */}
      {summary.topTrends.length > 0 && (
        <div className="mb-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-2">High-Impact Signals</h4>
          <div className="space-y-2">
            {summary.topTrends.slice(0, 3).map((trend, index) => (
              <Card key={index} accent="cyan" shadow="sm" className="flex items-start gap-3 p-3">
                <span className="w-6 h-6 bg-[var(--accent-cyan)] flex items-center justify-center text-[11px] font-bold text-[var(--bg-primary)] shrink-0">
                  {index + 1}
                </span>
                <p className="text-sm">
                  {typeof trend === 'object' && 'title' in trend ? (trend.title as string) : String(trend)}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Confidence Score */}
      {(summary.confidenceScore !== undefined || (summary.validationResults && summary.validationResults.length > 0)) && (
        <div className="mt-5 pt-5 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" style={{ color: 'var(--accent-emerald)' }} />
              <h4 className="text-sm font-black uppercase tracking-wider">Research Trust Score</h4>
            </div>
            <span className="text-sm font-black" style={{ color: 'var(--accent-emerald)' }}>{confidence}%</span>
          </div>
          <Progress value={confidence} accent={confidence > 70 ? 'emerald' : confidence > 40 ? 'amber' : 'rose'} className="mb-3" />
          {summary.validationResults && summary.validationResults.length > 0 && (
            <div className="space-y-1.5">
              <p className={`text-[10px] font-black uppercase tracking-wider ${isSoft ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>Validation Notes</p>
              {renderedValidationNotes.map((log, i) => (
                <div key={i} className="text-xs flex gap-2 text-[var(--text-secondary)]">
                  <Flame className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--accent-cyan)' }} />
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timestamp */}
      <div className="mt-4 pt-4 border-t flex items-center gap-2 text-xs text-[var(--text-muted)]" style={{ borderColor: 'var(--border-color)' }}>
        <Clock className="w-3 h-3" />
        <span>Updated {formatDistanceToNow(new Date(summary.generatedAt), { addSuffix: true })}</span>
      </div>

      {/* Consensus */}
      {consensus && (
        <Alert variant="warning" className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-amber)' }} />
            <h4 className="text-sm font-black uppercase tracking-wider" style={{ color: 'var(--accent-amber)' }}>Bias Mitigation Matrix</h4>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <p className={`text-[10px] font-black uppercase tracking-wider ${isSoft ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>Model Agreement</p>
              <p className="text-lg font-black" style={{ color: 'var(--accent-amber)' }}>{Math.round((consensus.agreement_score || 0) * 100)}%</p>
            </div>
            <div className="space-y-1 text-right">
              <p className={`text-[10px] font-black uppercase tracking-wider ${isSoft ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>Diversity Index</p>
              <p className="text-lg font-black" style={{ color: 'var(--accent-cyan)' }}>{consensus.diversity_level || 'low'}</p>
            </div>
          </div>
          {consensus.providers && consensus.providers.length > 0 && (
            <div className="space-y-2">
              <p className={`text-[10px] font-black uppercase tracking-wider ${isSoft ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>Consensus Providers</p>
              <div className="flex flex-wrap gap-1.5">
                {consensus.providers.map((p) => (
                  <Badge key={p} variant={isSoft ? "violet" : "amber"}>{p}</Badge>
                ))}
              </div>
            </div>
          )}
          {consensus.main_divergence && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--accent-amber)' }}>
              <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${isSoft ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>Divergence Signal</p>
              <p className="text-xs italic text-[var(--text-secondary)]">&ldquo;{consensus.main_divergence}&rdquo;</p>
            </div>
          )}
        </Alert>
      )}
    </Card>
  );
}
