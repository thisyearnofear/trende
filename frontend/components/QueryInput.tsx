'use client';

import { useState, useCallback } from 'react';
import { Send, Sparkles, Loader2, Compass, Layers } from 'lucide-react';
import { QueryRequest } from '@/lib/types';
import { Card, Button, Input, Badge } from './DesignSystem';

interface QueryInputProps {
  onSubmit: (request: QueryRequest) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const MODEL_OPTIONS = [
  { id: 'venice', label: 'Venice AI', hint: 'Privacy-focused, unbiased Llama 3', quality: 95, cost: 0.002 },
  { id: 'aisa', label: 'AIsA API', hint: 'High-reasoning, filtered responses', quality: 90, cost: 0.0015 },
  { id: 'tabstack', label: 'Tabstack', hint: 'Real-time web verification', quality: 85, cost: 0.001 },
  { id: 'openrouter', label: 'OpenRouter', hint: 'Multi-model fallback aggregator', quality: 80, cost: 0.0005 },
];

const PLATFORM_OPTIONS = [
  { id: 'twitter', label: 'X / Twitter', hint: 'Fast social momentum', enabled: false, reason: 'API reliability in progress' },
  { id: 'linkedin', label: 'LinkedIn', hint: 'Professional conviction', enabled: false, reason: 'Connector stability in progress' },
  { id: 'newsapi', label: 'News', hint: 'Media narrative context', enabled: true },
  { id: 'web', label: 'Web', hint: 'Long-tail signal capture', enabled: false, reason: 'Tabstack timeout issues' },
  { id: 'gdelt', label: 'GDELT', hint: 'Global event/news graph', enabled: false, reason: 'Connector reliability in progress' },
  { id: 'wikimedia', label: 'Wikimedia', hint: 'Live public knowledge edits', enabled: false, reason: 'Connector reliability in progress' },
  { id: 'hackernews', label: 'Hacker News', hint: 'Builder/tech pulse', enabled: true },
  { id: 'stackexchange', label: 'StackExchange', hint: 'Technical problem signals', enabled: true },
  { id: 'coingecko', label: 'CoinGecko', hint: 'Crypto market snapshots', enabled: true },
];

const SUGGESTIONS = [
  'AI agent infra opportunities bridging social and on-chain liquidity',
  'Emerging fintech narratives with high retail engagement potential',
  'Top catalyst sectors likely to spawn meme-driven token communities',
  'Where professional sentiment and social hype align this quarter',
];

export function QueryInput({ onSubmit, isLoading, disabled }: QueryInputProps) {
  const [idea, setIdea] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['newsapi', 'hackernews', 'stackexchange']);
  const [models, setModels] = useState<string[]>(['venice', 'aisa', 'openrouter']);
  const [relevanceThreshold, setRelevanceThreshold] = useState(0.6);

