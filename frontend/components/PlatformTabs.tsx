'use client';

import { useState, useMemo } from 'react';
import { TrendResult, TrendItem } from '@/lib/types';
import { ContentCard } from './ContentCard';

interface PlatformTabsProps {
  results: TrendResult[];
  isLoading?: boolean;
}

const PLATFORM_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  twitter: { icon: '𝕏', color: '#1DA1F2', label: 'Twitter' },
  linkedin: { icon: 'in', color: '#0A66C2', label: 'LinkedIn' },
  facebook: { icon: 'f', color: '#1877F2', label: 'Facebook' },
  newsapi: { icon: '📰', color: '#FF6B35', label: 'News' },
  web: { icon: '🌐', color: '#6366F1', label: 'Web' },
};

export function PlatformTabs({ results, isLoading }: PlatformTabsProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<TrendItem | null>(null);

  // Aggregate all items by platform
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

  // Get items for active tab
  const activeItems = useMemo(() => {
    if (activeTab === 'all') {
      return Object.values(platformData.data).flat();
    }
    return platformData.data[activeTab] || [];
  }, [activeTab, platformData]);

  const tabs = [
    { id: 'all', label: 'All', count: platformData.totalCount },
    ...Object.entries(platformData.data).map(([platform, items]) => ({
      id: platform,
      label: PLATFORM_CONFIG[platform]?.label || platform,
      count: items.length,
    })),
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-10 w-20 bg-slate-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 bg-slate-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map((tab) => {
          const config = tab.id === 'all' ? null : PLATFORM_CONFIG[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              style={
                activeTab === tab.id && config
                  ? { backgroundColor: config.color }
                  : undefined
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
              <span className="ml-2 text-xs opacity-70">({tab.count})</span>
            </button>
          );
        })}
      </div>

      {/* Content Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
        {activeItems.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No results found. Try a different search or platform.
          </div>
        ) : (
          activeItems.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))
        )}
      </div>

      {/* Selected Item Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-slate-900 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <span
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{ backgroundColor: PLATFORM_CONFIG[selectedItem.platform]?.color || '#6366F1' }}
                >
                  {PLATFORM_CONFIG[selectedItem.platform]?.icon || '🌐'}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-100">{selectedItem.author}</h3>
                  <p className="text-sm text-slate-500">{selectedItem.authorHandle}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-3">
              {selectedItem.title}
            </h2>
            <p className="text-slate-300 whitespace-pre-wrap mb-4">
              {selectedItem.content}
            </p>
            <div className="flex gap-4 text-sm text-slate-500 mb-4">
              {selectedItem.metrics.likes && (
                <span>❤️ {selectedItem.metrics.likes}</span>
              )}
              {selectedItem.metrics.shares && (
                <span>🔄 {selectedItem.metrics.shares}</span>
              )}
              {selectedItem.metrics.comments && (
                <span>💬 {selectedItem.metrics.comments}</span>
              )}
              {selectedItem.metrics.views && (
                <span>👁️ {selectedItem.metrics.views}</span>
              )}
            </div>
            <a
              href={selectedItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300"
            >
              View original →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
