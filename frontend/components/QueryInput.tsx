'use client';

import { useState, useCallback, useMemo } from 'react';
import { Sparkles, Loader2, Compass, Layers, Zap, Shield, BarChart3, Settings2, Rocket, Activity } from 'lucide-react';
import { QueryRequest } from '@/lib/types';
import { Card, Button } from './DesignSystem';
import { cn } from '@/lib/utils';

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
  { id: 'venice_default', label: 'Venice AI', hint: 'Primary privacy-first consensus lane', quality: 95, cost: 0.002, enabled: true },
  { id: 'openrouter_llama_70b', label: 'OR Llama 70B', hint: 'Strong baseline reasoning and coverage', quality: 90, cost: 0.0006, enabled: true },
  { id: 'openrouter_hermes', label: 'OR Hermes', hint: 'Detailed synthesis and long-context handling', quality: 88, cost: 0.0006, enabled: true },
  { id: 'openrouter_stepfun', label: 'OR Stepfun', hint: 'Contrastive perspective for divergence checks', quality: 84, cost: 0.0005, enabled: true },
  { id: 'aisa', label: 'AIsA (LLM Route)', hint: 'Separate from data connectors; adds provider diversity', quality: 89, cost: 0.0015, enabled: true },
  { id: 'venice_uncensored', label: 'Venice Uncensored', hint: 'High-recall uncensored Venice route', quality: 86, cost: 0.0013, enabled: true },
  { id: 'venice_mistral', label: 'Venice Mistral', hint: 'Mistral-family Venice route for style diversity', quality: 85, cost: 0.0011, enabled: true },
  { id: 'venice_glm', label: 'Venice GLM', hint: 'GLM-family Venice route for additional perspective', quality: 85, cost: 0.0011, enabled: true },
];

const PLATFORM_OPTIONS: PlatformOption[] = [
  { id: 'twitter', label: 'X / Twitter', hint: 'Social momentum and narrative shifts', enabled: false, reason: 'API reliability in progress' },
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
    label: 'Standard Research',
    icon: Zap,
    description: 'Balanced coverage with strong cross-source grounding',
    platforms: ['newsapi', 'web', 'hackernews'],
    models: ['venice_default', 'venice_mistral', 'openrouter_llama_70b', 'aisa'],
    threshold: 0.5,
    accent: 'var(--accent-amber)'
  },
  {
    id: 'due-diligence',
    label: 'Due Diligence',
    icon: Shield,
    description: 'Deep technical verification & TEE proof',
    platforms: ['web', 'tinyfish', 'hackernews', 'stackexchange'],
    models: ['venice_default', 'venice_uncensored', 'venice_mistral', 'openrouter_hermes', 'aisa'],
    threshold: 0.8,
    accent: 'var(--accent-cyan)'
  },
  {
    id: 'market-intel',
    label: 'Market Intelligence',
    icon: BarChart3,
    description: 'Macro trend mapping with multi-platform consensus',
    platforms: ['newsapi', 'web', 'hackernews', 'coingecko'],
    models: ['venice_default', 'venice_glm', 'openrouter_llama_70b', 'openrouter_hermes', 'aisa'],
    threshold: 0.65,
    accent: 'var(--accent-emerald)'
  }
];

const SUGGESTIONS = [
  'Which Base and Arbitrum ecosystem narratives show simultaneous pickup across news, Hacker News, and CoinGecko this week?',
  'Identify AI-agent infra projects where technical discussion is rising before mainstream media coverage.',
  'Where does social hype diverge from fundamentals in DePIN + AI compute markets right now?',
  'Find opportunities where TEE attestation and verifiable consensus create a defensible product moat.',
  'Where does EigenLayer/EigenCompute adoption create immediate opportunities for verifiable AI products?',
  'Which privacy-preserving AI narratives are gaining conviction across builders and market signals?',
  'What Base + Arbitrum L2 narratives are converging and where is momentum diverging by audience?',
];

