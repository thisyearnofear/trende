/**
 * Multi-chain configuration for Trende
 * - Monad: Primary chain for core operations
 * - Base: For Paragraph.xyz integration
 * - BSC: For meme token launcher (roadmap)
 */

import { defineChain } from 'viem';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, bsc } from 'viem/chains';

// Define Monad Testnet chain
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz'],
    },
    public: {
      http: ['https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet.monadexplorer.com',
    },
  },
  testnet: true,
});

// Wagmi + RainbowKit config with multi-chain support
export const config = getDefaultConfig({
  appName: 'Trende',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'trende-dev',
  chains: [
    monadTestnet,  // Primary chain
    base,          // For Paragraph.xyz (publishing)
    bsc,           // For meme token launcher
  ],
  ssr: true,
});

// Export chain IDs for convenience
export const MONAD_CHAIN_ID = 10143;
export const BASE_CHAIN_ID = base.id;
export const BSC_CHAIN_ID = bsc.id;

// Helper to format address for display
export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper to get explorer URL for address (multi-chain aware)
export function getExplorerUrl(address: string, chainId: number = MONAD_CHAIN_ID): string {
  const chain = chainId === BASE_CHAIN_ID ? base : chainId === BSC_CHAIN_ID ? bsc : monadTestnet;
  return `${chain.blockExplorers.default.url}/address/${address}`;
}

// Helper to get explorer URL for transaction (multi-chain aware)
export function getTxExplorerUrl(txHash: string, chainId: number = MONAD_CHAIN_ID): string {
  const chain = chainId === BASE_CHAIN_ID ? base : chainId === BSC_CHAIN_ID ? bsc : monadTestnet;
  return `${chain.blockExplorers.default.url}/tx/${txHash}`;
}

// Helper to get chain name
export function getChainName(chainId: number): string {
  switch (chainId) {
    case MONAD_CHAIN_ID:
      return 'Monad Testnet';
    case BASE_CHAIN_ID:
      return 'Base';
    case BSC_CHAIN_ID:
      return 'BNB Smart Chain';
    default:
      return 'Unknown Chain';
  }
}
