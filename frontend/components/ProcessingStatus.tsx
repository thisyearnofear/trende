'use client';

import { useMemo } from 'react';
import { StreamEvent, QueryStatus } from '@/lib/types';
import { Terminal, Fingerprint, Bot, CheckCircle2, Circle } from 'lucide-react';
import { TerminalLog } from './TypewriterText';
import { AgentPersona } from './AgentPersona';

interface ProcessingStatusProps {
  status: QueryStatus | null;
  progress: number;
  events: StreamEvent[];
  isProcessing: boolean;
}

const STAGES = [
  { id: 'planner', label: 'PLAN', description: 'Strategy & Source Selection' },
  { id: 'researcher', label: 'HARVEST', description: 'Multi-Platform Data Collection' },
  { id: 'validator', label: 'VALIDATE', description: 'Cross-Reference & Confidence' },
  { id: 'architect', label: 'ATTEST', description: 'TEE Signing & Output' },
];

export function ProcessingStatus({ status, progress, events, isProcessing }: ProcessingStatusProps) {
  const currentStageIndex = Math.min(Math.floor((progress / 100) * STAGES.length), STAGES.length - 1);

  const terminalEvents = useMemo(() => {
    return events.slice(-6).map((event, index) => ({
      id: `${event.type}-${index}-${event.message?.slice(0, 20) || ''}`,
      message: event.message || '',
      type: (event.type === 'error' ? 'error' : event.type === 'result' ? 'success' : 'info') as 'error' | 'success' | 'info',
    }));
  }, [events]);

  const getAgentStatus = () => {
    if (!isProcessing) return 'idle';
    if (progress < 10) return 'thinking';
    if (progress < 100) return 'processing';
    return 'complete';
  };

  return (
    <div className="space-y-4">
      {/* Trende Agent */}
      <AgentPersona status={getAgentStatus()} progress={progress} currentStage={status || undefined} />

      {/* Main Processing Card */}
      <div className="bg-[#141414] border-2 border-white" style={{ boxShadow: '6px 6px 0px 0px #00ffff' }}>
        {/* Header */}
        <div className="border-b-2 border-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#00ffff] flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="font-black uppercase tracking-wider text-white">TEE Processing</h3>
              <p className="text-xs font-mono text-[#00ffff]">EigenCompute Secure Enclave</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-[#00ffff]">{progress}%</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="p-4 border-b-2 border-white">
          <div className="w-full h-6 bg-[#0a0a0a] border-2 border-white">
            <div
              className="h-full bg-[#00ffff] border-r-2 border-white transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stages */}
        <div className="p-4 border-b-2 border-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STAGES.map((stage, index) => {
              const isComplete = index < currentStageIndex;
              const isActive = index === currentStageIndex;
              
              return (
                <div
                  key={stage.id}
                  className={`p-3 border-2 transition-colors ${
                    isComplete ? 'border-[#00ff88] bg-[#00ff88]/10' :
                    isActive ? 'border-[#00ffff] bg-[#00ffff]/10' :
                    'border-gray-700 bg-[#0a0a0a]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />
                    ) : isActive ? (
                      <div className="w-4 h-4 bg-[#00ffff] animate-pulse" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-600" />
                    )}
                    <span className={`text-xs font-black uppercase ${
                      isComplete ? 'text-[#00ff88]' :
                      isActive ? 'text-[#00ffff]' :
                      'text-gray-600'
                    }`}>
                      {stage.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono">{stage.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Terminal */}
        {terminalEvents.length > 0 && (
          <div className="p-4">
            <div className="border-2 border-gray-700 bg-[#0a0a0a]">
              <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-gray-700 bg-[#141414]">
                <Terminal className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-[10px] font-mono text-gray-500">TEE_TELEMETRY.LOG</span>
              </div>
              <div className="p-3">
                <TerminalLog events={terminalEvents} maxHeight="100px" className="text-xs" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
