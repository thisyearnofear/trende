'use client';

import { formatDistanceToNow } from 'date-fns';
import { TrendItem } from '@/lib/types';
import { ExternalLink, MessageCircle, Repeat, Heart, Eye, Radar } from 'lucide-react';

interface ContentCardProps {
  item: TrendItem;
  onClick?: () => void;
  animationDelayMs?: number;
}

const PLATFORM_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  twitter: { color: '#1DA1F2', icon: '𝕏', label: 'Twitter' },
  linkedin: { color: '#0A66C2', icon: 'in', label: 'LinkedIn' },
  facebook: { color: '#1877F2', icon: 'f', label: 'Facebook' },
  newsapi: { color: '#FF6B35', icon: '📰', label: 'News' },
  web: { color: '#6366F1', icon: '🌐', label: 'Web' },
};

export function ContentCard({ item, onClick, animationDelayMs = 0 }: ContentCardProps) {
  const config = PLATFORM_CONFIG[item.platform] || { color: '#6366F1', icon: '🌐', label: 'Web' };

  const formatNumber = (num?: number): string => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateStr: string): string => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  const handle = item.authorHandle ? item.authorHandle.replace(/^@/, '') : null;
  const relevance = Math.round((item.relevanceScore || 0) * 100);

  return (
    <article
      className="bg-slate-900/80 border border-slate-700 rounded-2xl p-4 hover:border-cyan-400/40 transition-all hover:shadow-lg hover:shadow-cyan-500/10 animate-fade-up"
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: config.color }}
          >
            {config.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="font-medium text-slate-100 truncate">{item.author}</h4>
              <span className="text-[10px] uppercase tracking-wide text-slate-400 px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800/80">
                {config.label}
              </span>
            </div>
            <p className="text-sm text-slate-500 truncate">{handle ? `@${handle}` : 'source profile'}</p>
          </div>
        </div>
        <span className="text-xs text-slate-500 shrink-0">{formatDate(item.timestamp)}</span>
      </div>

      <h3 className="font-semibold text-slate-100 mb-2 line-clamp-2">{item.title}</h3>
      <p className="text-sm text-slate-400 mb-4 line-clamp-3">{item.content}</p>

      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-slate-400">
        {item.metrics.likes !== undefined && (
          <span className="flex items-center gap-1">
            <Heart className="w-4 h-4" />
            {formatNumber(item.metrics.likes)}
          </span>
        )}
        {item.metrics.shares !== undefined && (
          <span className="flex items-center gap-1">
            <Repeat className="w-4 h-4" />
            {formatNumber(item.metrics.shares)}
          </span>
        )}
        {item.metrics.comments !== undefined && (
          <span className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            {formatNumber(item.metrics.comments)}
          </span>
        )}
        {item.metrics.views !== undefined && (
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {formatNumber(item.metrics.views)}
          </span>
        )}

        {item.relevanceScore !== undefined && (
          <div className="ml-auto flex items-center gap-2 text-xs text-cyan-300">
            <Radar className="w-3.5 h-3.5" />
            <span>{relevance}% relevance</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
        {onClick && (
          <button
            type="button"
            onClick={onClick}
            className="text-sm text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
            aria-label={`Open details for ${item.title}`}
          >
            Open details
          </button>
        )}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200"
        >
          <ExternalLink className="w-3 h-3" />
          View original
        </a>
      </div>
    </article>
  );
}
