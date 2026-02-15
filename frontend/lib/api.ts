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

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.text().catch(() => 'Unknown error');
    throw new ApiError(response.status, error);
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
      headers: { 'Content-Type': 'application/json' },
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
   * Subscribe to SSE stream for real-time updates
   */
  subscribeToStream(
    queryId: string, 
    onEvent: (event: StreamEvent) => void,
    onError?: (error: Error) => void
  ): () => void {
    const eventSource = new EventSource(`${API_BASE}/api/trends/stream/${queryId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as StreamEvent;
        onEvent(data);
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    eventSource.onerror = () => {
      const error = new Error('SSE connection error');
      onError?.(error);
      // Don't reconnect on error
      eventSource.close();
    };

    // Return cleanup function
    return () => eventSource.close();
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
