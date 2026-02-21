/**
 * Shared TypeScript types - matches Python domain models
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
  isSaved?: boolean;
  visibility?: 'private' | 'unlisted' | 'public';
  savedAt?: string;
  ipfsUri?: string;
  saveLabel?: string;
}

export interface TrendItem {
  id: string;
  platform: string;
  sourceIndex?: number;
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
    pillars?: string[];
    anomalies?: string[];
    synthesis_model?: string;
  };
  attestationData?: {
    provider?: string;
    status?: string;
    method?: string;
    attestation_id?: string;
    input_hash?: string;
    signature?: string;
    signer?: string;
    message?: string;
    message_hash?: string;
    key_id?: string;
    quote?: string;
    receipt?: string;
    verify_endpoint?: string;
    verification_note?: string;
    payload?: Record<string, unknown>;
    provider_count?: number;
    generated_at?: string;
  };
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
  models?: string[];
  relevanceThreshold?: number;
}

export interface QueryResponse {
  id: string;
  status: QueryStatus;
  createdAt: string;
}

export interface SaveResearchRequest {
  visibility: 'private' | 'unlisted' | 'public';
  pinToIpfs?: boolean;
  saveLabel?: string;
  tags?: string[];
}

export interface SaveResearchResponse {
  saved: {
    id: string;
    owner: string;
    visibility: 'private' | 'unlisted' | 'public';
    savedAt: string;
    ipfsCid?: string | null;
    ipfsUri?: string | null;
    saveLabel?: string | null;
    tags: string[];
  };
  archive: {
    provider: string;
    pinned: boolean;
    cid?: string | null;
    uri: string;
    content_hash: string;
    note?: string;
  };
}

export interface ResultsResponse {
  query: Query;
  results: TrendResult[];
  summary?: TrendSummary;
  telemetry?: {
    runId: string;
    providerCount: number;
    providerFailureRate?: number;
    agreementScore: number;
    diversityLevel: 'low' | 'medium' | 'high';
    durationSeconds?: number;
    attestationStatus: string;
    warnings: string[];
    logs: string[];
    updatedAt: string;
  };
}

export interface StreamEvent {
  type: 'status' | 'progress' | 'result' | 'error';
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface CommonsResearchItem {
  id: string;
  topic: string;
  sponsor: string | null;
  platforms: string[];
  hasAttestation: boolean;
  createdAt: string;
}

export interface CommonsResponse {
  research: CommonsResearchItem[];
  total: number;
  filter: {
    sponsor: string | null;
  };
}

export interface SavedResearchItem {
  id: string;
  idea: string;
  status: QueryStatus;
  platforms: string[];
  createdAt: string;
  savedAt: string;
  visibility: 'private' | 'unlisted' | 'public';
  ipfsCid?: string | null;
  ipfsUri?: string | null;
  saveLabel?: string | null;
  tags: string[];
  hasAttestation: boolean;
}

export type AgentActionStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'compensated';

export interface AgentAction {
  action_id: string;
  action_type: string;
  status: AgentActionStatus;
  task_id?: string | null;
  caller_address?: string | null;
  idempotency_key?: string | null;
  input_payload: Record<string, unknown>;
  result_payload?: Record<string, unknown> | null;
  error?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
}

export interface ActionSubmitRequest {
  action_type: string;
  task_id?: string;
  input?: Record<string, unknown>;
  idempotency_key?: string;
}

export interface ActionSubmitResponse {
  action: AgentAction;
  idempotent: boolean;
}
