'use client';

import { StreamEvent, QueryStatus } from '@/lib/types';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Compass,
  Search,
  ShieldCheck,
  Blocks,
} from 'lucide-react';

interface ProcessingStatusProps {
  status: QueryStatus | null;
  progress: number;
  events: StreamEvent[];
  isProcessing: boolean;
}

const STAGES = [
  { id: 'planner', label: 'Planner', icon: Compass, description: 'Selecting the best worlds and strategy.' },
  { id: 'researcher', label: 'Researcher', icon: Search, description: 'Harvesting multi-source signal and citations.' },
  { id: 'validator', label: 'Validator', icon: ShieldCheck, description: 'Cross-checking claims and confidence.' },
  { id: 'architect', label: 'Architect', icon: Blocks, description: 'Structuring output for Forge and Launchpad.' },
];

export function ProcessingStatus({ status, progress, events, isProcessing }: ProcessingStatusProps) {
  if (!isProcessing && status !== 'processing') {
    return null;
  }

  const currentStageIndex = Math.min(
    Math.floor((progress / 100) * STAGES.length),
    STAGES.length - 1
  );

  const currentStage = STAGES[currentStageIndex];
  const recentEvents = events.slice(-6);

  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-900/75 p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 bg-cyan-600 rounded-2xl flex items-center justify-center shrink-0">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">Agentic Pipeline Running</h3>
            <p className="text-sm text-slate-400 mt-1">{currentStage.description}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-cyan-300">{progress}%</div>
          <div className="text-xs text-slate-500">Mission complete</div>
        </div>
      </div>

      <div className="mb-6">
        <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
        {STAGES.map((stage, index) => {
          const isActive = index === currentStageIndex;
          const isComplete = index < currentStageIndex;
          const StageIcon = stage.icon;

          return (
            <div key={stage.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-center">
              <div
                className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center transition-all ${
                  isComplete
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : isActive
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 text-slate-500'
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <StageIcon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />
                )}
              </div>
              <p className={`text-xs ${isActive ? 'text-cyan-200 font-medium' : 'text-slate-500'}`}>
                {stage.label}
              </p>
            </div>
          );
        })}
      </div>

      {recentEvents.length > 0 && (
        <div className="border-t border-slate-700 pt-4">
          <h4 className="text-xs font-semibold tracking-wide text-slate-500 mb-2">Live Telemetry</h4>
          <div className="space-y-2">
            {recentEvents.map((event, index) => (
              <div
                key={index}
                className={`flex items-start gap-2 text-sm ${
                  event.type === 'error' ? 'text-red-400' : 'text-slate-300'
                }`}
              >
                {event.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin" />
                )}
                <span>{event.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
