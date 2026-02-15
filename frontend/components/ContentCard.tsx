'use client';

import { formatDistanceToNow } from 'date-fns';
import { TrendItem } from '@/lib/types';
import { ExternalLink, MessageCircle, Repeat, Heart, Eye } from 'lucide-react';

interface ContentCardProps {
  item: TrendItem;
  onClick?: () => void;
}

const PLATFORM_CONFIG: Record<string, { color: string; icon: string }> = {
  twitter: { color: '#1DA1F2', icon: '𝕏' },
  linkedin: { color: '#0A66C2', icon: 'in' },
  facebook: { color: '#1877F2', icon: 'f' },
  newsapi: { color: '#FF6B35', icon: '📰' },
  web: { color: '#6366F1', icon: '🌐' },
};

export function ContentCard({ item, onClick }: ContentCardProps) {
  const config = PLATFORM_CONFIG[item.platform] || { color: '#6366F1', icon: '🌐' };

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

  return (
    <article className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-cyan-500/10">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: config.color }}
          >
            {config.icon}
          </div>
          <div>
            <h4 className="font-medium text-slate-100">{item.author}</h4>
            <p className="text-sm text-slate-500">
              {item.authorHandle && `@${item.authorHandle}`}
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-500">{formatDate(item.timestamp)}</span>
      </div>

      {/* Content */}
      <h3 className="font-semibold text-slate-100 mb-2 line-clamp-2">
        {item.title}
      </h3>
      <p className="text-sm text-slate-400 mb-3 line-clamp-3">
        {item.content}
      </p>

      {/* Metrics */}
      <div className="flex items-center gap-4 text-sm text-slate-500">
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
        
        {/* Relevance Score */}
        {item.relevanceScore !== undefined && (
          <div className="ml-auto flex items-center gap-1">
            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${item.relevanceScore * 100}%` }}
              />
            </div>
            <span className="text-xs">{Math.round(item.relevanceScore * 100)}%</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
        {onClick && (
          <button
            type="button"
            onClick={onClick}
            className="text-sm text-slate-200 hover:text-white bg-slate-700/60 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
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
