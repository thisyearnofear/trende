'use client';

import { TrendSummary as TrendSummaryType } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, Lightbulb, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TrendSummaryProps {
  summary?: TrendSummaryType;
  isLoading?: boolean;
}

export function TrendSummary({ summary, isLoading }: TrendSummaryProps) {
  if (isLoading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 animate-pulse">
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
        return <TrendingUp className="w-5 h-5 text-green-400" />;
      case 'negative':
        return <TrendingDown className="w-5 h-5 text-red-400" />;
      default:
        return <Minus className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getSentimentColor = () => {
    switch (summary.sentiment) {
      case 'positive':
        return 'text-green-400';
      case 'negative':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-cyan-300" />
          <h3 className="font-semibold text-slate-100">AI Analysis</h3>
        </div>
        <div className={`flex items-center gap-2 ${getSentimentColor()}`}>
          {getSentimentIcon()}
          <span className="text-sm font-medium capitalize">{summary.sentiment}</span>
        </div>
      </div>

      {/* Overview */}
      <p className="text-slate-300 mb-4">{summary.overview}</p>

      {/* Key Themes */}
      {summary.keyThemes.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Key Themes</h4>
          <div className="flex flex-wrap gap-2">
            {summary.keyThemes.map((theme, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-cyan-500/20 text-cyan-200 rounded-full text-sm border border-cyan-500/25"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top Trends */}
      {summary.topTrends.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Top Trends</h4>
          <div className="space-y-2">
            {summary.topTrends.map((trend, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-slate-700/30 rounded-lg"
              >
                <span className="w-6 h-6 bg-cyan-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm text-slate-200">
                    {typeof trend === 'object' && 'title' in trend
                      ? (trend.title as string)
                      : String(trend)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trust & Validation */}
      {(summary.confidenceScore !== undefined || (summary.validationResults && summary.validationResults.length > 0)) && (
        <div className="mt-6 pt-6 border-t border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-slate-400">Research Trust Score</h4>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${(summary.confidenceScore || 0) > 0.7 ? 'bg-green-500' :
                      (summary.confidenceScore || 0) > 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                  style={{ width: `${(summary.confidenceScore || 0) * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono text-slate-300">
                {Math.round((summary.confidenceScore || 0) * 100)}%
              </span>
            </div>
          </div>

          {summary.validationResults && summary.validationResults.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Validation Logs</p>
              {summary.validationResults.map((log, i) => (
                <div key={i} className="text-xs text-slate-400 flex gap-2">
                  <span className="text-cyan-500">▹</span>
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generated Time */}
      <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center gap-2 text-xs text-slate-500">
        <Clock className="w-3 h-3" />
        <span>
          Generated {formatDistanceToNow(new Date(summary.generatedAt), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
