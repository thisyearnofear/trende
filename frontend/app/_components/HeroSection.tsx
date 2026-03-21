"use client";

import { Card } from "@/components/DesignSystem";
import { GlowText, ScrambleWords, ScrambleText } from "@/components/ScrambleText";
import { Fingerprint, Bot } from "lucide-react";

export function HeroSection() {
  return (
    <Card accent="cyan" shadow="lg" className="p-6 overflow-hidden relative">
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <Fingerprint className="w-5 h-5 text-[var(--accent-cyan)]" />
          <GlowText text="SOURCE-BACKED INTELLIGENCE" className="text-xs font-mono" color="cyan" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-3">
          <ScrambleWords
            words={[
              { text: 'What', highlight: false },
              { text: 'Is', highlight: false },
              { text: 'the', highlight: false },
              { text: 'Market', highlight: true },
              { text: 'Really', highlight: false },
              { text: 'Thinking?', highlight: true },
            ]}
            className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-3"
            stagger={0.15}
          />
        </h2>

        <p className="text-[var(--text-secondary)] font-mono text-sm max-w-2xl mb-4">
          <ScrambleText
            text="Cut through the noise. Trende analyzes social, on-chain, and forum signals to give you source-backed market conviction in seconds."
            delay={0.8}
            className="text-[var(--text-secondary)] font-mono text-sm max-w-2xl mb-4"
          />
        </p>

        <div className="flex flex-wrap gap-4 pt-4 border-t border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-cyan)]" />
            <span className="text-xs text-[var(--text-secondary)]">
              Source-Backed Analysis
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-cyan)]" />
            <span className="text-xs text-[var(--text-secondary)]">
              Real-Time Analysis
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-cyan)]" />
            <span className="text-xs text-[var(--text-secondary)]">
              Multi-Blockchain Support
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="flex items-center gap-2 px-3 py-2 glass border-white/10 rounded-lg w-fit">
            <Bot className="w-4 h-4 text-[var(--accent-cyan)]" />
            <span className="text-xs font-mono text-[var(--text-muted)]">AI Agent</span>
            <div className="w-2 h-2 rounded-full bg-[var(--accent-cyan)] animate-pulse" />
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">Proactive insights · Decision transparency · On-chain staging</span>
        </div>
      </div>
    </Card>
  );
}
