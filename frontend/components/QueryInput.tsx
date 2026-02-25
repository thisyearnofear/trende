'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Sparkles, Loader2, Compass, Layers, Zap, Shield, BarChart3, Rocket, Activity } from 'lucide-react';
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

type AugmentMode = 'auto' | 'on' | 'off';
type ComposerStage = 'directive' | 'setup' | 'launch';

const DEFAULT_PLATFORM_SELECTION = ['newsapi', 'web', 'hackernews', 'stackexchange'] as const;
const DEFAULT_MODEL_SELECTION = ['venice_default', 'venice_mistral', 'openrouter_llama_70b', 'openrouter_hermes', 'aisa'] as const;
const DEFAULT_THRESHOLD = 0.6;
const DEFAULT_AUGMENTATION = { firecrawl: 'auto' as AugmentMode, synthdata: 'auto' as AugmentMode };

const SOURCE_RUNTIME_SECONDS: Record<string, number> = {
  newsapi: 75,
  web: 120,
  hackernews: 55,
  stackexchange: 65,
  coingecko: 45,
  tinyfish: 180,
  twitter: 80,
  linkedin: 80,
  gdelt: 90,
};

const MODEL_RUNTIME_SECONDS: Record<string, number> = {
  venice_default: 48,
  venice_uncensored: 44,
  venice_mistral: 34,
  venice_glm: 46,
  openrouter_llama_70b: 52,
  openrouter_hermes: 56,
  openrouter_stepfun: 28,
  aisa: 24,
};

type MissionEvent = {
  name: string;
  payload: Record<string, unknown>;
};

const TELEMETRY_API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function emitMissionEvent(event: MissionEvent, sessionId?: string) {
  if (typeof window === 'undefined') return;
  const detail = { ...event, ts: new Date().toISOString() };
  window.dispatchEvent(new CustomEvent('trende:mission_event', { detail }));
  const body = JSON.stringify({
    name: event.name,
    payload: event.payload,
    session_id: sessionId,
    source: 'query_input',
    stage: typeof event.payload.stage === 'string' ? event.payload.stage : undefined,
  });
  const endpoint = `${TELEMETRY_API_BASE}/api/telemetry/mission-event`;
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    }
  } catch {
    // non-fatal telemetry failure
  }
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[trende:mission_event]', detail);
  }
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

