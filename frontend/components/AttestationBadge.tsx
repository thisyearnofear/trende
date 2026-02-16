'use client';

import { useState } from 'react';
import { ShieldCheck, Info, ExternalLink, Check, X } from 'lucide-react';

interface AttestationBadgeProps {
    attestation?: {
        provider?: string;
        method?: string;
        status?: string;
        attestation_id?: string;
        signature?: string;
        key_id?: string;
        input_hash?: string;
        generated_at?: string;
    };
    size?: 'sm' | 'md' | 'lg';
    showDetails?: boolean;
}

export function AttestationBadge({ attestation, size = 'md', showDetails = false }: AttestationBadgeProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    if (!attestation || attestation.status !== 'signed') {
        return null;
    }

    const isTEE = attestation.provider === 'eigencompute';
    const signerAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

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
                className={`inline-flex items-center ${sizeClasses[size]} rounded-full bg-emerald-500/10 border border-emerald-500/30 font-bold text-emerald-400 uppercase tracking-wider cursor-help transition-all hover:bg-emerald-500/20`}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <ShieldCheck className={iconSizes[size]} />
                <span>{isTEE ? 'TEE Verified' : 'Attested'}</span>
                <Info className={`${iconSizes[size]} opacity-60`} />
            </div>

            {showTooltip && (
                <div className="absolute z-50 w-80 p-4 mt-2 left-0 bg-slate-900 border-2 border-emerald-500/30 rounded-xl shadow-2xl animate-fade-in">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-white mb-1">TEE Attestation</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                This report is cryptographically signed by a Trusted Execution Environment (TEE),
                                providing verifiable proof that the consensus was generated securely.
                            </p>
                        </div>
                    </div>

                    {showDetails && (
                        <div className="space-y-2 pt-3 border-t border-slate-700">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">Method:</span>
                                <span className="text-slate-300 font-mono">{attestation.method}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">Attestation ID:</span>
                                <span className="text-slate-300 font-mono text-[10px]">
                                    {attestation.attestation_id?.slice(0, 20)}...
                                </span>
                            </div>
                            <div className="flex items-start justify-between text-xs gap-2">
                                <span className="text-slate-500 flex-shrink-0">Signer:</span>
                                <a
                                    href={`https://etherscan.io/address/${signerAddress}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 hover:text-emerald-300 font-mono text-[10px] flex items-center gap-1 break-all"
                                >
                                    {signerAddress.slice(0, 10)}...{signerAddress.slice(-8)}
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                </a>
                            </div>
                        </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">
                            What is TEE?
                        </p>
                        <p className="text-xs text-slate-400">
                            A secure area of a processor that guarantees code and data are protected with respect to
                            confidentiality and integrity.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

interface VerificationStatusProps {
    isVerifying: boolean;
    verified: boolean | null;
    onVerify: () => void;
}

export function VerificationStatus({ isVerifying, verified, onVerify }: VerificationStatusProps) {
    return (
        <div className="flex items-center gap-3">
            <button
                onClick={onVerify}
                disabled={isVerifying}
                className="px-4 py-2 rounded-lg border border-emerald-500/40 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50 transition-all flex items-center gap-2"
            >
                {isVerifying ? (
                    <>
                        <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                        Verifying...
                    </>
                ) : (
                    <>
                        <ShieldCheck className="w-4 h-4" />
                        Verify Signature
                    </>
                )}
            </button>

            {verified !== null && (
                <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${verified
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}
                >
                    {verified ? (
                        <>
                            <Check className="w-4 h-4" />
                            <span className="text-sm font-semibold">Signature Valid</span>
                        </>
                    ) : (
                        <>
                            <X className="w-4 h-4" />
                            <span className="text-sm font-semibold">Verification Failed</span>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
