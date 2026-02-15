'use client';

import { useState, useCallback } from 'react';
import { Send, Sparkles, Loader2, Compass, Layers } from 'lucide-react';
import { QueryRequest } from '@/lib/types';

interface QueryInputProps {
  onSubmit: (request: QueryRequest) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const PLATFORM_OPTIONS = [
  {
    id: 'twitter',
    label: 'X / Twitter',
    color: '#1DA1F2',
    hint: 'Fast social momentum',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    color: '#0A66C2',
    hint: 'Professional conviction',
  },
  {
    id: 'newsapi',
    label: 'News',
    color: '#FF6B35',
    hint: 'Media narrative context',
  },
  {
    id: 'web',
    label: 'Web',
    color: '#6366F1',
    hint: 'Long-tail signal capture',
  },
];

const SUGGESTIONS = [
  'AI agent infra opportunities bridging social and on-chain liquidity',
  'Emerging fintech narratives with high retail engagement potential',
  'Top catalyst sectors likely to spawn meme-driven token communities',
  'Where professional sentiment and social hype align this quarter',
];

export function QueryInput({ onSubmit, isLoading, disabled }: QueryInputProps) {
  const [idea, setIdea] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['twitter', 'newsapi']);
  const [relevanceThreshold, setRelevanceThreshold] = useState(0.6);

  const hasPlatforms = platforms.length > 0;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim() || isLoading || disabled || !hasPlatforms) return;

    onSubmit({
      idea: idea.trim(),
      platforms,
      relevanceThreshold,
    });
  }, [idea, platforms, relevanceThreshold, onSubmit, isLoading, disabled, hasPlatforms]);

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const quickSubmit = () => {
    if (!disabled && !isLoading && idea.trim() && hasPlatforms) {
      onSubmit({ idea: idea.trim(), platforms, relevanceThreshold });
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto rounded-3xl border border-slate-700/80 bg-slate-900/70 backdrop-blur p-5 sm:p-7">
      <form onSubmit={handleSubmit} className="space-y-5 animate-fade-up">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-cyan-300">
            <Compass className="w-4 h-4" />
            <p className="text-sm font-medium">Laboratory Brief</p>
          </div>
          <span className="text-xs text-slate-400">{idea.trim().length} chars</span>
        </div>

        <div className="relative">
          <label htmlFor="trend-idea" className="mb-2 block text-sm font-medium text-slate-300">
            What conviction are you testing?
          </label>
          <textarea
            id="trend-idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                quickSubmit();
              }
            }}
            placeholder="Example: Identify sectors where viral consumer attention and professional optimism both point to a near-term breakout."
            className="w-full h-36 px-4 py-3 pr-36 bg-slate-950/70 border border-slate-700 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
            disabled={disabled}
            aria-describedby="brief-help-text"
          />
          <button
            type="submit"
            disabled={!idea.trim() || isLoading || disabled || !hasPlatforms}
            className="absolute bottom-3 right-3 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-cyan-900/40"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {isLoading ? 'Analyzing...' : 'Run Analysis'}
            </span>
          </button>
        </div>

        <div id="brief-help-text" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-slate-400">
          <span>Use target audience, timeframe, and market angle for higher-quality results.</span>
          <span>Cmd/Ctrl + Enter to submit</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-300">
            <Layers className="w-4 h-4" />
            <p className="text-sm font-medium">World Selectors</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {PLATFORM_OPTIONS.map((platform) => {
              const active = platforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => togglePlatform(platform.id)}
                  disabled={disabled}
                  aria-pressed={active}
                  className={`text-left rounded-xl border px-3 py-2.5 transition-all min-h-14 ${
                    active
                      ? 'border-slate-500 bg-slate-800/90'
                      : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800/60'
                  }`}
                  style={active ? { boxShadow: `inset 0 0 0 1px ${platform.color}60` } : undefined}
                >
                  <p className="text-sm font-medium" style={{ color: active ? platform.color : '#d1d5db' }}>
                    {platform.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{platform.hint}</p>
                </button>
              );
            })}
          </div>
          {!hasPlatforms && (
            <p className="text-xs text-amber-400">Select at least one source to run analysis.</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <label htmlFor="relevance-threshold" className="text-slate-300">Relevance threshold</label>
            <span className="text-cyan-300 font-medium">{Math.round(relevanceThreshold * 100)}%</span>
          </div>
          <input
            id="relevance-threshold"
            type="range"
            min="0.2"
            max="0.95"
            step="0.05"
            value={relevanceThreshold}
            onChange={(e) => setRelevanceThreshold(Number(e.target.value))}
            disabled={disabled}
            className="w-full accent-cyan-500"
          />
          <p className="text-xs text-slate-500">Higher threshold means fewer but stronger signals.</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Sparkles className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-500">Try prompts:</span>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setIdea(suggestion)}
              disabled={disabled}
              className="text-sm text-cyan-200 hover:text-cyan-100 bg-slate-900/70 border border-slate-700 rounded-full px-3 py-1 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
