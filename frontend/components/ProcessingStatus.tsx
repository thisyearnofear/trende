'use client';

import { useMemo } from 'react';
import { StreamEvent, QueryStatus } from '@/lib/types';
import { Terminal, Fingerprint, CheckCircle2, Circle } from 'lucide-react';
import { TerminalLog } from './TypewriterText';
import { AgentPersona } from './AgentPersona';
import { Card, Progress } from './DesignSystem';

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

export function ProcessingStatus({ progress, events, isProcessing }: ProcessingStatusProps) {
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
      <AgentPersona status={getAgentStatus()} progress={progress} />

      {/* Main Processing Card */}
      <Card accent="cyan" shadow="lg">
        {/* Header */}
        <div className="border-b-2 border-[var(--border-color)] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center" style={{ backgroundColor: 'var(--accent-cyan)' }}>
              <Fingerprint className="w-5 h-5 text-[var(--bg-primary)]" />
            </div>
            <div>
              <h3 className="font-black uppercase tracking-wider">TEE Processing</h3>
              <p className="text-xs font-mono text-[var(--accent-cyan)]">EigenCompute Secure Enclave</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-[var(--accent-cyan)]">{progress}%</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="p-4 border-b-2 border-[var(--border-color)]">
          <Progress value={progress} accent="cyan" />
        </div>

        {/* Stages */}
        <div className="p-4 border-b-2 border-[var(--border-color)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STAGES.map((stage, index) => {
              const isComplete = index < currentStageIndex;
              const isActive = index === currentStageIndex;
              
              return (
                <div
                  key={stage.id}
                  className="p-3 border-2 min-h-[80px]"
                  style={{
                    borderColor: isComplete ? 'var(--accent-emerald)' : isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    backgroundColor: isComplete ? 'rgba(0, 255, 136, 0.1)' : isActive ? 'rgba(0, 255, 255, 0.1)' : 'var(--bg-primary)',
                    boxShadow: isComplete ? '2px 2px 0px 0px var(--accent-emerald)' : isActive ? '2px 2px 0px 0px var(--accent-cyan)' : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--accent-emerald)]" />
                    ) : isActive ? (
                      <div className="w-4 h-4 animate-pulse" style={{ backgroundColor: 'var(--accent-cyan)' }} />
                    ) : (
                      <Circle className="w-4 h-4 text-[var(--text-muted)]" />
                    )}
                    <span className="text-xs font-black uppercase" style={{ color: isComplete ? 'var(--accent-emerald)' : isActive ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                      {stage.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">{stage.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Terminal */}
        {terminalEvents.length > 0 && (
          <div className="p-4">
            <div className="border-2 bg-[var(--bg-primary)]" style={{ borderColor: 'var(--text-muted)' }}>
              <div className="flex items-center gap-2 px-3 py-2 border-b-2 bg-[var(--bg-secondary)]" style={{ borderColor: 'var(--text-muted)' }}>
                <Terminal className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span className="text-[10px] font-mono text-[var(--text-muted)]">TEE_TELEMETRY.LOG</span>
              </div>
              <div className="p-3">
                <TerminalLog events={terminalEvents} maxHeight="100px" className="text-xs" />
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
