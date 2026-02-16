'use client';

import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Shield, 
  Users,
  Link2,
  AlertTriangle,
  Info
} from 'lucide-react';

interface ConfidenceData {
  score: number;
  sources: number;
  crossReferences: number;
  diversity: 'low' | 'medium' | 'high';
  warnings?: string[];
  providerCount?: number;
  agreementScore?: number;
}

interface ConfidenceVisualizerProps {
  data: ConfidenceData;
  expanded?: boolean;
}

export function ConfidenceVisualizer({ data, expanded = false }: ConfidenceVisualizerProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const [showDetails, setShowDetails] = useState(expanded);
  const [animatedScore, setAnimatedScore] = useState(0);

  // Animate score counting up
  useEffect(() => {
    const duration = 1000;
    const startTime = Date.now();
    const startValue = 0;
    const endValue = data.score;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = Math.round(startValue + (endValue - startValue) * easeProgress);
      
      setAnimatedScore(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [data.score]);

  // Animate progress bar
  useEffect(() => {
    if (!barRef.current) return;

    gsap.fromTo(
      barRef.current,
      { width: '0%' },
      { width: `${data.score}%`, duration: 1, ease: 'power3.out' }
    );
  }, [data.score]);

  // Color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', bgLight: 'bg-emerald-500/10' };
    if (score >= 60) return { bg: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500/30', bgLight: 'bg-cyan-500/10' };
    if (score >= 40) return { bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30', bgLight: 'bg-amber-500/10' };
    return { bg: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500/30', bgLight: 'bg-rose-500/10' };
  };

  const colors = getScoreColor(data.score);

  // Diversity indicator
  const diversityConfig = {
    low: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: AlertTriangle },
    medium: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: Info },
    high: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle2 },
  };

  const diversity = diversityConfig[data.diversity];
  const DiversityIcon = diversity.icon;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 overflow-hidden">
      {/* Header with score */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Confidence Score</span>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showDetails ? 'Less' : 'Why this score?'}
          </button>
        </div>

        {/* Big score display */}
        <div className="flex items-end gap-3 mb-3">
          <span 
            ref={scoreRef}
            className={`text-5xl font-bold ${colors.text} tabular-nums`}
          >
            {animatedScore}
          </span>
          <span className="text-2xl text-slate-600 mb-1">%</span>
          <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-full border border-slate-700 bg-slate-900">
            <TrendingUp className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-400">Conviction</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            ref={barRef}
            className={`h-full ${colors.bg} rounded-full relative`}
            style={{ width: '0%' }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>

        {/* Score interpretation */}
        <p className="mt-2 text-xs text-slate-500">
          {data.score >= 80 && "Strong signal convergence across multiple independent sources."}
          {data.score >= 60 && data.score < 80 && "Good consensus with moderate cross-validation."}
          {data.score >= 40 && data.score < 60 && "Mixed signals. Review individual sources."}
          {data.score < 40 && "Weak consensus. Consider refining your query."}
        </p>
      </div>

      {/* Expandable details */}
      <div className={`
        overflow-hidden transition-all duration-500 ease-out
        ${showDetails ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
      `}>
        <div className="p-4 space-y-3 border-t border-slate-800">
          {/* Metrics grid */}
          <div className="grid grid-cols-3 gap-2">
            <MetricCard
              icon={Users}
              value={data.sources}
              label="Sources"
              color="cyan"
            />
            <MetricCard
              icon={Link2}
              value={data.crossReferences}
              label="Cross-refs"
              color="emerald"
            />
            <MetricCard
              icon={diversity.icon}
              value={data.diversity}
              label="Diversity"
              color={data.diversity === 'high' ? 'emerald' : data.diversity === 'medium' ? 'cyan' : 'amber'}
            />
          </div>

          {/* Provider consensus */}
          {data.providerCount && data.providerCount > 0 && (
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Model Consensus</span>
                <span className="text-xs font-medium text-slate-300">{data.providerCount} providers</span>
              </div>
              {data.agreementScore && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
                      style={{ width: `${data.agreementScore}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-emerald-400">{Math.round(data.agreementScore)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Warnings */}
          {data.warnings && data.warnings.length > 0 && (
            <div className="space-y-2">
              {data.warnings.map((warning, i) => (
                <div 
                  key={i}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200">{warning}</p>
                </div>
              ))}
            </div>
          )}

          {/* Score breakdown */}
          <div className="pt-2 border-t border-slate-800">
            <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">Score Factors</p>
            <div className="space-y-1.5">
              <FactorBar label="Source diversity" value={data.diversity === 'high' ? 100 : data.diversity === 'medium' ? 60 : 30} />
              <FactorBar label="Cross-validation" value={Math.min(data.crossReferences * 10, 100)} />
              <FactorBar label="Signal strength" value={data.score} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ 
  icon: Icon, 
  value, 
  label, 
  color 
}: { 
  icon: React.ElementType; 
  value: string | number; 
  label: string; 
  color: 'cyan' | 'emerald' | 'amber' | 'rose';
}) {
  const colorMap = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className={`p-3 rounded-xl border ${colorMap[color]} text-center`}>
      <Icon className="w-4 h-4 mx-auto mb-1.5 opacity-80" />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
    </div>
  );
}

function FactorBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-28">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-slate-600 rounded-full transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{value}%</span>
    </div>
  );
}

// Compact badge version
export function ConfidenceBadge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (s >= 60) return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    if (s >= 40) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${getColor(score)}`}>
      <Shield className="w-3 h-3" />
      {score}% confidence
    </div>
  );
}
