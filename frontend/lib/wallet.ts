/**
 * Multi-chain configuration for Trende
 * - Base Sepolia: Primary testnet for core operations
 * - Arbitrum Sepolia: Secondary testnet for operations
 * - Base: For Paragraph.xyz integration
 * - BSC: For meme token launcher (roadmap)
 */

import { defineChain } from 'viem';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, bsc, arbitrum } from 'viem/chains';

// Define Base Sepolia testnet
export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org'],
    },
    public: {
      http: ['https://sepolia.base.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Basescan',
      url: 'https://sepolia.basescan.org',
    },
  },
  testnet: true,
});

// Define Arbitrum Sepolia testnet
export const arbitrumSepolia = defineChain({
  id: 421614,
  name: 'Arbitrum Sepolia',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://sepolia-rollup.arbitrum.io/rpc'],
    },
    public: {
      http: ['https://sepolia-rollup.arbitrum.io/rpc'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arbiscan',
      url: 'https://sepolia.arbiscan.io',
    },
  },
  testnet: true,
});

// Wagmi + RainbowKit config with multi-chain support
export const config = getDefaultConfig({
  appName: 'Trende',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'trende-dev',
  chains: [
    baseSepolia,     // Primary testnet
    arbitrumSepolia, // Secondary testnet
    base,            // For Paragraph.xyz (publishing)
    bsc,             // For meme token launcher
  ],
  ssr: true,
});

// Export chain IDs for convenience
export const BASE_SEPOLIA_CHAIN_ID = baseSepolia.id;
export const ARBITRUM_SEPOLIA_CHAIN_ID = arbitrumSepolia.id;
export const BASE_CHAIN_ID = base.id;
export const BSC_CHAIN_ID = bsc.id;

// Helper to format address for display
export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper to get explorer URL for address (multi-chain aware)
export function getExplorerUrl(address: string, chainId: number = BASE_SEPOLIA_CHAIN_ID): string {
  let chain;
  switch (chainId) {
    case BASE_CHAIN_ID:
      chain = base;
      break;
    case BSC_CHAIN_ID:
      chain = bsc;
      break;
    case ARBITRUM_SEPOLIA_CHAIN_ID:
      chain = arbitrumSepolia;
      break;
    case BASE_SEPOLIA_CHAIN_ID:
    default:
      chain = baseSepolia;
  }
  return `${chain.blockExplorers.default.url}/address/${address}`;
}

// Helper to get explorer URL for transaction (multi-chain aware)
export function getTxExplorerUrl(txHash: string, chainId: number = BASE_SEPOLIA_CHAIN_ID): string {
  let chain;
  switch (chainId) {
    case BASE_CHAIN_ID:
      chain = base;
      break;
    case BSC_CHAIN_ID:
      chain = bsc;
      break;
    case ARBITRUM_SEPOLIA_CHAIN_ID:
      chain = arbitrumSepolia;
      break;
    case BASE_SEPOLIA_CHAIN_ID:
    default:
      chain = baseSepolia;
  }
  return `${chain.blockExplorers.default.url}/tx/${txHash}`;
}

// Helper to get chain name
export function getChainName(chainId: number): string {
  switch (chainId) {
    case BASE_SEPOLIA_CHAIN_ID:
      return 'Base Sepolia';
    case ARBITRUM_SEPOLIA_CHAIN_ID:
      return 'Arbitrum Sepolia';
    case BASE_CHAIN_ID:
      return 'Base';
    case BSC_CHAIN_ID:
      return 'BNB Smart Chain';
    default:
      return 'Unknown Chain';
  }
}
