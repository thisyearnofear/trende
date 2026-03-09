'use client';

import { formatDistanceToNow } from 'date-fns';
import { TrendItem } from '@/lib/types';
import { ExternalLink, MessageCircle, Repeat, Heart, Eye, Radar, ShieldCheck } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { cn } from '@/lib/utils';

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
      className={cn(
        "p-0 overflow-hidden group transition-all duration-300 animate-fade-up",
        isSoft ? "soft-ui-out border-0" : "glass border-white/10 hover:border-white/20 hover:bg-white/[0.05]"
      )}
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
                <h4 className={cn(
                  "font-black uppercase tracking-widest text-[10px] truncate",
                  isSoft ? "text-[var(--text-primary)]" : "text-white/90"
                )}>{item.author}</h4>
                {sourceIndex !== undefined && (
                  <span
                    className={cn(
                      "text-[9px] font-black px-1.5 py-0.5 rounded border",
                      isSoft ? "bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border-[var(--accent-cyan)]/20" : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                    )}
                    title={`Validation reference S${sourceIndex}`}
                  >
                    S{sourceIndex}
                  </span>
                )}
              </div>
              <p className={cn(
                "text-[10px] font-mono truncate",
                isSoft ? "text-[var(--text-muted)]" : "text-white/40"
              )}>{handle ? `@${handle}` : 'source profile'}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className={cn(
              "text-[10px] font-mono shrink-0",
              isSoft ? "text-[var(--text-muted)]" : "text-white/30"
            )}>{formatDate(item.timestamp)}</span>
            {isVerified && (
              <div
                className={cn(
                  "flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border animate-pulse-border",
                  isSoft ? "bg-[var(--accent-emerald)]/10 text-[var(--accent-emerald)] border-[var(--accent-emerald)]/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                )}
                title="Verified through Trende's proof stack"
              >
                <ShieldCheck className="w-2.5 h-2.5" />
                Verified
              </div>
            )}
          </div>
        </div>

        <h3 className={cn(
          "text-sm font-black uppercase tracking-wider mb-2 line-clamp-2 leading-tight",
          isSoft ? "text-[var(--text-primary)]" : "text-white"
        )}>
          {item.title}
        </h3>

        <p className={cn(
          "text-xs mb-5 line-clamp-3 leading-relaxed font-light",
          isSoft ? "text-[var(--text-secondary)]" : "text-white/60"
        )}>
          {item.content}
        </p>

        <div className="flex items-center justify-between">
          <div className={cn(
            "flex items-center gap-4 text-[10px] font-mono",
            isSoft ? "text-[var(--text-muted)]" : "text-white/40"
          )}>
            {item.metrics.likes !== undefined && (
              <span className={cn(
                "flex items-center gap-1 group/stat transition-colors",
                isSoft ? "hover:text-[var(--text-primary)]" : "hover:text-white"
              )}>
                <Heart className="w-3 h-3 group-hover/stat:fill-rose-500 group-hover/stat:text-rose-500" />
                {formatNumber(item.metrics.likes)}
              </span>
            )}
            {item.metrics.shares !== undefined && (
              <span className={cn(
                "flex items-center gap-1 group/stat transition-colors",
                isSoft ? "hover:text-[var(--text-primary)]" : "hover:text-white"
              )}>
                <Repeat className="w-3 h-3 group-hover/stat:text-emerald-500" />
                {formatNumber(item.metrics.shares)}
              </span>
            )}
          </div>

          {item.relevanceScore !== undefined && (
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded border",
              isSoft ? "soft-ui-in border-0" : "bg-white/5 border-white/5"
            )}>
              <Radar className="w-3 h-3 text-[var(--accent-cyan)]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--accent-cyan)]">{relevance}% relevancy</span>
            </div>
          )}
        </div>
      </div>

      <div className={cn(
        "border-t p-3 flex items-center justify-between gap-2",
        isSoft ? "bg-black/5 border-[var(--text-muted)]/10" : "bg-white/[0.02] border-white/5"
      )}>
        {onClick && (
          <button
            type="button"
            onClick={onClick}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest py-2 rounded transition-all border active:scale-95",
              isSoft ? "soft-ui-button border-0 text-[var(--text-primary)]" : "bg-white/5 hover:bg-white/10 text-white border-white/5"
            )}
          >
            Detailed Intel
          </button>
        )}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest py-2 rounded transition-colors",
            isSoft ? "text-[var(--accent-cyan)] hover:text-[var(--accent-cyan)]/80" : "text-cyan-400 hover:text-cyan-300"
          )}
        >
          <ExternalLink className="w-3 h-3" />
          Source
        </a>
      </div>
    </Card>
  );
}
