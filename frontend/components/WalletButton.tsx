'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet, ChevronDown, ExternalLink, Zap } from 'lucide-react';
import { formatAddress, getExplorerUrl } from '@/lib/wallet';

interface WalletButtonProps {
  /** Show the user's tier info */
  showTier?: boolean;
  /** Compact mode for header */
  compact?: boolean;
}

export function WalletButton({ showTier = false, compact = false }: WalletButtonProps) {
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
                    className={`
                      flex items-center gap-2 rounded-xl border border-cyan-500/30 
                      bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 
                      px-3 py-2 text-sm font-medium text-cyan-300 
                      transition-all hover:border-cyan-500/50 hover:bg-cyan-500/20
                      ${compact ? 'px-2.5 py-1.5 text-xs' : ''}
                    `}
                  >
                    <Wallet className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                    <span>Connect</span>
                    <MonadBadge compact={compact} />
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition-all hover:bg-red-500/20"
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
                    className={`
                      flex items-center gap-2 rounded-xl border border-emerald-500/30 
                      bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 
                      transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20
                      ${compact ? 'px-2.5 py-1.5 text-xs' : ''}
                    `}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono">{formatAddress(account.address)}</span>
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

// Monad badge shown on connect button
function MonadBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full 
        bg-gradient-to-r from-purple-500/20 to-cyan-500/20 
        border border-purple-500/30 
        ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}
        font-bold text-purple-300 uppercase tracking-wider
      `}
    >
      <Zap className={compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} />
      Monad
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
