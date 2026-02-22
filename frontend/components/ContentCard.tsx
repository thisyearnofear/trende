'use client';

import { formatDistanceToNow } from 'date-fns';
import { TrendItem } from '@/lib/types';
import { ExternalLink, MessageCircle, Repeat, Heart, Eye, Radar, ShieldCheck } from 'lucide-react';
import { useTheme } from './ThemeProvider';

import { Card } from './DesignSystem';

interface ContentCardProps {
  item: TrendItem;
  sourceIndex?: number;
  onClick?: () => void;
  animationDelayMs?: number;
}

const PLATFORM_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  twitter: { color: '#1DA1F2', icon: '𝕏', label: 'Twitter' },
  linkedin: { color: '#0A66C2', icon: 'in', label: 'LinkedIn' },
  facebook: { color: '#1877F2', icon: 'f', label: 'Facebook' },
  newsapi: { color: '#FF6B35', icon: '📰', label: 'News' },
  web: { color: '#6366F1', icon: '🌐', label: 'Web' },
  gdelt: { color: '#0EA5E9', icon: '🗞️', label: 'GDELT' },
  tiktok: { color: '#000000', icon: '🎵', label: 'TikTok' },
  coingecko: { color: '#65A30D', icon: 'CG', label: 'CoinGecko' },
  hackernews: { color: '#FF6600', icon: 'HN', label: 'Hacker News' },
  stackexchange: { color: '#1F7A8C', icon: 'SE', label: 'Stack Exchange' },
  tinyfish: { color: '#FF9F1C', icon: '🐠', label: 'TinyFish' },
};

export function ContentCard({ item, sourceIndex, onClick, animationDelayMs = 0 }: ContentCardProps) {
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
  const isVerified = item.isVerified || item.platform === 'gdelt' || item.platform === 'chainlink';

  return (
    <Card
      accent="white"
      shadow="sm"
      interactive={!!onClick}
      className="p-0 overflow-hidden glass border-white/10 group transition-all duration-300 hover:border-white/20 hover:bg-white/[0.05] animate-fade-up"
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      {/* Platform Tint Overlay */}
      <div
        className="absolute top-0 right-0 w-32 h-32 blur-[64px] opacity-10 pointer-events-none transition-opacity group-hover:opacity-20"
        style={{ backgroundColor: config.color }}
      />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 flex items-center justify-center text-lg font-bold transition-transform group-hover:scale-110"
              style={{
                backgroundColor: isSoft ? 'var(--soft-bg)' : `${config.color}22`,
                boxShadow: isSoft ? 'var(--soft-shadow-out)' : `0 0 20px ${config.color}33`,
                borderRadius: isSoft ? '10px' : '4px',
                color: config.color,
                border: `1px solid ${config.color}44`
              }}
            >
              {config.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="font-black uppercase tracking-widest text-[10px] text-white/90 truncate">{item.author}</h4>
                {sourceIndex !== undefined && (
                  <span
                    className="text-[9px] font-black px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    title={`Validation reference S${sourceIndex}`}
                  >
                    S{sourceIndex}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-mono text-white/40 truncate">{handle ? `@${handle}` : 'source profile'}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[10px] font-mono text-white/30 shrink-0">{formatDate(item.timestamp)}</span>
            {isVerified && (
              <div
                className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse-border"
                title="Verified by Chainlink Oracle"
              >
                <ShieldCheck className="w-2.5 h-2.5" />
                Verified
              </div>
            )}
          </div>
        </div>

        <h3 className="text-sm font-black uppercase tracking-wider text-white mb-2 line-clamp-2 leading-tight">
          {item.title}
        </h3>

        <p className="text-xs text-white/60 mb-5 line-clamp-3 leading-relaxed font-light">
          {item.content}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] font-mono text-white/40">
            {item.metrics.likes !== undefined && (
              <span className="flex items-center gap-1 group/stat hover:text-white transition-colors">
                <Heart className="w-3 h-3 group-hover/stat:fill-rose-500 group-hover/stat:text-rose-500" />
                {formatNumber(item.metrics.likes)}
              </span>
            )}
            {item.metrics.shares !== undefined && (
              <span className="flex items-center gap-1 group/stat hover:text-white transition-colors">
                <Repeat className="w-3 h-3 group-hover/stat:text-emerald-500" />
                {formatNumber(item.metrics.shares)}
              </span>
            )}
          </div>

          {item.relevanceScore !== undefined && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/5">
              <Radar className="w-3 h-3 text-cyan-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">{relevance}% relevancy</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white/[0.02] border-t border-white/5 p-3 flex items-center justify-between gap-2">
        {onClick && (
          <button
            type="button"
            onClick={onClick}
            className="flex-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest py-2 rounded bg-white/5 hover:bg-white/10 text-white transition-all border border-white/5 active:scale-95"
          >
            Detailed Intel
          </button>
        )}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest py-2 rounded text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Source
        </a>
      </div>
    </Card>
  );
}
