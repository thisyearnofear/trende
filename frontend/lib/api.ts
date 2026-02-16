/**
 * API client for communicating with the backend
 */

import { 
  QueryRequest, 
  QueryResponse, 
  ResultsResponse, 
  StreamEvent
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Store wallet address for API calls (set by WalletProvider)
let currentWalletAddress: string | undefined;

export function setWalletAddress(address: string | undefined) {
  currentWalletAddress = address;
}

export function getWalletAddress(): string | undefined {
  return currentWalletAddress;
}

// Rate limit info from API responses
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: string;
  tier: 'anonymous' | 'connected' | 'premium';
}

let lastRateLimitInfo: RateLimitInfo | null = null;

export function getRateLimitInfo(): RateLimitInfo | null {
  return lastRateLimitInfo;
}

// Payment info extracted from 402 response
export interface PaymentInfo {
  amount: string;
  recipient: string;
  chainId: string;
  tokenType: string;
  scheme: string;
  network: string;
}

class ApiError extends Error {
  public rateLimitInfo?: RateLimitInfo;
  public paymentRequired?: boolean;
  public paymentInfo?: PaymentInfo;

  constructor(public status: number, message: string, response?: Response) {
    super(message);
    this.name = 'ApiError';
    this.paymentRequired = status === 402;
    
    // Extract payment headers if 402
    if (status === 402 && response) {
      this.paymentInfo = {
        amount: response.headers.get('X-402-Amount') || '0.001',
        recipient: response.headers.get('X-402-Recipient') || '',
        chainId: response.headers.get('X-402-Chain-ID') || '10143',
        tokenType: response.headers.get('X-402-Token-Type') || 'native',
        scheme: response.headers.get('X-402-Scheme') || 'EIP-712',
        network: response.headers.get('X-402-Network') || 'monad-testnet',
      };
    }
  }
}

// Helper to check if error is a payment required error
export function isPaymentRequiredError(error: unknown): error is ApiError & { paymentInfo: PaymentInfo } {
  return error instanceof ApiError && error.paymentRequired === true && !!error.paymentInfo;
}

function extractRateLimitInfo(response: Response): void {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const limit = response.headers.get('X-RateLimit-Limit');
  const resetAt = response.headers.get('X-RateLimit-Reset');
  const tier = response.headers.get('X-RateLimit-Tier');

  if (remaining && limit) {
    lastRateLimitInfo = {
      remaining: parseInt(remaining, 10),
      limit: parseInt(limit, 10),
      resetAt: resetAt || '',
      tier: (tier as RateLimitInfo['tier']) || 'anonymous',
    };
  }
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (currentWalletAddress) {
    headers['X-Wallet-Address'] = currentWalletAddress;
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  extractRateLimitInfo(response);
  
  if (!response.ok) {
    const error = await response.text().catch(() => 'Unknown error');
    throw new ApiError(response.status, error, response);
  }
  return response.json();
}

export const api = {
  /**
   * Start a new trend analysis
   */
  async startAnalysis(request: QueryRequest): Promise<QueryResponse> {
    const response = await fetch(`${API_BASE}/api/trends/start`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(request),
    });
    return handleResponse<QueryResponse>(response);
  },

  /**
   * Get results for a specific query
   */
  async getResults(queryId: string): Promise<ResultsResponse> {
    const response = await fetch(`${API_BASE}/api/trends/${queryId}`);
    return handleResponse<ResultsResponse>(response);
  },

  /**
   * Get status of a query
   */
  async getStatus(queryId: string): Promise<{ status: string; progress?: number }> {
    const response = await fetch(`${API_BASE}/api/trends/status/${queryId}`);
    return handleResponse<{ status: string; progress?: number }>(response);
  },

  /**
   * Get list of past analyses
   */
  async getHistory(): Promise<{ queries: { id: string; idea: string; status: string; createdAt: string }[] }> {
    const response = await fetch(`${API_BASE}/api/trends/history`);
    return handleResponse<{ queries: { id: string; idea: string; status: string; createdAt: string }[] }>(response);
  },

  /**
   * Subscribe to SSE stream for real-time updates with automatic reconnection
   */
  subscribeToStream(
    queryId: string, 
    onEvent: (event: StreamEvent) => void,
    onError?: (error: Error) => void
  ): () => void {
    let eventSource: EventSource | null = null;
    let isClosed = false;
    let retryCount = 0;
    const maxRetries = 5;

    const connect = () => {
      if (isClosed) return;
      
      eventSource = new EventSource(`${API_BASE}/api/trends/stream/${queryId}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as StreamEvent;
          onEvent(data);
          // Reset retry count on successful message
          retryCount = 0;
        } catch (e) {
          console.error('Failed to parse SSE event:', e);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        eventSource?.close();
        
        if (!isClosed && retryCount < maxRetries) {
          retryCount++;
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          console.log(`Retrying SSE connection in ${delay}ms... (Attempt ${retryCount}/${maxRetries})`);
          setTimeout(connect, delay);
        } else if (retryCount >= maxRetries) {
          onError?.(new Error('Max SSE reconnection retries reached'));
        }
      };
    };

    connect();

    // Return cleanup function
    return () => {
      isClosed = true;
      eventSource?.close();
    };
  },

  /**
   * Get platforms list
   */
  async getPlatforms(): Promise<{ platforms: { type: string; displayName: string; icon: string; color: string }[] }> {
    const response = await fetch(`${API_BASE}/api/platforms`);
    return handleResponse<{ platforms: { type: string; displayName: string; icon: string; color: string }[] }>(response);
  },
};

export { ApiError };
