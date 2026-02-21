'use client';

import { useState, useCallback, useMemo } from 'react';
import { Send, Sparkles, Loader2, Compass, Layers, Zap, Shield, BarChart3, Settings2 } from 'lucide-react';
import { QueryRequest } from '@/lib/types';
import { estimateMissionRuntime } from '@/lib/runtimeEstimate';
import { Card, Button, Input, Badge, Tooltip } from './DesignSystem';

interface QueryInputProps {
  onSubmit: (request: QueryRequest) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

interface PlatformOption {
  id: string;
  label: string;
  hint: string;
  enabled: boolean;
  reason?: string;
  isPremium?: boolean;
}

const MODEL_OPTIONS = [
  { id: 'venice', label: 'Venice AI', hint: 'Primary privacy-first consensus lane', quality: 95, cost: 0.002, enabled: true },
  { id: 'openrouter_llama_70b', label: 'OR Llama 70B', hint: 'Strong baseline reasoning and coverage', quality: 90, cost: 0.0006, enabled: true },
  { id: 'openrouter_hermes', label: 'OR Hermes', hint: 'Detailed synthesis and long-context handling', quality: 88, cost: 0.0006, enabled: true },
  { id: 'openrouter_stepfun', label: 'OR Stepfun', hint: 'Fast contrastive perspective for divergence', quality: 84, cost: 0.0005, enabled: true },
  { id: 'aisa', label: 'AIsA (LLM Route)', hint: 'Separate from data connectors; adds provider diversity', quality: 89, cost: 0.0015, enabled: true },
  { id: 'gemini', label: 'Gemini', hint: 'Google model route integration', quality: 87, cost: 0.0008, enabled: false, reason: 'Consensus route rollout pending' },
  { id: 'kimi', label: 'Kimi', hint: 'Moonshot route for long-context synthesis', quality: 86, cost: 0.0007, enabled: false, reason: 'Provider integration pending' },
  { id: 'minimax', label: 'MiniMax', hint: 'Alternative reasoning lane for diversity', quality: 84, cost: 0.0007, enabled: false, reason: 'Provider integration pending' },
];

const PLATFORM_OPTIONS: PlatformOption[] = [
  { id: 'twitter', label: 'X / Twitter', hint: 'Fast social momentum', enabled: false, reason: 'API reliability in progress' },
  { id: 'linkedin', label: 'LinkedIn', hint: 'Professional conviction', enabled: false, reason: 'Connector stability in progress' },
  { id: 'newsapi', label: 'News', hint: 'Media narrative context', enabled: true },
  { id: 'web', label: 'Web', hint: 'Long-tail signal capture (beta)', enabled: true },
  { id: 'gdelt', label: 'GDELT', hint: 'Global event/news graph', enabled: false, reason: 'Connector reliability in progress' },
  { id: 'hackernews', label: 'Hacker News', hint: 'Builder/tech pulse', enabled: true },
  { id: 'stackexchange', label: 'StackExchange', hint: 'Technical problem signals', enabled: true },
  { id: 'coingecko', label: 'CoinGecko', hint: 'Crypto market snapshots', enabled: true },
  { id: 'tinyfish', label: 'TinyFish 🤖', hint: 'AI agent that reads primary sources for deep research', isPremium: true, enabled: true },
];

const MISSION_PROFILES = [
  {
    id: 'alpha-hunter',
    label: 'Alpha Hunter',
    icon: Zap,
    description: 'Fast social momentum & early signals',
    platforms: ['newsapi', 'web', 'hackernews'],
    models: ['venice', 'openrouter_llama_70b'],
    threshold: 0.5,
    accent: 'var(--accent-amber)'
  },
  {
    id: 'due-diligence',
    label: 'Due Diligence',
    icon: Shield,
    description: 'Deep technical verification & TEE proof',
    platforms: ['web', 'tinyfish', 'hackernews', 'stackexchange'],
    models: ['venice', 'openrouter_hermes', 'aisa'],
    threshold: 0.8,
    accent: 'var(--accent-cyan)'
  },
  {
    id: 'market-intel',
    label: 'Market Intel',
    icon: BarChart3,
    description: 'Macro trends & cross-platform consensus',
    platforms: ['newsapi', 'web', 'hackernews', 'coingecko'],
    models: ['venice', 'openrouter_llama_70b', 'openrouter_hermes'],
    threshold: 0.65,
    accent: 'var(--accent-emerald)'
  }
];

const SUGGESTIONS = [
  'Which Monad ecosystem narratives show simultaneous pickup across news, Hacker News, and CoinGecko this week?',
  'Identify AI-agent infra projects where technical discussion is rising before mainstream media coverage.',
  'Where does social hype diverge from fundamentals in DePIN + AI compute markets right now?',
  'Find opportunities where TEE attestation and verifiable consensus create a defensible product moat.',
  'Where does EigenLayer/EigenCompute adoption create immediate opportunities for verifiable AI products?',
  'Which privacy-preserving AI narratives are gaining conviction across builders and market signals?',
  'What Base + BNB Chain narratives are converging and where is momentum diverging by audience?',
];

export function QueryInput({ onSubmit, isLoading, disabled }: QueryInputProps) {
  const [idea, setIdea] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['newsapi', 'web', 'hackernews', 'stackexchange']);
  const [models, setModels] = useState<string[]>(['venice', 'openrouter_llama_70b', 'openrouter_hermes']);
  const [relevanceThreshold, setRelevanceThreshold] = useState(0.6);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const activeProfile = useMemo(() => {
    return MISSION_PROFILES.find(p =>
      p.platforms.every(plt => platforms.includes(plt)) &&
      platforms.length === p.platforms.length &&
      p.models.every(m => models.includes(m)) &&
      models.length === p.models.length &&
      Math.abs(p.threshold - relevanceThreshold) < 0.01
    );
  }, [platforms, models, relevanceThreshold]);