  const hasPlatforms = platforms.length > 0;
  const hasModels = models.length > 0;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim() || isLoading || disabled || !hasPlatforms || !hasModels) return;
    onSubmit({ idea: idea.trim(), platforms, models, relevanceThreshold });
  }, [idea, platforms, models, relevanceThreshold, onSubmit, isLoading, disabled, hasPlatforms, hasModels]);

  const togglePlatform = (platform: string, isEnabled: boolean) => {
    if (!isEnabled) return;
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const toggleModel = (modelId: string) => {
    setModels((prev) =>
      prev.includes(modelId) ? prev.filter((m) => m !== modelId) : [...prev, modelId]
    );
  };

  const totalCost = models.reduce((sum, m) => sum + (MODEL_OPTIONS.find(opt => opt.id === m)?.cost || 0), 0);
  const avgQuality = models.length > 0 
    ? models.reduce((sum, m) => sum + (MODEL_OPTIONS.find(opt => opt.id === m)?.quality || 0), 0) / models.length
    : 0;
  const estimatedSeconds = Math.max(
    20,
    Math.round(
      12 +
      platforms.length * 9 +
      models.length * 11 +
      (relevanceThreshold > 0.75 ? 10 : 0),
    ),
  );

  return (
    <Card accent="cyan" shadow="lg" className="p-4 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-cyan)', boxShadow: '3px 3px 0px 0px var(--shadow-color)' }}
            >
              <Compass className="w-5 h-5 text-[var(--bg-primary)]" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-wider">Laboratory Brief</p>
              <p className="text-xs text-[var(--text-muted)] font-mono">SECURE INPUT CHANNEL // TEE-PROTECTED</p>
            </div>
          </div>
          <Badge variant="cyan">{idea.trim().length} CHARS</Badge>
        </div>

        {/* Input Area */}
        <div className="relative">
          <Input
            value={idea}
            onChange={setIdea}
            placeholder="EXAMPLE: Identify sectors where viral consumer attention and professional optimism both point to a near-term breakout."
            disabled={disabled}
            rows={4}
          />
          
          {/* Submit button */}
          <div className="absolute bottom-4 right-4">
            <Button type="submit" disabled={!idea.trim() || isLoading || disabled || !hasPlatforms || !hasModels}>
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
            </Button>
          </div>
        </div>

        {/* Platform Selectors */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--accent-cyan)]" />
            <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">World Selectors</span>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {PLATFORM_OPTIONS.map((platform) => {
              const active = platforms.includes(platform.id);
              const unavailable = !platform.enabled;
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => togglePlatform(platform.id, platform.enabled)}
                  disabled={disabled || unavailable}
                  className="text-left p-4 min-h-[80px] bg-[var(--bg-primary)] border-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    borderColor: unavailable
                      ? 'var(--accent-amber)'
                      : active
                        ? 'var(--accent-cyan)'
                        : 'var(--text-muted)',
                    boxShadow: unavailable
                      ? '4px 4px 0px 0px var(--accent-amber)'
                      : active
                        ? '4px 4px 0px 0px var(--accent-cyan)'
                        : '4px 4px 0px 0px var(--text-muted)',
                  }}
                  title={unavailable ? platform.reason : platform.hint}
                >
                  <p className="text-sm font-black uppercase" style={{ color: unavailable ? 'var(--accent-amber)' : active ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                    {platform.label}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{platform.hint}</p>
                  {unavailable ? (
                    <Badge variant="amber" className="mt-2">COMING SOON</Badge>
                  ) : active ? (
                    <Badge variant="cyan" className="mt-2">ACTIVE</Badge>
                  ) : null}
                </button>
              );
            })}
          </div>
          
          {!hasPlatforms && (
            <p className="text-xs font-mono text-[var(--accent-rose)]">[!] SELECT AT LEAST ONE SOURCE</p>
          )}
        </div>

        {/* Model Selectors */}
        <div className="space-y-4 pt-4 border-t-2 border-[var(--bg-tertiary)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent-amber)]" />
              <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Consensus Models</span>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex flex-col items-end">
                <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Est. Cost</span>
                <span className="text-xs font-black text-[var(--accent-amber)]">{totalCost.toFixed(4)} MON</span>
              </div>
              <div className="flex flex-col items-end border-l-2 border-[var(--bg-tertiary)] pl-3">
                <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Est. Time</span>
                <span className="text-xs font-black text-[var(--accent-emerald)]">~{estimatedSeconds}s</span>
              </div>
              <div className="flex flex-col items-end border-l-2 border-[var(--bg-tertiary)] pl-3">
                <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Mitigation Power</span>
                <span className="text-xs font-black text-[var(--accent-cyan)]">{Math.round(avgQuality)}%</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {MODEL_OPTIONS.map((model) => {
              const active = models.includes(model.id);
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => toggleModel(model.id)}
                  disabled={disabled}
                  className="text-left p-3 min-h-[70px] bg-[var(--bg-primary)] border-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 disabled:opacity-50"
                  style={{
                    borderColor: active ? 'var(--accent-amber)' : 'var(--text-muted)',
                    boxShadow: active ? '4px 4px 0px 0px var(--accent-amber)' : '4px 4px 0px 0px var(--text-muted)',
                  }}
                >
                  <p className="text-xs font-black uppercase" style={{ color: active ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                    {model.label}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-tight">{model.hint}</p>
                </button>
              );
            })}
          </div>
          
          {!hasModels && (
            <p className="text-xs font-mono text-[var(--accent-rose)]">[!] SELECT AT LEAST ONE MODEL FOR CONSENSUS</p>
          )}
        </div>

        {/* Relevance Threshold */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Relevance Threshold</span>
            <Badge variant="cyan">{Math.round(relevanceThreshold * 100)}%</Badge>
          </div>
          <input
            type="range"
            min="0.2"
            max="0.95"
            step="0.05"
            value={relevanceThreshold}
            onChange={(e) => setRelevanceThreshold(Number(e.target.value))}
            disabled={disabled}
            className="w-full"
            style={{ accentColor: 'var(--accent-cyan)' }}
          />
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t-2 border-[var(--text-muted)]">
          <Sparkles className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)] font-mono">SUGGESTED_QUERIES:</span>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setIdea(suggestion)}
              disabled={disabled}
              className="text-xs px-2 py-1 border font-mono transition-colors hover:bg-[var(--accent-cyan)] hover:text-[var(--bg-primary)]"
              style={{ color: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)' }}
            >
              {suggestion.slice(0, 40)}...
            </button>
          ))}
        </div>
      </form>
    </Card>
  );
}
