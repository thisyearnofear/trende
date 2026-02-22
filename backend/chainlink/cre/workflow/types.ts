import { z } from "zod";

// ─── Config Schema ──────────────────────────────────────────────────────

export const configSchema = z.object({
  evms: z
    .array(
      z.object({
        chainSelectorName: z.string().min(1),
        oracleAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/u),
        gasLimit: z
          .string()
          .regex(/^\d+$/)
          .refine((val) => Number(val) > 0),
      })
    )
    .min(1),
  trendeApiUrl: z.string().url(),
  consensusThreshold: z.number().min(0).max(1).default(0.5),
});

export type Config = z.infer<typeof configSchema>;

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

export const settleMarketAbi = [
  {
    type: "function",
    name: "resolveMarket",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "source", type: "string" },
      { name: "encryptedSecretsUrls", type: "bytes" },
    ],
    outputs: [{ name: "requestId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
] as const;
