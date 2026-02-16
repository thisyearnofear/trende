/**
 * Monad chain configuration and wagmi setup
 */

import { http, createConfig, createStorage } from 'wagmi';
import { defineChain } from 'viem';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

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

// Wagmi + RainbowKit config
export const config = getDefaultConfig({
  appName: 'Trende',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'trende-dev',
  chains: [monadTestnet],
  ssr: true,
});

// Export chain ID for convenience
export const MONAD_CHAIN_ID = 10143;

// Helper to format address for display
export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper to get explorer URL for address
export function getExplorerUrl(address: string): string {
  return `${monadTestnet.blockExplorers.default.url}/address/${address}`;
}

// Helper to get explorer URL for transaction
export function getTxExplorerUrl(txHash: string): string {
  return `${monadTestnet.blockExplorers.default.url}/tx/${txHash}`;
}
