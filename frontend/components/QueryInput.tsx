'use client';

import { useState, useCallback } from 'react';
import { Send, Sparkles, Loader2, Compass, Layers } from 'lucide-react';
import { QueryRequest } from '@/lib/types';
import { NeumorphicCard, NeumorphicButton, NeumorphicInput } from './Neumorphic';

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
    <NeumorphicCard intensity="strong" className="p-6 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-cyan-400">
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                boxShadow: '4px 4px 8px rgba(2, 6, 23, 0.8), -4px -4px 8px rgba(30, 41, 59, 0.4)',
              }}
            >
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Laboratory Brief</p>
              <p className="text-xs text-slate-500">What conviction are we testing?</p>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-mono">{idea.trim().length} chars</span>
        </div>

        {/* Input Area */}
        <div className="relative">
          <NeumorphicInput
            value={idea}
            onChange={setIdea}
            placeholder="Example: Identify sectors where viral consumer attention and professional optimism both point to a near-term breakout."
            disabled={disabled}
            rows={4}
          />
          
          {/* Submit button - positioned inside input */}
          <div className="absolute bottom-3 right-3">
            <button
              type="submit"
              disabled={!idea.trim() || isLoading || disabled || !hasPlatforms}
              className="
                px-4 py-2 rounded-xl font-medium text-sm
                bg-gradient-to-br from-cyan-500 to-cyan-600 text-white
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-150 active:scale-95
                flex items-center gap-2
              "
              style={{
                boxShadow: isLoading 
                  ? 'inset 4px 4px 8px rgba(0, 0, 0, 0.3)' 
                  : '4px 4px 12px rgba(6, 182, 212, 0.3), -2px -2px 8px rgba(30, 41, 59, 0.3)',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Run Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* Help text */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-slate-500">
          <span>Use target audience, timeframe, and market angle for higher-quality results.</span>
          <span className="font-mono text-cyan-500/70">Cmd/Ctrl + Enter to submit</span>
        </div>

        {/* Platform Selectors */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-300">
            <div 
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                boxShadow: '3px 3px 6px rgba(2, 6, 23, 0.8), -3px -3px 6px rgba(30, 41, 59, 0.4)',
              }}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <p className="text-sm font-medium">World Selectors</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PLATFORM_OPTIONS.map((platform) => {
              const active = platforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => togglePlatform(platform.id)}
                  disabled={disabled}
                  aria-pressed={active}
                  className={`
                    text-left rounded-2xl p-4 transition-all duration-200
                    ${active 
                      ? 'bg-slate-800' 
                      : 'bg-slate-900 hover:bg-slate-800/80'
                    }
                    disabled:opacity-50
                  `}
                  style={{
                    boxShadow: active
                      ? 'inset 4px 4px 8px rgba(2, 6, 23, 0.9), inset -4px -4px 8px rgba(30, 41, 59, 0.4)'
                      : '6px 6px 12px rgba(2, 6, 23, 0.8), -6px -6px 12px rgba(30, 41, 59, 0.4)',
                    border: active ? `1px solid ${platform.color}40` : '1px solid transparent',
                  }}
                >
                  <p 
                    className="text-sm font-semibold mb-1 transition-colors"
                    style={{ color: active ? platform.color : '#94a3b8' }}
                  >
                    {platform.label}
                  </p>
                  <p className="text-xs text-slate-500">{platform.hint}</p>
                  
                  {/* Active indicator */}
                  {active && (
                    <div 
                      className="mt-3 w-2 h-2 rounded-full"
                      style={{ 
                        backgroundColor: platform.color,
                        boxShadow: `0 0 8px ${platform.color}`,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          
          {!hasPlatforms && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Select at least one source to run analysis.
            </p>
          )}
        </div>

        {/* Relevance Threshold */}
        <div className="space-y-3 p-4 rounded-2xl bg-slate-900/50">
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm text-slate-400">Relevance threshold</label>
            <span 
              className="text-cyan-400 font-bold font-mono px-3 py-1 rounded-lg"
              style={{
                background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                boxShadow: 'inset 2px 2px 4px rgba(2, 6, 23, 0.8), inset -2px -2px 4px rgba(30, 41, 59, 0.4)',
              }}
            >
              {Math.round(relevanceThreshold * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.2"
            max="0.95"
            step="0.05"
            value={relevanceThreshold}
            onChange={(e) => setRelevanceThreshold(Number(e.target.value))}
            disabled={disabled}
            className="w-full accent-cyan-500 cursor-pointer"
          />
          <p className="text-xs text-slate-500">Higher threshold means fewer but stronger signals.</p>
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-2 items-center pt-2">
          <Sparkles className="w-4 h-4 text-slate-600" />
          <span className="text-sm text-slate-500">Try prompts:</span>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setIdea(suggestion)}
              disabled={disabled}
              className="
                text-xs text-cyan-300/80 hover:text-cyan-200
                px-3 py-1.5 rounded-full
                transition-all duration-200
                bg-slate-900
                hover:bg-slate-800
              "
              style={{
                boxShadow: '3px 3px 6px rgba(2, 6, 23, 0.8), -3px -3px 6px rgba(30, 41, 59, 0.3)',
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>
    </NeumorphicCard>
  );
}
