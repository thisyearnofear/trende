'use client';

import { TrendSummary as TrendSummaryType } from '@/lib/types';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  Clock,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TrendSummaryProps {
  summary?: TrendSummaryType;
  isLoading?: boolean;
}

export function TrendSummary({ summary, isLoading }: TrendSummaryProps) {
  if (isLoading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 animate-pulse">
        <div className="h-6 w-48 bg-slate-700 rounded mb-4" />
        <div className="h-4 w-full bg-slate-700 rounded mb-2" />
        <div className="h-4 w-3/4 bg-slate-700 rounded mb-4" />
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-slate-700 rounded" />
          <div className="h-6 w-20 bg-slate-700 rounded" />
          <div className="h-6 w-20 bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const getSentimentIcon = () => {
    switch (summary.sentiment) {
      case 'positive':
        return <TrendingUp className="w-5 h-5 text-emerald-300" />;
      case 'negative':
        return <TrendingDown className="w-5 h-5 text-rose-300" />;
      default:
        return <Minus className="w-5 h-5 text-amber-300" />;
    }
  };

  const getSentimentColor = () => {
    switch (summary.sentiment) {
      case 'positive':
        return 'text-emerald-300';
      case 'negative':
        return 'text-rose-300';
      default:
        return 'text-amber-300';
    }
  };

  const confidence = Math.round((summary.confidenceScore || 0) * 100);

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/85 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-cyan-300" />
          <h3 className="font-semibold text-slate-100">Conviction Brief</h3>
        </div>
        <div className={`flex items-center gap-2 ${getSentimentColor()}`}>
          {getSentimentIcon()}
          <span className="text-sm font-medium capitalize">{summary.sentiment}</span>
        </div>
      </div>

      <p className="text-sm text-slate-300 mb-4 leading-relaxed">{summary.overview}</p>

      {summary.keyThemes.length > 0 && (
        <div className="mb-5">
          <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Dominant Themes</h4>
          <div className="flex flex-wrap gap-2">
            {summary.keyThemes.map((theme, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-cyan-500/15 text-cyan-200 rounded-full text-xs border border-cyan-500/25"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {summary.topTrends.length > 0 && (
        <div className="mb-5">
          <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">High-Impact Signals</h4>
          <div className="space-y-2">
            {summary.topTrends.slice(0, 3).map((trend, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-slate-800/80 rounded-xl border border-slate-700/70">
                <span className="w-6 h-6 bg-cyan-600 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                  {index + 1}
                </span>
                <p className="text-sm text-slate-200">
                  {typeof trend === 'object' && 'title' in trend
                    ? (trend.title as string)
                    : String(trend)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(summary.confidenceScore !== undefined || (summary.validationResults && summary.validationResults.length > 0)) && (
        <div className="mt-5 pt-5 border-t border-slate-700/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <h4 className="text-sm font-medium">Research Trust Score</h4>
            </div>
            <span className="text-sm font-semibold text-emerald-300">{confidence}%</span>
          </div>

          <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full ${
                confidence > 70 ? 'bg-emerald-500' : confidence > 40 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${confidence}%` }}
            />
          </div>

          {summary.validationResults && summary.validationResults.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Validation Notes</p>
              {summary.validationResults.slice(0, 4).map((log, i) => (
                <div key={i} className="text-xs text-slate-400 flex gap-2">
                  <Flame className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center gap-2 text-xs text-slate-500">
        <Clock className="w-3 h-3" />
        <span>
          Updated {formatDistanceToNow(new Date(summary.generatedAt), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
