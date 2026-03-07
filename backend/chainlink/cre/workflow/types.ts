// ─── Config Type ────────────────────────────────────────────────────────

export type Config = {
  evms: Array<{
    chainSelectorName: string;
    oracleAddress: string;
    gasLimit: string;
  }>;
  trendeApiUrl: string;
  consensusThreshold: number;
};

// ─── Data Source Types ──────────────────────────────────────────────────

export interface GDELTArticle {
  title: string;
  url: string;
  source: string;
  timestamp: string;
}

export interface CoinGeckoData {
  name: string;
  symbol: string;
  price_usd: number;
  market_cap: number;
  price_change_24h: number;
}

// ─── AI Provider Types ──────────────────────────────────────────────────

export interface AIProviderResponse {
  provider: string;
  analysis: string;
  statusCode: number;
}

// ─── Consensus Types ────────────────────────────────────────────────────

export interface ConsensusResult {
  score: number; // 0-100 for on-chain
  summary: string;
  agreementScore: number; // 0.0-1.0
  providerCount: number;
  pillars: string[];
  topNarrative: string;
}

// ─── Market Event Types ─────────────────────────────────────────────────

export const marketCreatedEventAbi = [
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "topic", type: "string", indexed: false },
      { name: "endTime", type: "uint256", indexed: false },
    ],
  },
] as const;
