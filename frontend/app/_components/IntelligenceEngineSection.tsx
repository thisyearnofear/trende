"use client";

import { Card, Button } from "@/components/DesignSystem";
import {
  Bot,
  Search,
  Shield,
  FileCheck,
  Copy,
  ExternalLink,
} from "lucide-react";

const INTELLIGENCE_ENGINE_STEPS = [
  {
    id: "01",
    title: "Thesis Entry",
    detail: "Define your research scope and platform selection.",
    icon: Search,
  },
  {
    id: "02",
    title: "Agent Harvest",
    detail: "Distributed agents collect cross-platform signal clusters.",
    icon: Bot,
  },
  {
    id: "03",
    title: "TEE Consensus",
    detail: "Multi-model validation with hardware-secured proof.",
    icon: Shield,
  },
  {
    id: "04",
    title: "Verified Intel",
    detail: "Final conviction brief with cryptographic attestation.",
    icon: FileCheck,
  },
];

interface IntelligenceEngineSectionProps {
  onCopyOpenClawStarter: () => void;
}

export function IntelligenceEngineSection({ onCopyOpenClawStarter }: IntelligenceEngineSectionProps) {
  return (
    <Card accent="violet" shadow="md" className="p-6 sm:p-7 text-center">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent-violet)]">
            The Intelligence Engine
          </p>
          <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
            Verifiable Analysis Via Decentralized AI Consensus
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-left">
          {INTELLIGENCE_ENGINE_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className="bg-[var(--bg-primary)] border-2 border-[var(--border-color)] p-3 sm:p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg font-black text-[var(--accent-violet)]">{step.id}</span>
                  <Icon className="w-4 h-4 text-[var(--accent-cyan)]" />
                </div>
                <p className="text-xs sm:text-sm font-black uppercase tracking-wide">{step.title}</p>
                <p className="text-xs font-mono text-[var(--text-secondary)] leading-relaxed">{step.detail}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-[var(--bg-primary)] border-2 border-[var(--border-color)] p-3 sm:p-4 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-[var(--accent-cyan)]">
                OpenClaw Agent Skill
              </p>
              <p className="text-xs font-mono text-[var(--text-secondary)]">
                Plug external agents into Trende via the A2A alpha endpoint and X402 settlement.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onCopyOpenClawStarter}>
                <Copy className="w-4 h-4 mr-1" />
                Copy Starter
              </Button>
              <a
                href="https://github.com/Virtual-Protocol/openclaw-acp"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-[var(--accent-cyan)]"
              >
                OpenClaw SDK
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
