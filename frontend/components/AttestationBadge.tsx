'use client';

import { useState } from 'react';
import { ShieldCheck, Info, ExternalLink } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { cn } from '@/lib/utils';

interface AttestationBadgeProps {
    attestation?: {
        provider?: string;
        method?: string;
        status?: string;
        attestation_id?: string;
        signature?: string;
        signer?: string;
        key_id?: string;
        input_hash?: string;
        generated_at?: string;
    };
    size?: 'sm' | 'md' | 'lg';
    showDetails?: boolean;
}

export function AttestationBadge({ attestation, size = 'md', showDetails = false }: AttestationBadgeProps) {
    const [showTooltip, setShowTooltip] = useState(false);
    const { isSoft } = useTheme();

    if (!attestation || attestation.status !== 'signed') {
        return null;
    }

    const normalizedProvider = (attestation.provider || 'hetzner').toLowerCase();
    const providerLabel = normalizedProvider === 'hetzner'
        ? 'Hetzner Runtime'
        : (attestation.provider || 'Trende Runtime');
    const signerAddress = attestation.signer || '';

    const sizeClasses = {
        sm: 'px-2 py-1 text-[10px] gap-1',
        md: 'px-3 py-1.5 text-xs gap-1.5',
        lg: 'px-4 py-2 text-sm gap-2',
    };

    const iconSizes = {
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
        lg: 'w-5 h-5',
    };

    return (
        <div className="relative inline-block">
            <div
                className={cn(
                    `inline-flex items-center ${sizeClasses[size]} rounded-full border font-bold uppercase tracking-wider cursor-help transition-all`,
                    isSoft 
                        ? "soft-ui-button border-0 text-[var(--accent-emerald)]" 
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                )}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <ShieldCheck className={iconSizes[size]} />
                <span>Proof Verified</span>
                <Info className={cn(iconSizes[size], isSoft ? "text-[var(--text-muted)]" : "opacity-60")} />
            </div>

            {showTooltip && (
                <div className={cn(
                    "absolute z-50 w-80 p-4 mt-2 left-0 rounded-xl shadow-2xl animate-fade-in",
                    isSoft ? "soft-ui-out border-0" : "bg-slate-900 border-2 border-emerald-500/30"
                )}>
                    <div className="flex items-start gap-3 mb-3">
                        <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                            isSoft ? "soft-ui-in" : "bg-emerald-500/20"
                        )}>
                            <ShieldCheck className={cn("w-6 h-6", isSoft ? "text-[var(--accent-emerald)]" : "text-emerald-400")} />
                        </div>
                        <div>
                            <h4 className={cn("text-sm font-bold mb-1", isSoft ? "text-[var(--text-primary)]" : "text-white")}>Server Proof</h4>
                            <p className={cn("text-xs leading-relaxed", isSoft ? "text-[var(--text-secondary)]" : "text-slate-400")}>
                                This report is signed by Trende&apos;s backend runtime, making the payload hash
                                and provenance independently verifiable.
                            </p>
                        </div>
                    </div>

                    {showDetails && (
                        <div className={cn(
                            "space-y-2 pt-3 border-t",
                            isSoft ? "border-[var(--text-muted)]/10" : "border-slate-700"
                        )}>
                            <div className="flex items-center justify-between text-xs">
                                <span className={isSoft ? "text-[var(--text-muted)]" : "text-slate-500"}>Provider:</span>
                                <span className={cn("font-mono", isSoft ? "text-[var(--text-secondary)]" : "text-slate-300")}>{providerLabel}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className={isSoft ? "text-[var(--text-muted)]" : "text-slate-500"}>Method:</span>
                                <span className={cn("font-mono", isSoft ? "text-[var(--text-secondary)]" : "text-slate-300")}>{attestation.method}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className={isSoft ? "text-[var(--text-muted)]" : "text-slate-500"}>Attestation ID:</span>
                                <span className={cn("font-mono text-[10px]", isSoft ? "text-[var(--text-secondary)]" : "text-slate-300")}>
                                    {attestation.attestation_id?.slice(0, 20)}...
                                </span>
                            </div>
                            <div className="flex items-start justify-between text-xs gap-2">
                                <span className={cn("flex-shrink-0", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>Signer:</span>
                                {signerAddress ? (
                                    <a
                                        href={`https://etherscan.io/address/${signerAddress}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn("hover:opacity-80 font-mono text-[10px] flex items-center gap-1 break-all", isSoft ? "text-[var(--accent-emerald)]" : "text-emerald-400")}
                                    >
                                        {signerAddress.slice(0, 10)}...{signerAddress.slice(-8)}
                                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    </a>
                                ) : (
                                    <span className={cn("font-mono text-[10px]", isSoft ? "text-[var(--text-muted)]" : "text-slate-400")}>n/a</span>
                                )}
                            </div>
                        </div>
                    )}

                    <div className={cn(
                        "mt-3 pt-3 border-t",
                        isSoft ? "border-[var(--text-muted)]/10" : "border-slate-700"
                    )}>
                        <p className={cn("text-[10px] uppercase tracking-wider font-bold mb-1", isSoft ? "text-[var(--text-muted)]" : "text-slate-500")}>
                            How Verification Works
                        </p>
                        <p className={cn("text-xs", isSoft ? "text-[var(--text-secondary)]" : "text-slate-400")}>
                            Trende hashes the canonical payload and signs it on the live server runtime. Matching the
                            hash and signature proves the result has not been tampered with.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
