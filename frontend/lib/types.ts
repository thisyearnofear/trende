/**
 * Shared TypeScript types - matches Python domain models
 * Single source of truth for frontend-backend contracts
 */

export type QueryStatus = 'pending' | 'processing' | 'completed' | 'failed';

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
}

export interface StreamEvent {
  type: 'status' | 'progress' | 'result' | 'error';
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}
