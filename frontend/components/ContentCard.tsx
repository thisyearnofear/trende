'use client';

import { formatDistanceToNow } from 'date-fns';
import { TrendItem } from '@/lib/types';
import { ExternalLink, MessageCircle, Repeat, Heart, Eye, Radar } from 'lucide-react';
import { useTheme } from './ThemeProvider';

import { Card } from './DesignSystem';

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
  const { isSoft } = useTheme();

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
    <Card
      accent="white"
      shadow="sm"
      interactive={!!onClick}
      className="p-4 animate-fade-up"
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 flex items-center justify-center text-sm font-bold text-[var(--bg-primary)]"
            style={{ 
              backgroundColor: isSoft ? 'transparent' : config.color,
              boxShadow: isSoft ? 'var(--soft-shadow-out)' : 'none',
              borderRadius: isSoft ? '10px' : '0',
              color: isSoft ? config.color : 'var(--bg-primary)'
            }}
          >
            {config.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="font-black uppercase tracking-wider text-[var(--text-primary)] truncate">{item.author}</h4>
              <span
                className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border-2"
                style={{ 
                  color: 'var(--text-muted)', 
                  borderColor: isSoft ? 'transparent' : 'var(--border-color)', 
                  backgroundColor: 'var(--bg-tertiary)',
                  boxShadow: isSoft ? 'var(--soft-shadow-out)' : 'none',
                  borderRadius: isSoft ? '4px' : '0'
                }}
              >
                {config.label}
              </span>
            </div>
            <p className="text-sm text-[var(--text-muted)] truncate">{handle ? `@${handle}` : 'source profile'}</p>
          </div>
        </div>
        <span className="text-xs text-[var(--text-muted)] shrink-0">{formatDate(item.timestamp)}</span>
      </div>

      <h3 className="font-black uppercase tracking-wider text-[var(--text-primary)] mb-2 line-clamp-2">{item.title}</h3>
      <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-3">{item.content}</p>

      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--text-secondary)]">
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
          <div className="ml-auto flex items-center gap-2 text-xs" style={{ color: 'var(--accent-cyan)' }}>
            <Radar className="w-3.5 h-3.5" />
            <span className="font-black uppercase tracking-wider">{relevance}% relevance</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t-2 border-[var(--border-color)] flex items-center justify-between gap-2" style={{ borderTopWidth: isSoft ? '0' : '2px' }}>
        {onClick && (
          <button
            type="button"
            onClick={onClick}
            className={`text-sm font-black uppercase tracking-wider bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-4 py-2.5 transition-all min-h-[44px] flex-1 sm:flex-none flex items-center justify-center border-2 border-[var(--border-color)] ${isSoft ? 'soft-ui-button border-0' : ''}`}
            style={{ boxShadow: isSoft ? 'var(--soft-shadow-out)' : '2px 2px 0px 0px var(--shadow-color)' }}
            aria-label={`Open details for ${item.title}`}
          >
            Open details
          </button>
        )}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-sm font-black uppercase tracking-wider min-h-[44px] px-3 flex-1 sm:flex-none"
          style={{ color: 'var(--accent-cyan)' }}
        >
          <ExternalLink className="w-4 h-4" />
          <span className="sm:inline">View original</span>
        </a>
      </div>
    </Card>
  );
}
