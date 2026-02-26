"use client";

import { Card } from "@/components/DesignSystem";

interface VerificationData {
  tee?: {
    status: string;
    provider?: string;
  };
  consensus?: {
    status: string;
    providers?: { length: number }[];
    agreementScore: number;
  };
  chainlink?: {
    status: string;
    network?: string;
    configured?: boolean;
  };
}

interface VerificationCardProps {
  verification: VerificationData | undefined;
  chainlinkStatusLabel: string;
  variant: "info" | "results";
}

export function VerificationCard({ verification, chainlinkStatusLabel, variant }: VerificationCardProps) {
  if (variant === "info") {
    return (
      <Card accent="cyan" className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-cyan)]">
              Verification
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              TEE attestation + multi-model consensus are active by default. Chainlink oracle settlement is available once a mission finalizes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase">
            <span className="px-2 py-1 border border-[var(--border-color)] bg-[var(--bg-primary)]">TEE: Active</span>
            <span className="px-2 py-1 border border-[var(--border-color)] bg-[var(--bg-primary)]">Consensus: Active</span>
            <span className="px-2 py-1 border border-[var(--border-color)] bg-[var(--bg-primary)]">Chainlink: Standby</span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card accent="cyan" className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-cyan)]">
          Verification
        </p>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">
          What was verified
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">TEE</p>
          <p className="text-sm font-black mt-1">{verification?.tee?.status || "pending"}</p>
          <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-1">
            Provider: {verification?.tee?.provider || "eigen"}
          </p>
        </div>
        <div className="border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Consensus</p>
          <p className="text-sm font-black mt-1">{verification?.consensus?.status || "degraded"}</p>
          <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-1">
            {(verification?.consensus?.providers?.length || 0)} routes • {Math.round((verification?.consensus?.agreementScore || 0) * 100)}% agreement
          </p>
        </div>
        <div className="border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Chainlink</p>
          <p className="text-sm font-black mt-1">{chainlinkStatusLabel}</p>
          <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-1">
            {verification?.chainlink?.network || "oracle lane ready"}
          </p>
        </div>
      </div>
    </Card>
  );
}
