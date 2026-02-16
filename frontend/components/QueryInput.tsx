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
  { id: 'twitter', label: 'X / Twitter', color: '#00ffff', hint: 'Fast social momentum' },
  { id: 'linkedin', label: 'LinkedIn', color: '#00ff88', hint: 'Professional conviction' },
  { id: 'newsapi', label: 'News', color: '#ffaa00', hint: 'Media narrative context' },
  { id: 'web', label: 'Web', color: '#aa66ff', hint: 'Long-tail signal capture' },
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
    onSubmit({ idea: idea.trim(), platforms, relevanceThreshold });
  }, [idea, platforms, relevanceThreshold, onSubmit, isLoading, disabled, hasPlatforms]);

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  return (
    <div 
      className="bg-[#0a0a0a] border-2 border-white p-4 sm:p-8"
      style={{ boxShadow: '6px 6px 0px 0px #00ffff' }}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 flex items-center justify-center bg-[#00ffff] shrink-0"
              style={{ boxShadow: '3px 3px 0px 0px #000' }}
            >
              <Compass className="w-5 h-5 text-black" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-white">Laboratory Brief</p>
              <p className="text-xs text-gray-500 font-mono">SECURE INPUT CHANNEL // TEE-PROTECTED</p>
            </div>
          </div>
          <span className="text-xs font-mono text-[#00ffff] self-end sm:self-auto">{idea.trim().length} CHARS</span>
        </div>

        {/* Input Area */}
        <div className="relative">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="EXAMPLE: Identify sectors where viral consumer attention and professional optimism both point to a near-term breakout."
            disabled={disabled}
            rows={4}
            className="w-full bg-[#0a0a0a] text-white placeholder-gray-600 border-2 border-white p-4 pb-16 font-mono text-sm focus:outline-none focus:border-[#00ffff] resize-none"
            style={{ boxShadow: '4px 4px 0px 0px #00ffff' }}
          />
          
          {/* Submit button */}
          <div className="absolute bottom-3 right-3 left-3 sm:left-auto sm:bottom-4 sm:right-4">
            <button
              type="submit"
              disabled={!idea.trim() || isLoading || disabled || !hasPlatforms}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#00ffff] text-black font-black uppercase tracking-wider text-sm border-2 border-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0"
              style={{ 
                boxShadow: isLoading ? 'none' : '4px 4px 0px 0px #fff',
              }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  PROCESSING...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  RUN ANALYSIS
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Platform Selectors */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00ffff]" />
            <span className="text-xs font-black uppercase tracking-wider text-gray-400">World Selectors</span>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {PLATFORM_OPTIONS.map((platform) => {
              const active = platforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => togglePlatform(platform.id)}
                  disabled={disabled}
                  className="text-left p-4 min-h-[44px] bg-[#0a0a0a] border-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 disabled:opacity-50"
                  style={{
                    borderColor: active ? platform.color : '#333',
                    boxShadow: active ? `4px 4px 0px 0px ${platform.color}` : '4px 4px 0px 0px #333',
                  }}
                >
                  <p className="text-sm font-black uppercase" style={{ color: active ? platform.color : '#666' }}>
                    {platform.label}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{platform.hint}</p>
                  {active && (
                    <div className="mt-2 text-xs font-mono" style={{ color: platform.color }}>
                      [ACTIVE]
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          
          {!hasPlatforms && (
            <p className="text-xs text-[#ff4444] font-mono">[!] SELECT AT LEAST ONE SOURCE</p>
          )}
        </div>

        {/* Relevance Threshold */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-gray-400">Relevance Threshold</span>
            <span className="px-3 py-1 bg-[#00ffff] text-black font-black text-xs border-2 border-white" style={{ boxShadow: '2px 2px 0px 0px #fff' }}>
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
            className="w-full accent-[#00ffff]"
          />
        </div>

        {/* Suggestions */}
        <div className="flex flex-col gap-3 pt-4 border-t-2 border-gray-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gray-600" />
            <span className="text-xs text-gray-500 font-mono">SUGGESTED_QUERIES:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setIdea(suggestion)}
                disabled={disabled}
                className="text-left text-xs text-[#00ffff] px-2 py-1.5 border border-[#00ffff]/30 hover:bg-[#00ffff]/10 font-mono transition-colors"
              >
                {suggestion.slice(0, 40)}...
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
