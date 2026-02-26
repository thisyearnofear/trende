"use client";

import { Card, Button } from "@/components/DesignSystem";

interface AgentReply {
  q: string;
  a: string;
  citations: string[];
  ts: number;
}

interface AskTrendeProps {
  agentPrompt: string;
  setAgentPrompt: (prompt: string) => void;
  agentReplies: AgentReply[];
  onAsk: (seed?: string) => void;
  suggestions: string[];
}

export function AskTrende({
  agentPrompt,
  setAgentPrompt,
  agentReplies,
  onAsk,
  suggestions,
}: AskTrendeProps) {
  return (
    <Card accent="emerald" className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-emerald)]">
          Ask Trende
        </p>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">
          Interactive run copilot
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onAsk(s)}
                className="px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={agentPrompt}
              onChange={(e) => setAgentPrompt(e.target.value)}
              placeholder="Ask about disagreement, sources, confidence, or next steps..."
              className="flex-1 px-3 py-2 text-xs font-mono border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
            />
            <Button variant="primary" size="sm" onClick={() => onAsk()}>
              Ask
            </Button>
          </div>
        </div>
        <div className="border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 max-h-44 overflow-auto space-y-2">
          {agentReplies.length === 0 ? (
            <p className="text-[11px] font-mono text-[var(--text-muted)]">
              Ask Trende to parse this run and extract specific signals.
            </p>
          ) : (
            agentReplies.map((row) => (
              <div key={row.ts} className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">{row.q}</p>
                <p className="text-[11px] font-mono text-[var(--text-secondary)]">{row.a}</p>
                {row.citations?.length > 0 && (
                  <p className="text-[10px] font-mono text-[var(--text-muted)]">
                    {row.citations.join(" ")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
