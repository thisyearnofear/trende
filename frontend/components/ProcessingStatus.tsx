'use client';

import { useMemo } from 'react';
import { StreamEvent, QueryStatus } from '@/lib/types';
import { Terminal, Fingerprint } from 'lucide-react';
import { TerminalLog } from './TypewriterText';
import { PipelineStages } from './PipelineStages';
import { GlassContainer } from './GlassContainer';
import { AgentPersona } from './AgentPersona';

interface ProcessingStatusProps {
  status: QueryStatus | null;
  progress: number;
  events: StreamEvent[];
  isProcessing: boolean;
}

export function ProcessingStatus({ status, progress, events, isProcessing }: ProcessingStatusProps) {
  if (!isProcessing && status !== 'processing') {
    return null;
  }

  // Convert StreamEvents to TerminalEvents for the typewriter effect
  const terminalEvents = useMemo(() => {
    return events.slice(-6).map((event, index) => {
      const type: 'error' | 'success' | 'info' = 
        event.type === 'error' ? 'error' : 
        event.type === 'result' ? 'success' : 
        'info';
      return {
        id: `${event.type}-${index}-${event.message?.slice(0, 20) || ''}`,
        message: event.message || '',
        type,
      };
    });
  }, [events]);

  // Determine agent status based on processing state
  const getAgentStatus = () => {
    if (!isProcessing) return 'idle';
    if (progress < 10) return 'thinking';
    if (progress < 100) return 'processing';
    return 'complete';
  };

  return (
    <div className="space-y-4">
      {/* Trende Agent Persona */}
      <AgentPersona 
        status={getAgentStatus()}
        progress={progress}
        currentStage={status || undefined}
      />

      <GlassContainer 
        variant="processing" 
        title="Secure Pipeline"
        subtitle="TEE-Protected Execution"
        className="overflow-visible"
      >
        {/* Progress Header */}
        <div className="px-6 py-4 border-b border-white/5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Fingerprint className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">Processing in TEE</h3>
                <p className="text-sm text-slate-400 mt-0.5">EigenCompute secure enclave</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-bold text-cyan-300">{progress}%</div>
              <div className="text-xs text-slate-500">Complete</div>
            </div>
          </div>

          {/* Progress bar with shimmer */}
          <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
            <div 
              className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
              style={{ 
                left: `${progress - 10}%`,
                opacity: progress > 10 && progress < 90 ? 1 : 0,
              }}
            />
          </div>
        </div>

        {/* Pipeline Stages */}
        <div className="p-6">
          <PipelineStages 
            status={status} 
            progress={progress} 
            isProcessing={isProcessing} 
          />
        </div>

        {/* Terminal Telemetry */}
        {terminalEvents.length > 0 && (
          <div className="px-6 pb-6">
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900/50">
                <Terminal className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Live Telemetry</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <Fingerprint className="w-3 h-3 text-cyan-500/50" />
                  <span className="text-[10px] text-cyan-500/50">TEE-Logged</span>
                </div>
              </div>
              <div className="p-4">
                <TerminalLog 
                  events={terminalEvents} 
                  maxHeight="120px"
                  className="text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </GlassContainer>
    </div>
  );
}