  const applyProfile = (profileId: string) => {
    const profile = MISSION_PROFILES.find(p => p.id === profileId);
    if (!profile) return;
    setPlatforms(profile.platforms);
    setModels(profile.models);
    setRelevanceThreshold(profile.threshold);
  };

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

  const toggleModel = (modelId: string, isEnabled: boolean) => {
    if (!isEnabled) return;
    setModels((prev) =>
      prev.includes(modelId) ? prev.filter((m) => m !== modelId) : [...prev, modelId]
    );
  };

  const totalCost = models.reduce((sum, m) => sum + (MODEL_OPTIONS.find(opt => opt.id === m)?.cost || 0), 0);
  const avgQuality = models.length > 0
    ? models.reduce((sum, m) => sum + (MODEL_OPTIONS.find(opt => opt.id === m)?.quality || 0), 0) / models.length
    : 0;
  const estimatedSeconds = estimateMissionRuntime({
    platforms,
    models,
    relevanceThreshold,
  }).totalSeconds;
  const metricKey = `${estimatedSeconds}-${Math.round(avgQuality)}-${totalCost.toFixed(4)}`;

  return (
    <Card accent={activeProfile ? 'cyan' : 'violet'} shadow="lg" className="p-4 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center transition-all duration-500"
              style={{
                backgroundColor: activeProfile ? activeProfile.accent : 'var(--accent-violet)',
                boxShadow: `3px 3px 0px 0px var(--shadow-color)`
              }}
            >
              {activeProfile ? <activeProfile.icon className="w-5 h-5 text-[var(--bg-primary)]" /> : <Compass className="w-5 h-5 text-[var(--bg-primary)]" />}
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-wider">Mission Brief</p>
              <p className="text-xs text-[var(--text-muted)] font-mono">
                {activeProfile ? `PROFILE: ${activeProfile.label.toUpperCase()}` : 'CUSTOM CONFIGURATION'}
                {" // SECURE"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant={activeProfile ? 'cyan' : 'violet'}>TEE-ACTIVE</Badge>
          </div>
        </div>

        {/* Profile Selectors */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent-amber)]" />
              <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Select Mission Profile</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[10px] font-mono flex items-center gap-1.5 uppercase hover:text-[var(--accent-cyan)] transition-colors"
              style={{ color: showAdvanced ? 'var(--accent-cyan)' : 'var(--text-muted)' }}
            >
              <Settings2 className="w-3 h-3" />
              Advanced Toggles {showAdvanced ? '[ - ]' : '[ + ]'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {MISSION_PROFILES.map((profile) => {
              const active = activeProfile?.id === profile.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => applyProfile(profile.id)}
                  disabled={disabled}
                  className="flex flex-col text-left p-4 bg-[var(--bg-primary)] border-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 relative overflow-hidden group"
                  style={{
                    borderColor: active ? profile.accent : 'var(--bg-tertiary)',
                    boxShadow: active ? `4px 4px 0px 0px ${profile.accent}` : '2px 2px 0px 0px var(--bg-tertiary)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <profile.icon className="w-4 h-4" style={{ color: active ? profile.accent : 'var(--text-muted)' }} />
                    <span className="text-xs font-black uppercase tracking-tight" style={{ color: active ? profile.accent : 'var(--text-primary)' }}>{profile.label}</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] leading-tight">{profile.description}</p>

                  {/* Visual Background indicator */}
                  <div
                    className="absolute -right-2 -bottom-2 opacity-[0.03] transition-transform duration-500 group-hover:scale-125"
                    style={{ color: profile.accent }}
                  >
                    <profile.icon size={64} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Area */}
        <div className="relative pt-2">
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
                  EXECUTE MISSION
                </span>
              )}
            </Button>
          </div>
        </div>

        {showAdvanced && (
          <div className="space-y-6 pt-4 border-t-2 border-dashed border-[var(--bg-tertiary)] animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Platform Selectors */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--accent-cyan)]" />
                <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Advanced: World Selectors</span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {PLATFORM_OPTIONS.map((platform) => {
                  const active = platforms.includes(platform.id);
                  const unavailable = !platform.enabled;
                  const isPremium = platform.isPremium;
                  
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => togglePlatform(platform.id, platform.enabled)}
                      disabled={disabled || unavailable}
                      className="text-left p-3 min-h-[60px] bg-[var(--bg-primary)] border-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed relative"
                      style={{
                        borderColor: unavailable
                          ? 'var(--accent-violet)'
                          : active
                            ? 'var(--accent-cyan)'
                            : 'var(--text-muted)',
                        boxShadow: unavailable
                          ? '2px 2px 0px 0px var(--accent-violet)'
                          : active
                            ? '4px 4px 0px 0px var(--accent-cyan)'
                            : '4px 4px 0px 0px var(--text-muted)',
                      }}
                      title={unavailable ? platform.reason : platform.hint}
                    >
                      {/* Premium indicator */}
                      {isPremium && (
                        <div className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                          🤖 AI Agent
                        </div>
                      )}
                      <p className="text-[11px] font-black uppercase" style={{ color: unavailable ? 'var(--accent-violet)' : active ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                        {platform.label}
                      </p>
                      {active && <Badge variant="cyan" className="mt-1 transform scale-75 origin-left">ACTIVE</Badge>}
                      {unavailable && <Badge variant="violet" className="mt-1 transform scale-75 origin-left">COMING SOON</Badge>}
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
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Advanced: Consensus Routes</span>
                </div>
                  <div className="flex gap-2 text-center">
                  <div
                    key={`cost-${metricKey}`}
                    className="flex flex-col justify-center px-3 py-1 border-2 border-[var(--bg-tertiary)] transition-transform duration-200 animate-in fade-in"
                  >
                    <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">Cost</span>
                    <span className="text-xs font-black text-[var(--accent-amber)]">{totalCost.toFixed(4)} MON</span>
                  </div>
                  <Tooltip content="Mitigation Power estimates how well your selected model mix reduces single-model bias and improves consensus reliability.">
                    <div
                      key={`mitigation-${metricKey}`}
                      className="flex flex-col justify-center px-3 py-1 border-2 border-[var(--bg-tertiary)] transition-transform duration-200 animate-in fade-in cursor-help"
                    >
                      <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase inline-flex items-center justify-center gap-1">
                        Mitigation Power
                      </span>
                      <span className="text-xs font-black text-[var(--accent-cyan)]">{Math.round(avgQuality)}%</span>
                    </div>
                  </Tooltip>
                  <div
                    key={`eta-${metricKey}`}
                    className="flex flex-col justify-center px-3 py-1 border-2 border-[var(--bg-tertiary)] transition-transform duration-200 animate-in fade-in"
                  >
                    <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">ETA</span>
                    <span className="text-xs font-black text-[var(--accent-emerald)]">~{Math.round(estimatedSeconds / 60)}m</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {MODEL_OPTIONS.map((model) => {
                  const active = models.includes(model.id);
                  const unavailable = model.enabled === false;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => toggleModel(model.id, model.enabled !== false)}
                      disabled={disabled || unavailable}
                      className="text-left p-2.5 min-h-[50px] bg-[var(--bg-primary)] border-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed relative"
                      style={{
                        borderColor: unavailable
                          ? 'var(--accent-violet)'
                          : active
                            ? 'var(--accent-amber)'
                            : 'var(--text-muted)',
                        boxShadow: unavailable
                          ? '2px 2px 0px 0px var(--accent-violet)'
                          : active
                            ? '4px 4px 0px 0px var(--accent-amber)'
                            : '4px 4px 0px 0px var(--text-muted)',
                        backgroundColor: active ? 'rgba(255, 170, 0, 0.08)' : undefined,
                      }}
                      title={unavailable ? model.reason : model.hint}
                    >
                      <p className="text-[10px] font-black uppercase" style={{ color: unavailable ? 'var(--accent-violet)' : active ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                        {model.label}
                      </p>
                      {unavailable && (
                        <Badge variant="violet" className="mt-1 transform scale-75 origin-left">
                          COMING SOON
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
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
          </div>
        )}

        {/* Suggestions - Collapsible */}
        <div className="pt-2 border-t-2 border-[var(--text-muted)]">
          <button
            type="button"
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--accent-cyan)] transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-mono">
              {showSuggestions ? '[-] Hide Example Queries' : '[+] Show Example Queries'}
            </span>
          </button>
          
          {showSuggestions && (
            <div className="flex flex-wrap gap-2 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
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
          )}
        </div>
      </form>
    </Card>
  );
}
