'use client';

import { StreamEvent, QueryStatus } from '@/lib/types';
import { Loader2, CheckCircle2, AlertCircle, Zap, Search, Brain, FileText } from 'lucide-react';

interface ProcessingStatusProps {
  status: QueryStatus | null;
  progress: number;
  events: StreamEvent[];
  isProcessing: boolean;
}

const STAGES = [
  { id: 'planning', label: 'Planning', icon: Zap, description: 'Analyzing query' },
  { id: 'researching', label: 'Researching', icon: Search, description: 'Searching platforms' },
  { id: 'analyzing', label: 'Analyzing', icon: Brain, description: 'Processing results' },
  { id: 'synthesizing', label: 'Synthesizing', icon: FileText, description: 'Generating report' },
];

export function ProcessingStatus({ status, progress, events, isProcessing }: ProcessingStatusProps) {
  if (!isProcessing && status !== 'processing') {
    return null;
  }

  // Determine current stage based on progress
  const currentStageIndex = Math.min(
    Math.floor((progress / 100) * STAGES.length),
    STAGES.length - 1
  );

  const currentStage = STAGES[currentStageIndex];

  // Get recent events
  const recentEvents = events.slice(-5);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-600 rounded-full flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">Analyzing Trends</h3>
            <p className="text-sm text-slate-400">
              {currentStage.description}...
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-cyan-300">{progress}%</div>
          <div className="text-xs text-slate-500">Complete</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stage Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
        {STAGES.map((stage, index) => {
          const isActive = index === currentStageIndex;
          const isComplete = index < currentStageIndex;
          const StageIcon = stage.icon;

          return (
            <div key={stage.id} className="flex flex-col items-center text-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all ${
                  isComplete
                    ? 'bg-green-500/20 text-green-400'
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
              <span
                className={`text-xs ${
                  isActive ? 'text-cyan-300 font-medium' : 'text-slate-500'
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <div className="border-t border-slate-700 pt-4">
          <h4 className="text-xs font-medium text-slate-500 mb-2">Live Updates</h4>
          <div className="space-y-2">
            {recentEvents.map((event, index) => (
              <div
                key={index}
                className={`flex items-start gap-2 text-sm ${
                  event.type === 'error' ? 'text-red-400' : 'text-slate-400'
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
