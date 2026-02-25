'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet, ChevronDown, ExternalLink, Zap } from 'lucide-react';
import { formatAddress, getExplorerUrl } from '@/lib/wallet';
import { useTheme } from './ThemeProvider';

interface WalletButtonProps {
  /** Show the user's tier info */
  showTier?: boolean;
  /** Compact mode for header */
  compact?: boolean;
}

export function WalletButton({ showTier = false, compact = false }: WalletButtonProps) {
  const { isSoft } = useTheme();

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all min-h-[44px] ${compact ? 'px-2.5 text-xs' : ''}`}
                    style={{
                      borderColor: isSoft ? 'var(--accent-cyan)' : 'rgba(6, 182, 212, 0.35)',
                      background: isSoft
                        ? 'linear-gradient(135deg, rgba(0,102,204,0.20), rgba(0,170,68,0.12))'
                        : 'linear-gradient(90deg, rgba(6,182,212,0.12), rgba(16,185,129,0.10))',
                      color: isSoft ? 'var(--text-primary)' : 'rgb(165 243 252)',
                      boxShadow: isSoft ? 'var(--soft-shadow-out)' : undefined,
                    }}
                  >
                    <Wallet className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                    <span className="hidden sm:inline">Connect</span>
                    <span className="hidden sm:inline-flex"><ChainBadge compact={compact} isSoft={isSoft} /></span>
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all min-h-[44px]"
                    style={{
                      borderColor: isSoft ? 'var(--accent-rose)' : 'rgba(239, 68, 68, 0.35)',
                      backgroundColor: isSoft ? 'rgba(255, 76, 76, 0.14)' : 'rgba(239, 68, 68, 0.12)',
                      color: isSoft ? 'var(--text-primary)' : 'rgb(252 165 165)',
                    }}
                  >
                    Wrong network
                    <ChevronDown className="w-4 h-4" />
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  {showTier && <TierBadge />}
                  
                  <button
                    onClick={openAccountModal}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all min-h-[44px] ${compact ? 'px-2.5 text-xs' : ''}`}
                    style={{
                      borderColor: isSoft ? 'var(--accent-emerald)' : 'rgba(16, 185, 129, 0.35)',
                      backgroundColor: isSoft ? 'rgba(0, 170, 68, 0.16)' : 'rgba(16, 185, 129, 0.10)',
                      color: isSoft ? 'var(--text-primary)' : 'rgb(167 243 208)',
                      boxShadow: isSoft ? 'var(--soft-shadow-out)' : undefined,
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono hidden sm:inline">{formatAddress(account.address)}</span>
                    <ChevronDown className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

// Multi-chain badge shown on connect button
function ChainBadge({ compact = false, isSoft = false }: { compact?: boolean; isSoft?: boolean }) {
  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full 
        border
        ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}
        font-bold uppercase tracking-wider
      `}
      style={{
        background: isSoft
          ? 'rgba(255, 255, 255, 0.85)'
          : 'linear-gradient(90deg, rgba(168,85,247,0.20), rgba(6,182,212,0.20))',
        borderColor: isSoft ? 'var(--accent-cyan)' : 'rgba(168,85,247,0.35)',
        color: isSoft ? 'var(--accent-cyan)' : 'rgb(216 180 254)',
      }}
    >
      <Zap className={compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} />
      Base
    </span>
  );
}

// Tier badge showing user's access level
function TierBadge() {
  // TODO: Fetch actual tier from API based on wallet/usage
  const tier = 'connected'; // 'anonymous' | 'connected' | 'premium'
  const remaining = 8; // searches remaining today

  const tierConfig = {
    anonymous: {
      label: 'Free',
      color: 'text-slate-400 border-slate-600 bg-slate-800/50',
      limit: 3,
    },
    connected: {
      label: 'Connected',
      color: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
      limit: 10,
    },
    premium: {
      label: 'Premium',
      color: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
      limit: Infinity,
    },
  };

  const config = tierConfig[tier];

  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${config.color}`}>
      <span className="font-medium">{config.label}</span>
      {config.limit !== Infinity && (
        <span className="text-slate-500">
          {remaining}/{config.limit}
        </span>
      )}
    </div>
  );
}

// Standalone component for showing wallet info in other places
export function WalletInfo() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted }) => {
        if (!mounted || !account || !chain) return null;

        return (
          <a
            href={getExplorerUrl(account.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors"
          >
            <span className="font-mono">{formatAddress(account.address)}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        );
      }}
    </ConnectButton.Custom>
  );
}