export const MISSION_PROFILES = [
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
  const [platforms, setPlatforms] = useState<string[]>([...DEFAULT_PLATFORM_SELECTION]);
  const [models, setModels] = useState<string[]>([...DEFAULT_MODEL_SELECTION]);
  const [relevanceThreshold, setRelevanceThreshold] = useState(DEFAULT_THRESHOLD);
  const [composerStage, setComposerStage] = useState<ComposerStage>('directive');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [augmentation, setAugmentation] = useState<{ firecrawl: AugmentMode; synthdata: AugmentMode }>({
    firecrawl: DEFAULT_AUGMENTATION.firecrawl,
    synthdata: DEFAULT_AUGMENTATION.synthdata,
  });
  const [advancedSeen, setAdvancedSeen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('trende:advanced_controls_seen') === '1';
  });
  const [highlightSelections, setHighlightSelections] = useState(false);
  const mountTimeRef = useRef<number>(0);
  const submittedRef = useRef(false);
  const sessionIdRef = useRef<string>('anonymous');

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
  const routePreview = useMemo(() => {
    const rows: string[] = [];
    if (platforms.includes('web')) {
      const webFallbacks = [
        augmentation.firecrawl !== 'off' ? 'Firecrawl' : null,
        platforms.includes('tinyfish') ? 'TinyFish' : null,
      ].filter(Boolean);
      rows.push(`Web -> Tabstack${webFallbacks.length ? ` (+ ${webFallbacks.join(' / ')})` : ''}`);
    }
    if (platforms.includes('newsapi')) {
      rows.push(`News -> NewsAPI${augmentation.firecrawl !== 'off' ? ' (+ Firecrawl)' : ''}`);
    }
    if (platforms.includes('coingecko')) {
      rows.push(`CoinGecko -> CoinGecko${augmentation.synthdata !== 'off' ? ' (+ SynthData)' : ''}`);
    }
    return rows;
  }, [platforms, augmentation]);

  const markAdvancedSeen = useCallback(() => {
    setAdvancedSeen(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('trende:advanced_controls_seen', '1');
    }
  }, []);

  const openAdvancedWithHighlight = useCallback(() => {
    markAdvancedSeen();
    setComposerStage('setup');
    setShowAdvanced(true);
    setHighlightSelections(true);
    window.setTimeout(() => setHighlightSelections(false), 2600);
  }, [markAdvancedSeen]);
  const goToStage = useCallback((stage: ComposerStage) => {
    setComposerStage(stage);
    if (stage !== 'directive') {
      markAdvancedSeen();
      setShowAdvanced(true);
    }
  }, [markAdvancedSeen]);
  const effectiveShowAdvanced = composerStage !== 'directive' || showAdvanced;
  const runtimeEstimate = useMemo(() => {
    const sourceDurations = platforms.map((platform) => SOURCE_RUNTIME_SECONDS[platform] || 60);
    const modelDurations = models.map((model) => MODEL_RUNTIME_SECONDS[model] || 35);
    const maxSource = sourceDurations.length ? Math.max(...sourceDurations) : 0;
    const maxModel = modelDurations.length ? Math.max(...modelDurations) : 0;
    const base = 120;
    let minSeconds = base + maxSource * 0.8 + maxModel * 0.8 + platforms.length * 12 + models.length * 6;
    let maxSeconds = base + maxSource * 1.45 + maxModel * 1.5 + platforms.length * 26 + models.length * 12;

    if (platforms.includes('tinyfish')) {
      minSeconds += 60;
      maxSeconds += 160;
    }
    if (augmentation.firecrawl === 'on') {
      maxSeconds += 35;
    }
    if (augmentation.synthdata === 'on' && platforms.includes('coingecko')) {
      maxSeconds += 30;
    }
    if (Math.abs(relevanceThreshold - 0.8) < 0.001) {
      maxSeconds += 70;
    }

    return {
      minSeconds: Math.round(Math.max(minSeconds, 150)),
      maxSeconds: Math.round(Math.max(maxSeconds, minSeconds + 120)),
    };
  }, [platforms, models, augmentation.firecrawl, augmentation.synthdata, relevanceThreshold]);
  const defaultCost = useMemo(
    () => DEFAULT_MODEL_SELECTION.reduce((sum, model) => sum + (MODEL_OPTIONS.find((opt) => opt.id === model)?.cost || 0), 0),
    []
  );
  const defaultRuntimeEstimate = useMemo(() => {
    const sourceDurations = DEFAULT_PLATFORM_SELECTION.map((platform) => SOURCE_RUNTIME_SECONDS[platform] || 60);
    const modelDurations = DEFAULT_MODEL_SELECTION.map((model) => MODEL_RUNTIME_SECONDS[model] || 35);
    const maxSource = sourceDurations.length ? Math.max(...sourceDurations) : 0;
    const maxModel = modelDurations.length ? Math.max(...modelDurations) : 0;
    return {
      minSeconds: Math.round(120 + maxSource * 0.8 + maxModel * 0.8 + DEFAULT_PLATFORM_SELECTION.length * 12 + DEFAULT_MODEL_SELECTION.length * 6),
      maxSeconds: Math.round(120 + maxSource * 1.45 + maxModel * 1.5 + DEFAULT_PLATFORM_SELECTION.length * 26 + DEFAULT_MODEL_SELECTION.length * 12),
    };
  }, []);
  const runtimeDelta = runtimeEstimate.maxSeconds - defaultRuntimeEstimate.maxSeconds;
  const costDelta = totalCost - defaultCost;
  const configDiff = useMemo(() => {
    const sourceAdded = platforms.filter((platform) => !DEFAULT_PLATFORM_SELECTION.includes(platform as (typeof DEFAULT_PLATFORM_SELECTION)[number]));
    const sourceRemoved = DEFAULT_PLATFORM_SELECTION.filter((platform) => !platforms.includes(platform));
    const modelAdded = models.filter((model) => !DEFAULT_MODEL_SELECTION.includes(model as (typeof DEFAULT_MODEL_SELECTION)[number]));
    const modelRemoved = DEFAULT_MODEL_SELECTION.filter((model) => !models.includes(model));
    const thresholdChanged = Math.abs(relevanceThreshold - DEFAULT_THRESHOLD) > 0.001;
    const augmentationChanged =
      augmentation.firecrawl !== DEFAULT_AUGMENTATION.firecrawl ||
      augmentation.synthdata !== DEFAULT_AUGMENTATION.synthdata;
    const changesCount =
      sourceAdded.length +
      sourceRemoved.length +
      modelAdded.length +
      modelRemoved.length +
      (thresholdChanged ? 1 : 0) +
      (augmentationChanged ? 1 : 0);

    return {
      sourceAdded,
      sourceRemoved,
      modelAdded,
      modelRemoved,
      thresholdChanged,
      augmentationChanged,
      changesCount,
      isDefault: changesCount === 0,
    };
  }, [platforms, models, relevanceThreshold, augmentation.firecrawl, augmentation.synthdata]);
  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }, []);

  useEffect(() => {
    emitMissionEvent({
      name: 'composer_stage_view',
      payload: {
        stage: composerStage,
        sources: platforms.length,
        models: models.length,
        threshold: relevanceThreshold,
      },
    }, sessionIdRef.current);
  }, [composerStage, platforms.length, models.length, relevanceThreshold]);

  useEffect(() => {
    mountTimeRef.current = Date.now();
    try {
      const storageKey = 'trende:mission_session_id';
      const existing = window.localStorage.getItem(storageKey);
      const generated =
        existing ||
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? `mission-${crypto.randomUUID()}`
          : `mission-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      window.localStorage.setItem(storageKey, generated);
      sessionIdRef.current = generated;
    } catch {
      sessionIdRef.current = 'anonymous';
    }
  }, []);

  useEffect(() => {
    const startedAt = mountTimeRef.current;
    return () => {
      if (!submittedRef.current && idea.trim()) {
        emitMissionEvent({
          name: 'composer_dropoff',
          payload: {
            stage: composerStage,
            configuredSources: platforms.length,
            configuredModels: models.length,
            secondsInComposer: Math.round((Date.now() - startedAt) / 1000),
          },
        }, sessionIdRef.current);
      }
    };
  }, [composerStage, idea, platforms.length, models.length]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim() || isLoading || disabled || !hasPlatforms || !hasModels) return;
    submittedRef.current = true;
    emitMissionEvent({
      name: 'composer_submit',
      payload: {
        stage: composerStage,
        sources: platforms.length,
        models: models.length,
        threshold: relevanceThreshold,
        estimatedMinSeconds: runtimeEstimate.minSeconds,
        estimatedMaxSeconds: runtimeEstimate.maxSeconds,
        projectedCostEth: totalCost,
        secondsInComposer: Math.round((Date.now() - mountTimeRef.current) / 1000),
      },
    }, sessionIdRef.current);
    onSubmit({ idea: idea.trim(), platforms, models, relevanceThreshold, augmentation });
  }, [
    idea,
    isLoading,
    disabled,
    hasPlatforms,
    hasModels,
    composerStage,
    platforms,
    models,
    relevanceThreshold,
    runtimeEstimate.minSeconds,
    runtimeEstimate.maxSeconds,
    totalCost,
    onSubmit,
    augmentation,
  ]);

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
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Mission Stages</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToStage('directive')}
                  className={cn(
                    "px-2 py-1 rounded border text-[10px] font-black uppercase tracking-widest transition-all",
                    composerStage === 'directive' ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300" : "border-white/10 text-[var(--text-muted)]"
                  )}
                >
                  1 Directive
                </button>
                <button
                  type="button"
                  onClick={() => goToStage('setup')}
                  className={cn(
                    "px-2 py-1 rounded border text-[10px] font-black uppercase tracking-widest transition-all",
                    composerStage === 'setup' ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300" : "border-white/10 text-[var(--text-muted)]",
                    !advancedSeen && "animate-pulse"
                  )}
                >
                  2 Advanced Setup
                </button>
                <button
                  type="button"
                  onClick={() => goToStage('launch')}
                  className={cn(
                    "px-2 py-1 rounded border text-[10px] font-black uppercase tracking-widest transition-all",
                    composerStage === 'launch' ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-[var(--text-muted)]"
                  )}
                >
                  3 Launch
                </button>
              </div>
            </div>

            {composerStage === 'directive' && (
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
            </div>
          </div>

          {composerStage === 'directive' && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl px-6"
                disabled={!idea.trim() || disabled}
                onClick={() => goToStage('setup')}
              >
                Continue to Advanced Setup
              </Button>
            </div>
          )}

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
                <p className="text-[10px] font-mono text-[var(--text-secondary)] mt-1">
                  Augmentation: firecrawl={augmentation.firecrawl}, synthdata={augmentation.synthdata}
                </p>
              </div>
            </div>
          </div>

          {effectiveShowAdvanced && (
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
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">Execution Preview</p>
                  <div className="glass border border-white/10 rounded-xl p-3">
                    {routePreview.length === 0 ? (
                      <p className="text-[10px] font-mono text-[var(--text-muted)]">Select at least one source route to preview primary/fallback lanes.</p>
                    ) : (
                      <div className="space-y-1">
                        {routePreview.map((row) => (
                          <p key={row} className="text-[10px] font-mono text-[var(--text-secondary)]">{row}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center">
                    <Rocket className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Augmentation Sources</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl glass border border-white/10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">Firecrawl</p>
                    <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">Broad web/news crawling fallback for sparse routes.</p>
                    <div className="mt-3 flex gap-2">
                      {(['auto', 'on', 'off'] as AugmentMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={disabled}
                          onClick={() => setAugmentation((prev) => ({ ...prev, firecrawl: mode }))}
                          className={cn(
                            "px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded border transition-all",
                            augmentation.firecrawl === mode ? "border-cyan-500/60 text-cyan-300 bg-cyan-500/10" : "border-white/10 text-[var(--text-muted)]"
                          )}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl glass border border-white/10">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">SynthData</p>
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 uppercase font-black tracking-widest">Market</span>
                    </div>
                    <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">Financial enrichment for market-oriented missions.</p>
                    <div className="mt-3 flex gap-2">
                      {(['auto', 'on', 'off'] as AugmentMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={disabled}
                          onClick={() => setAugmentation((prev) => ({ ...prev, synthdata: mode }))}
                          className={cn(
                            "px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded border transition-all",
                            augmentation.synthdata === mode ? "border-emerald-500/60 text-emerald-300 bg-emerald-500/10" : "border-white/10 text-[var(--text-muted)]"
                          )}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
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
                <div className="relative flex items-center">
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

              {composerStage === 'setup' && (
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-xl px-6"
                    disabled={disabled || !hasPlatforms || !hasModels}
                    onClick={() => goToStage('launch')}
                  >
                    Review and Launch
                  </Button>
                </div>
              )}

              {composerStage === 'launch' && (
                <div className="space-y-4 pt-6 border-t border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Mission Receipt</p>
                  <div className="glass border border-white/10 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="glass border border-white/10 rounded-xl p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Directive</p>
                        <p className="text-xs font-mono text-[var(--text-primary)] mt-2 line-clamp-4">{idea.trim() || "No directive set"}</p>
                      </div>
                      <div className="glass border border-white/10 rounded-xl p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Configuration Status</p>
                        <p className="text-xs font-mono text-[var(--text-primary)] mt-2">
                          {configDiff.isDefault ? "Using defaults" : `Customized (${configDiff.changesCount} changes)`}
                        </p>
                        {!configDiff.isDefault && (
                          <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                            {configDiff.sourceAdded.length > 0 ? `+${configDiff.sourceAdded.length} source(s) ` : ""}
                            {configDiff.sourceRemoved.length > 0 ? `-${configDiff.sourceRemoved.length} source(s) ` : ""}
                            {configDiff.modelAdded.length > 0 ? `+${configDiff.modelAdded.length} model(s) ` : ""}
                            {configDiff.modelRemoved.length > 0 ? `-${configDiff.modelRemoved.length} model(s)` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="glass border border-white/10 rounded-xl p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Sources + Fallbacks</p>
                        <p className="text-xs font-mono text-[var(--text-primary)] mt-2">{platforms.join(", ")}</p>
                        <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                          Firecrawl: {augmentation.firecrawl} • SynthData: {augmentation.synthdata}
                        </p>
                      </div>
                      <div className="glass border border-white/10 rounded-xl p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Consensus Models</p>
                        <p className="text-xs font-mono text-[var(--text-primary)] mt-2">{models.join(", ")}</p>
                        <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                          Threshold: {Math.round(relevanceThreshold * 100)}%
                        </p>
                      </div>
                      <div className="glass border border-white/10 rounded-xl p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Estimated Runtime</p>
                        <p className="text-xs font-mono text-[var(--text-primary)] mt-2">
                          {formatDuration(runtimeEstimate.minSeconds)} - {formatDuration(runtimeEstimate.maxSeconds)}
                        </p>
                        <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                          {runtimeDelta >= 0 ? "+" : ""}{formatDuration(Math.abs(runtimeDelta))} vs default
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="glass border border-white/10 rounded-xl p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Projected Cost (Internal)</p>
                        <p className="text-xs font-mono text-amber-300 mt-2">{totalCost.toFixed(4)} ETH</p>
                        <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">
                          {costDelta >= 0 ? "+" : ""}{costDelta.toFixed(4)} ETH vs default
                        </p>
                      </div>
                      <div className="glass border border-white/10 rounded-xl p-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">User Billing</p>
                        <p className="text-xs font-mono text-emerald-300 mt-2">$0.00 (Beta)</p>
                        <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1">Final step is payment-ready for monetization rollout.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-xl px-6"
                      onClick={() => goToStage('setup')}
                      disabled={disabled || isLoading}
                    >
                      Tweak Setup
                    </Button>
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
              )}
            </div>
          )}


        </form>
      </Card>
    </div>
  );
}
