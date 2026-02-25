/**
 * Shared TypeScript types - must match Python domain models
 * Single source of truth for frontend-backend contracts
 */

export type QueryStatus =
  | 'pending'
  | 'planning'
  | 'researching'
  | 'analyzing'
  | 'processing'
  | 'completed'
  | 'failed';

export interface Query {
  id: string;
  idea: string;
  platforms: string[];
  status: QueryStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
  totalResults: number;
  relevanceThreshold: number;
}

export interface TrendItem {
  id: string;
  platform: string;
  title: string;
  content: string;
  author: string;
  authorHandle?: string;
  url: string;
  metrics: {
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
  };
  timestamp: string;
  relevanceScore?: number;
  embedHtml?: string;
}

export interface TrendSummary {
  overview: string;
  keyThemes: string[];
  topTrends: Record<string, unknown>[];
  sentiment: 'positive' | 'negative' | 'neutral';
  confidenceScore?: number;
  validationResults?: string[];
  finalReportMd?: string;
  memePageData?: Record<string, unknown>;
  consensusData?: {
    providers?: string[];
    provider_errors?: Array<{
      provider: string;
      model_id: string;
      error: string;
      latency_ms: number;
    }>;
    warnings?: string[];
    diversity_level?: 'low' | 'medium' | 'high';
    agreement_score?: number;
    main_divergence?: string;
    provider_outputs?: Array<{
      provider: string;
      model_id?: string;
      status?: 'ok' | 'error';
      latency_ms?: number;
      error?: string | null;
      response_excerpt: string;
      char_count?: number;
    }>;
    synthesis_model?: string;
  };
  attestationData?: {
    provider?: string;
    status?: string;
    method?: string;
    attestation_id?: string;
    input_hash?: string;
    signature?: string;
    key_id?: string;
    quote?: string;
    receipt?: string;
    verify_endpoint?: string;
    verification_note?: string;
    payload?: Record<string, unknown>;
    provider_count?: number;
    generated_at?: string;
  };
  financialIntelligence?: {
    assets: Array<{
      symbol: string;
      type: string;
      current_price?: number;
      forecast_7d?: {
        p10?: number;
        p25?: number;
        p50?: number;
        p75?: number;
        p90?: number;
        median?: number;
        change_pct?: number;
        range_low?: number;
        range_high?: number;
      };
      forecast_30d?: {
        p10?: number;
        p25?: number;
        p50?: number;
        p75?: number;
        p90?: number;
        median?: number;
        range_low?: number;
        range_high?: number;
      };
      risk_level?: string;
      volatility?: {
        realized?: number;
        implied?: number;
      };
      liquidation_probability?: number;
    }>;
    summary?: string;
    aggregate_metrics?: {
      overall_risk?: string;
      forecast_direction?: string;
      average_volatility?: number;
      asset_count?: number;
      high_risk_count?: number;
    };
    data_source?: string;
    generated_at?: string;
    polymarket_comparison?: Record<string, unknown> | null;
  };
  relatedMarkets?: Array<{
    provider: string;
    title: string;
    url: string;
    probability?: number | null;
    volume?: number | null;
    endDate?: string | null;
    relevanceReason?: string;
  }>;
  generatedAt: string;
}

export interface TrendResult {
  queryId: string;
  platform: string;
  items: TrendItem[];
  summary?: TrendSummary;
  relevanceScore: number;
  totalFetched: number;
  processingTimeMs: number;
}

export interface Platform {
  type: string;
  displayName: string;
  icon: string;
  color: string;
  supportsEmbed: boolean;
}

export interface QueryRequest {
  idea: string;
  platforms: string[];
  relevanceThreshold?: number;
}

export interface QueryResponse {
  id: string;
  status: QueryStatus;
  createdAt: string;
}

export interface ResultsResponse {
  query: Query;
  results: TrendResult[];
  summary?: TrendSummary;
  telemetry?: {
    runId: string;
    providerCount: number;
    agreementScore: number;
    diversityLevel: 'low' | 'medium' | 'high';
    attestationStatus: string;
    warnings: string[];
    logs: string[];
    updatedAt: string;
  };
}