export function QueryInput({ onSubmit, isLoading, disabled }: QueryInputProps) {
  const [idea, setIdea] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['newsapi', 'web', 'hackernews', 'stackexchange']);
  const [models, setModels] = useState<string[]>(['venice_default', 'venice_mistral', 'openrouter_llama_70b', 'openrouter_hermes', 'aisa']);
  const [relevanceThreshold, setRelevanceThreshold] = useState(0.6);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedSeen, setAdvancedSeen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('trende:advanced_controls_seen') === '1';
  });
  const [highlightSelections, setHighlightSelections] = useState(false);

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
  const selectedSuggestion = useMemo(
    () => SUGGESTIONS.find((suggestion) => suggestion === idea.trim()) || null,
    [idea]
  );

  const markAdvancedSeen = useCallback(() => {
    setAdvancedSeen(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('trende:advanced_controls_seen', '1');
    }
  }, []);

  const toggleAdvancedControls = useCallback(() => {
    setShowAdvanced((prev) => {
      const next = !prev;
      if (next) markAdvancedSeen();
      return next;
    });
  }, [markAdvancedSeen]);

  const openAdvancedWithHighlight = useCallback(() => {
    markAdvancedSeen();
    setShowAdvanced(true);
    setHighlightSelections(true);
    window.setTimeout(() => setHighlightSelections(false), 2600);
  }, [markAdvancedSeen]);

  return (
    <div className="relative group">
      {/* Background glow effects */}
      <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-emerald-500/10 rounded-[2rem] blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />

      <Card accent="white" shadow="none" className="p-5 sm:p-8 glass border-white/10 rounded-[2rem] overflow-hidden relative">
        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 glass border-white/20 shadow-xl"
                style={{
                  backgroundColor: activeProfile ? `${activeProfile.accent}33` : 'rgba(255,255,255,0.05)',
                }}
              >
                {activeProfile ? (
                  <activeProfile.icon className="w-6 h-6" style={{ color: activeProfile.accent }} />
                ) : (
                  <Compass className="w-6 h-6 text-white/40" />
                )}
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Agent Briefing</h3>
                <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-[0.3em]">
                  {activeProfile ? `PROFILE: ${activeProfile.label}` : 'CUSTOM DIRECTIVE'}
                </p>
                <p className="text-[10px] font-mono text-[var(--accent-cyan)] mt-1">
                  Quality-first execution. Typical completion: 4-12 minutes.
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <div className="px-3 py-1 flex items-center gap-2 rounded-full glass border-emerald-500/20 text-[10px] font-black uppercase text-emerald-400 tracking-widest">
                <Activity className="w-3 h-3 animate-pulse" />
                Agent Online
              </div>
            </div>
          </div>

          {/* Starter Missions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 opacity-60" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Starter Missions</span>
              </div>
              <button
                type="button"
                onClick={toggleAdvancedControls}
                className={cn(
                  "text-[10px] font-black tracking-widest flex items-center gap-2 uppercase transition-all hover:text-cyan-400 text-[var(--text-muted)] group/btn relative",
                  !advancedSeen && !showAdvanced && "text-cyan-300 animate-pulse"
                )}
              >
                <Settings2 className={cn("w-3.5 h-3.5 transition-transform duration-500", showAdvanced ? "rotate-180" : "")} />
                Advanced Controls
                {!advancedSeen && !showAdvanced && (
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-300">Recommended</span>
                )}
              </button>
            </div>

            {!showAdvanced && (
              <div className="flex flex-col sm:flex-row gap-3">
                {SUGGESTIONS.slice(0, 3).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setIdea(suggestion)}
                    disabled={disabled}
                    className={cn(
                      "flex-1 text-xs font-mono px-4 py-3 rounded-2xl glass transition-all text-left flex flex-col justify-between min-h-[80px]",
                      selectedSuggestion === suggestion
                        ? "border-cyan-400/70 bg-cyan-500/10 text-[var(--text-primary)] shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
                        : "border-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-cyan-400/50 hover:bg-white/10"
                    )}
                  >
                    <span className={cn(
                      "font-black uppercase tracking-[0.2em] text-[10px] block mb-2",
                      selectedSuggestion === suggestion ? "text-cyan-300 opacity-100" : "text-[var(--accent-cyan)] opacity-60"
                    )}>
                      {selectedSuggestion === suggestion ? "Selected" : "One-Click"}
                    </span>
                    <span className="line-clamp-3 leading-relaxed">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="relative group/input">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 rounded-[1.5rem] blur opacity-0 group-focus-within/input:opacity-100 transition-opacity" />
            <div className="relative">
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Brief your agent... e.g., 'Investigate DePIN + AI compute convergence. Identify where builder momentum diverges from market narrative across HN, CoinGecko, and Web sources.'"
                disabled={disabled}
                rows={4}
                className="w-full bg-black/40 glass border-white/10 rounded-2xl p-6 text-base font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-white/30 transition-all resize-none shadow-inner"
              />

              <div className="absolute bottom-4 right-4 flex items-center gap-4">
                {/* Character count or similar could go here */}
                <Button
                  type="submit"
                  className="rounded-xl px-8 shadow-2xl transition-all active:scale-95"
                  variant="primary"
                  disabled={!idea.trim() || isLoading || disabled || !hasPlatforms || !hasModels}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="font-black uppercase tracking-widest text-xs">Agent Running</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Rocket className="w-4 h-4" />
                      <span className="font-black uppercase tracking-widest text-xs">Deploy Agent</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="relative group/spec">
            <button
              type="button"
              onClick={openAdvancedWithHighlight}
              className="w-full text-left px-4 py-3 rounded-xl glass border border-white/10 hover:border-cyan-400/60 transition-all"
            >
              <p className="text-xs font-mono text-[var(--text-primary)] line-clamp-1">
                &quot;{idea.trim() || "Set your mission directive above"}&quot;
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-black uppercase tracking-wider">
                <span className="px-2 py-1 rounded bg-cyan-500/10 text-cyan-300">{platforms.length} sources</span>
                <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-300">{models.length} models</span>
                <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-300">{Math.round(relevanceThreshold * 100)}% threshold</span>
              </div>
            </button>
            <div className="pointer-events-none absolute z-30 left-0 right-0 mt-2 opacity-0 translate-y-1 group-hover/spec:opacity-100 group-hover/spec:translate-y-0 transition-all duration-200">
              <div className="glass border border-white/10 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300 mb-1">Mission Configuration</p>
                <p className="text-[10px] font-mono text-[var(--text-secondary)]">
                  Sources: {platforms.join(", ")}
                </p>
                <p className="text-[10px] font-mono text-[var(--text-secondary)] mt-1">
                  Models: {models.join(", ")}
                </p>
              </div>
            </div>
          </div>

          {showAdvanced && (
            <div className="space-y-8 pt-6 border-t border-white/5 animate-in fade-in slide-in-from-top-4 duration-500">

              {/* Profile Selectors moved here */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 opacity-60" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Select Agent Profile</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {MISSION_PROFILES.map((profile) => {
                    const active = activeProfile?.id === profile.id;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => applyProfile(profile.id)}
                        disabled={disabled}
                        className={cn(
                          "flex flex-col text-left p-4 transition-all duration-500 glass relative overflow-hidden group/card rounded-2xl",
                          active ? "border-white/30" : "border-white/5 opacity-60 hover:opacity-100 hover:border-white/10"
                        )}
                      >
                        {active && <div className="absolute inset-0 bg-white/[0.03] animate-pulse" />}
                        <div className="flex items-center gap-3 mb-2 relative z-10">
                          <div className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center border transition-all duration-500",
                            active ? "bg-white/10 border-white/20" : "bg-white/5 border-white/10"
                          )}>
                            <profile.icon className="w-3 h-3" style={{ color: active ? profile.accent : 'rgba(255,255,255,0.3)' }} />
                          </div>
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest transition-colors duration-500",
                            active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                          )}>{profile.label}</span>
                        </div>
                        <p className="text-[9px] leading-relaxed font-mono text-[var(--text-muted)] relative z-10">{profile.description}</p>
                        {active && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: profile.accent }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-cyan-500/10 flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Source Matrix Selection</span>
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
                        className={cn(
                          "text-left p-4 rounded-xl glass border transition-all duration-300 relative group/plat",
                          active ? "border-cyan-500/50 bg-cyan-500/5" : "border-white/5 hover:border-white/20 opacity-40 hover:opacity-100",
                          active && highlightSelections && "ring-1 ring-cyan-300/80 animate-pulse"
                        )}
                        title={unavailable ? platform.reason : platform.hint}
                      >
                        <p className={cn(
                          "text-[10px] font-black uppercase tracking-widest mb-1",
                          active ? "text-cyan-400" : "text-[var(--text-primary)]"
                        )}>
                          {platform.label}
                        </p>
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_var(--accent-cyan)]" />}
                        {unavailable && <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">Planned</span>}
                        {platform.isPremium && (
                          <div className="absolute top-2 right-2">
                            <Sparkles className="w-3 h-3 text-amber-400 opacity-50" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Model Selectors */}
              <div className="space-y-4 pt-6 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-amber-500/10 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Neural Consensus Routes</span>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest">Est. Cost</span>
                      <span className="text-xs font-black text-amber-400 tabular-nums">{totalCost.toFixed(4)} ETH</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-widest">Confidence Power</span>
                      <span className="text-xs font-black text-cyan-400 tabular-nums">{Math.round(avgQuality)}%</span>
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
                        className={cn(
                          "text-left p-3 rounded-xl glass border transition-all duration-300",
                          active ? "border-amber-500/50 bg-amber-500/5 shadow-inner" : "border-white/5 hover:border-white/20 opacity-40 hover:opacity-100",
                          active && highlightSelections && "ring-1 ring-amber-300/80 animate-pulse"
                        )}
                      >
                        <p className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          active ? "text-amber-400" : "text-[var(--text-primary)]"
                        )}>
                          {model.label}
                        </p>
                        {unavailable && <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">Testing</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Relevance Threshold */}
              <div className="space-y-4 pt-6 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Intelligence Saliency Threshold</span>
                  <span className="text-xs font-black text-cyan-400">{Math.round(relevanceThreshold * 100)}%</span>
                </div>
                <div className="relative flex items-center px-4">
                  <div className="absolute inset-x-0 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400" style={{ width: `${relevanceThreshold * 100}%` }} />
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="0.95"
                    step="0.05"
                    value={relevanceThreshold}
                    onChange={(e) => setRelevanceThreshold(Number(e.target.value))}
                    disabled={disabled}
                    className="relative w-full h-6 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-cyan-400"
                  />
                </div>
              </div>
            </div>
          )}


        </form>
      </Card>
    </div>
  );
}
