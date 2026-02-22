'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TrendResult, TrendItem } from '@/lib/types';
import { ContentCard } from './ContentCard';
import { ArrowUpRight } from 'lucide-react';
import { Card } from './DesignSystem';
import { useTheme } from './ThemeProvider';

interface PlatformTabsProps {
  results: TrendResult[];
  isLoading?: boolean;
  sourceIndexById?: Record<string, number>;
}

const PLATFORM_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  twitter: { icon: '𝕏', color: '#1DA1F2', label: 'Twitter' },
  linkedin: { icon: 'in', color: '#0A66C2', label: 'LinkedIn' },
  facebook: { icon: 'f', color: '#1877F2', label: 'Facebook' },
  newsapi: { icon: '📰', color: '#FF6B35', label: 'News' },
  web: { icon: '🌐', color: '#6366F1', label: 'Web' },
  gdelt: { icon: '🗞️', color: '#0EA5E9', label: 'GDELT' },
  tiktok: { icon: '🎵', color: '#000000', label: 'TikTok' },
};

export function PlatformTabs({ results, isLoading, sourceIndexById = {} }: PlatformTabsProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<TrendItem | null>(null);
  const { isSoft } = useTheme();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const platformData = useMemo(() => {
    const data: Record<string, TrendItem[]> = {};
    let totalCount = 0;

    results.forEach((result) => {
      if (!data[result.platform]) {
        data[result.platform] = [];
      }
      data[result.platform].push(...result.items);
      totalCount += result.items.length;
    });

    return { data, totalCount };
  }, [results]);

  const activeItems = useMemo(() => {
    const items = activeTab === 'all'
      ? Object.values(platformData.data).flat()
      : platformData.data[activeTab] || [];

    return [...items].sort((a, b) => {
      const scoreA = a.relevanceScore || 0;
      const scoreB = b.relevanceScore || 0;
      return scoreB - scoreA;
    });
  }, [activeTab, platformData]);

  const gridClassName = useMemo(() => {
    return 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';
  }, []);

  const stats = useMemo(() => {
    const items = activeItems;
    if (items.length === 0) return null;

    const avgRelevance = items.reduce((acc, item) => acc + (item.relevanceScore || 0), 0) / items.length;
    const totalEngagement = items.reduce((acc, item) =>
      acc + (item.metrics.likes || 0) + (item.metrics.shares || 0), 0);

    return {
      avgRelevance: Math.round(avgRelevance * 100),
      totalEngagement,
    };
  }, [activeItems]);

  const tabs = [
    { id: 'all', label: 'All Sources', count: platformData.totalCount },
    ...Object.entries(platformData.data).map(([platform, items]) => ({
      id: platform,
      label: PLATFORM_CONFIG[platform]?.label || platform,
      count: items.length,
    })),
  ];

  useEffect(() => {
    if (!selectedItem) return undefined;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedItem(null);
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [selectedItem]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length;
    setActiveTab(tabs[nextIndex].id);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-20 bg-[var(--bg-tertiary)] animate-pulse" />
          ))}
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-[var(--bg-tertiary)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card accent="white" shadow="sm" className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">Signal Feed</h3>
          {stats && (
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider font-black">
              <span style={{ color: 'var(--accent-cyan)' }}>{stats.avgRelevance}% Relevance</span>
              <span className="text-[var(--text-muted)] hidden sm:inline">•</span>
              <span className="hidden sm:inline" style={{ color: 'var(--accent-emerald)' }}>{stats.totalEngagement.toLocaleString()} Engagement</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory" role="tablist" aria-label="Result platforms">
          {tabs.map((tab) => {
            const tabIndex = tabs.findIndex((candidate) => candidate.id === tab.id);
            const config = tab.id === 'all' ? null : PLATFORM_CONFIG[tab.id];
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tabIndex)}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                className={`px-4 py-2.5 text-sm font-black uppercase whitespace-nowrap transition-all border-2 snap-start min-h-[44px] flex items-center justify-center ${isActive
                    ? (isSoft ? 'border-transparent' : 'text-[var(--bg-primary)] border-transparent')
                    : (isSoft ? 'soft-ui-button border-0 opacity-60' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] border-[var(--border-color)]')
                  }`}
                style={
                  isActive
                    ? {
                      backgroundColor: isSoft ? 'var(--soft-bg)' : (config?.color || 'var(--accent-cyan)'),
                      boxShadow: isSoft ? 'var(--soft-shadow-in)' : 'none',
                      borderRadius: isSoft ? '12px' : '0',
                      color: isSoft ? (config?.color || 'var(--accent-cyan)') : 'var(--bg-primary)'
                    }
                    : {
                      borderRadius: isSoft ? '12px' : '0'
                    }
                }
              >
                {tab.id === 'all' ? (
                  tab.label
                ) : (
                  <span className="flex items-center gap-2">
                    <span>{config?.icon}</span>
                    <span>{tab.label}</span>
                  </span>
                )}
                <span className="ml-2 text-xs opacity-80">({tab.count})</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className={gridClassName}
      >
        {activeItems.length === 0 ? (
          <Card accent="white" className="text-center py-12 text-[var(--text-muted)]">
            No results found. Try another source combination.
          </Card>
        ) : (
          activeItems.map((item, index) => (
            <ContentCard
              key={item.id}
              item={item}
              sourceIndex={sourceIndexById[item.id]}
              onClick={() => setSelectedItem(item)}
              animationDelayMs={index * 35}
            />
          ))
        )}
      </div>

      {selectedItem && (
        <div
          className="fixed inset-0 bg-[var(--bg-primary)]/80 animate-overlay flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className={cn(
              "bg-[var(--bg-secondary)] w-full max-w-3xl max-h-[88vh] sm:max-h-[84vh] overflow-y-auto p-5 sm:p-6 animate-scale-in",
              isSoft ? "soft-ui-out border-0" : "border-2 border-[var(--border-color)]"
            )}
            style={{ boxShadow: isSoft ? 'var(--soft-shadow-out)' : '8px 8px 0px 0px var(--shadow-color)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="content-modal-title"
            aria-describedby="content-modal-body"
            ref={dialogRef}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    "w-10 h-10 flex items-center justify-center text-lg font-bold shrink-0",
                    isSoft ? "soft-ui-out" : "text-[var(--bg-primary)]"
                  )}
                  style={{
                    backgroundColor: isSoft ? 'transparent' : (PLATFORM_CONFIG[selectedItem.platform]?.color || 'var(--accent-violet)'),
                    color: isSoft ? (PLATFORM_CONFIG[selectedItem.platform]?.color || 'var(--accent-violet)') : 'var(--bg-primary)'
                  }}
                >
                  {PLATFORM_CONFIG[selectedItem.platform]?.icon || '🌐'}
                </span>
                <div className="min-w-0">
                  <h3 className="font-black uppercase tracking-wider text-[var(--text-primary)] break-words line-clamp-1">{selectedItem.author}</h3>
                  <p className="text-sm text-[var(--text-muted)] break-all line-clamp-1">{selectedItem.authorHandle}</p>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                onClick={() => setSelectedItem(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] min-h-[44px] min-w-[44px] flex items-center justify-center -mt-2 -mr-2 transition-colors"
                aria-label="Close detail view"
              >
                ✕
              </button>
            </div>

            <h2 id="content-modal-title" className="text-xl font-black uppercase tracking-wider text-[var(--text-primary)] mb-3 break-words">
              {selectedItem.title}
            </h2>
            <p id="content-modal-body" className="text-[var(--text-secondary)] whitespace-pre-wrap mb-4">
              {selectedItem.content}
            </p>

            <a
              href={selectedItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-[var(--accent-cyan)] hover:text-[var(--accent-cyan)]/80 min-h-[44px] w-full sm:w-auto font-black uppercase tracking-wider transition-colors"
            >
              View original <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
