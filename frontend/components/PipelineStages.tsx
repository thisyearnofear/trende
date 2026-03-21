'use client';

import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { 
  Compass, 
  Search, 
  ShieldCheck, 
  Blocks, 
  CheckCircle2,
  ChevronRight,
  Cpu,
  Fingerprint
} from 'lucide-react';
import { QueryStatus } from '@/lib/types';

interface Stage {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  details: string[];
  proofAction?: string;
}

const STAGES: Stage[] = [
  { 
    id: 'planner', 
    label: 'Planner', 
    icon: Compass, 
    description: 'Selecting the best worlds and strategy.',
    details: ['Analyzing query intent', 'Selecting data sources', 'Optimizing search strategy'],
    proofAction: 'Strategy checkpointed',
  },
  { 
    id: 'researcher', 
    label: 'Researcher', 
    icon: Search, 
    description: 'Harvesting multi-source signal and citations.',
    details: ['Querying Twitter/X API', 'Searching news sources', 'Extracting web content'],
    proofAction: 'Data ingress normalized',
  },
  { 
    id: 'validator', 
    label: 'Validator', 
    icon: ShieldCheck, 
    description: 'Cross-checking claims and confidence.',
    details: ['Cross-referencing sources', 'Calculating confidence scores', 'Detecting bias patterns'],
    proofAction: 'Validation sealed',
  },
  { 
    id: 'architect', 
    label: 'Architect', 
    icon: Blocks, 
    description: 'Structuring research output and attestations.',
    details: ['Synthesizing consensus', 'Generating attestations', 'Preparing outputs'],
    proofAction: 'Proof signed',
  },
];

interface PipelineStagesProps {
  status: QueryStatus | null;
  progress: number;
  isProcessing: boolean;
}

export function PipelineStages({ progress, isProcessing }: PipelineStagesProps) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const currentStageIndex = Math.min(
    Math.floor((progress / 100) * STAGES.length),
    STAGES.length - 1
  );

  // Auto-expand current stage
  useEffect(() => {
    if (isProcessing && currentStageIndex >= 0) {
      const currentStage = STAGES[currentStageIndex];
      // Use requestAnimationFrame to avoid synchronous setState during render/effect cycle
      requestAnimationFrame(() => {
        setExpandedStage(currentStage.id);
      });
    }
  }, [currentStageIndex, isProcessing]);

  // Animate stage transitions
  useEffect(() => {
    STAGES.forEach((stage, index) => {
      const el = stageRefs.current.get(stage.id);
      if (!el) return;

      const isComplete = index < currentStageIndex;
      const isActive = index === currentStageIndex;

      if (isComplete) {
        gsap.to(el, {
          borderColor: 'rgba(16, 185, 129, 0.4)',
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          duration: 0.4,
          ease: 'power2.out',
        });
      } else if (isActive) {
        gsap.to(el, {
          borderColor: 'rgba(6, 182, 212, 0.5)',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          boxShadow: '0 0 30px rgba(6, 182, 212, 0.15)',
          duration: 0.4,
          ease: 'power2.out',
        });
      }
    });
  }, [currentStageIndex]);

  const handleStageClick = (stageId: string) => {
    setExpandedStage(expandedStage === stageId ? null : stageId);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Pipeline connector line */}
      <div className="absolute top-8 left-0 right-0 h-0.5 bg-slate-800 hidden sm:block">
        <div 
          className="h-full bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stages grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative">
        {STAGES.map((stage, index) => {
          const StageIcon = stage.icon;
          const isComplete = index < currentStageIndex;
          const isActive = index === currentStageIndex;
          const isExpanded = expandedStage === stage.id;
          const isHovered = hoveredStage === stage.id;

          return (
            <div
              key={stage.id}
              ref={(el) => {
                if (el) stageRefs.current.set(stage.id, el);
              }}
              onClick={() => handleStageClick(stage.id)}
              onMouseEnter={() => setHoveredStage(stage.id)}
              onMouseLeave={() => setHoveredStage(null)}
              className={`
                relative rounded-2xl border p-4 cursor-pointer
                transition-all duration-300 overflow-hidden
                ${isComplete 
                  ? 'border-emerald-500/30 bg-emerald-500/5' 
                  : isActive 
                    ? 'border-cyan-500/40 bg-cyan-500/10 shadow-lg shadow-cyan-500/10' 
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }
              `}
              style={{
                clipPath: isExpanded 
                  ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' 
                  : undefined,
              }}
            >
              {/* Stage number */}
              <div className={`
                absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                ${isComplete 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : isActive 
                    ? 'bg-cyan-500/20 text-cyan-400' 
                    : 'bg-slate-700 text-slate-500'
                }
              `}>
                {isComplete ? <CheckCircle2 className="w-3 h-3" /> : index + 1}
              </div>

              {/* Icon */}
              <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center mb-3
                ${isComplete 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : isActive 
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' 
                    : 'bg-slate-700 text-slate-500'
                }
                ${isActive ? 'animate-pulse' : ''}
              `}>
                <StageIcon className="w-5 h-5" />
              </div>

              {/* Label */}
              <h4 className={`
                text-sm font-semibold mb-1
                ${isComplete 
                  ? 'text-emerald-300' 
                  : isActive 
                    ? 'text-cyan-200' 
                    : 'text-slate-400'
                }
              `}>
                {stage.label}
              </h4>

              {/* Short description */}
              <p className="text-xs text-slate-500 line-clamp-2">
                {stage.description}
              </p>

              {/* Expand indicator */}
              <div className={`
                mt-2 flex items-center gap-1 text-[10px] transition-all duration-300
                ${isHovered || isExpanded ? 'text-cyan-400' : 'text-slate-600'}
              `}>
                <span>{isExpanded ? 'Less' : 'Details'}</span>
                <ChevronRight className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
              </div>

              {/* Expanded details with clip-path animation */}
              <div 
                className={`
                  overflow-hidden transition-all duration-500 ease-out
                  ${isExpanded ? 'max-h-40 opacity-100 mt-3 pt-3 border-t border-slate-700/50' : 'max-h-0 opacity-0'}
                `}
              >
                {/* Proof action badge */}
                {stage.proofAction && (
                  <div className="flex items-center gap-1.5 mb-3 px-2 py-1 rounded-lg bg-slate-950/50 border border-slate-800">
                    <Fingerprint className="w-3 h-3 text-cyan-400" />
                    <span className="text-[10px] text-cyan-400 font-medium">{stage.proofAction}</span>
                  </div>
                )}

                {/* Detail steps */}
                <ul className="space-y-1.5">
                  {stage.details.map((detail, i) => (
                    <li 
                      key={i} 
                      className={`
                        flex items-start gap-2 text-xs
                        ${isComplete || (isActive && i <= currentStageIndex % 3) 
                          ? 'text-slate-300' 
                          : 'text-slate-600'
                        }
                      `}
                      style={{
                        transitionDelay: isExpanded ? `${i * 50}ms` : '0ms',
                      }}
                    >
                      <div className={`
                        w-1 h-1 rounded-full mt-1.5 shrink-0
                        ${isComplete ? 'bg-emerald-400' : isActive ? 'bg-cyan-400' : 'bg-slate-600'}
                      `} />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Active indicator line */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
              )}
            </div>
          );
        })}
      </div>

      {/* Proof status footer */}
      <div className="mt-4 flex items-center justify-between px-4 py-3 rounded-xl bg-slate-950/50 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300">Hetzner Runtime</p>
            <p className="text-[10px] text-slate-500">Server-side proof environment</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">Active</span>
        </div>
      </div>
    </div>
  );
}
