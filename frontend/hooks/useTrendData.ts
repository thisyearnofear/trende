/**
 * Custom hooks for trend data management
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { api, ApiError } from '@/lib/api';
import { 
  QueryRequest, 
  QueryResponse, 
  ResultsResponse, 
  StreamEvent,
  QueryStatus,
  CommonsResponse,
  SavedResearchItem,
} from '@/lib/types';

interface UseTrendDataOptions {
  /** Enable automatic polling */
  polling?: boolean;
  /** Polling interval in ms */
  pollInterval?: number;
  /** Enable SSE for real-time updates */
  sse?: boolean;
  /** Called when backend reports the query id no longer exists (404). */
  onNotFound?: (queryId: string) => void;
}

interface UseTrendDataReturn {
  /** Current query status */
  status: QueryStatus | null;
  /** Results data */
  data: ResultsResponse | null;
  /** Error state */
  error: Error | null;
  /** Loading state */
  isLoading: boolean;
  /** Is the analysis still running */
  isProcessing: boolean;
  /** Progress percentage (0-100) */
  progress: number;
  /** Stream events log */
  events: StreamEvent[];
  /** Start a new analysis */
  startAnalysis: (request: QueryRequest) => Promise<QueryResponse>;
  /** Refresh results manually */
  refresh: () => void;
}

/**
 * Hook for managing trend analysis data with polling and SSE support
 */
export function useTrendData(
  queryId: string | null,
  options: UseTrendDataOptions = {}
): UseTrendDataReturn {
  const { sse = true, onNotFound } = options;
  
  const [optimisticStatus, setOptimisticStatus] = useState<QueryStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  
  const sseCleanupRef = useRef<(() => void) | null>(null);
  const lastNotFoundQueryIdRef = useRef<string | null>(null);

  // Determine if we should poll based on queryId
  const shouldFetch = !!queryId;
  
  // Fetch results with SWR - use useMemo to avoid circular reference
  const swrKey = useMemo(() => 
    shouldFetch ? ['/api/trends', queryId] : null, 
    [shouldFetch, queryId]
  );

  const fetchFn = useCallback(() => {
    if (!queryId) throw new Error('Query ID required');
    return api.getResults(queryId);
  }, [queryId]);

  const swrResult = useSWR<ResultsResponse, ApiError>(
    swrKey,
    fetchFn,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );
  const { data, error, isLoading, mutate } = swrResult;

  useEffect(() => {
    if (!queryId || !error) return;
    const isNotFound = error instanceof ApiError && error.status === 404;
    if (!isNotFound) return;
    if (lastNotFoundQueryIdRef.current === queryId) return;

    lastNotFoundQueryIdRef.current = queryId;
    const resetTimer = window.setTimeout(() => {
      setOptimisticStatus(null);
      setProgress(0);
      setEvents([]);
      sseCleanupRef.current?.();
      onNotFound?.(queryId);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [queryId, error, onNotFound]);

  // Determine processing status from data
  const currentStatus = data?.query?.status;
  const status: QueryStatus | null = currentStatus ?? optimisticStatus;
  
  // SSE should run if we are in a processing state OR if we don't have final data yet
  const isProcessing =
    status === 'pending' ||
    status === 'planning' ||
    status === 'researching' ||
    status === 'analyzing' ||
    status === 'processing';
  
  // Terminal states
  const isFinished = status === 'completed' || status === 'failed';
  
  // We need sync if we are processing OR if we just finished but haven't received results yet
  const needsSync = !isFinished || (status === 'completed' && (!data || !data.results || data.results.length === 0));

  // SSE for real-time updates
  useEffect(() => {
    if (!queryId || !sse || !needsSync) return;

    const handleEvent = (event: StreamEvent) => {
      setEvents(prev => [...prev, event]);
      
      if (event.type === 'status' && event.message) {
        // Parse progress from status message
        const progressMatch = event.message.match(/(\d+)%/);
        if (progressMatch) {
          setProgress(parseInt(progressMatch[1], 10));
        }
      }
      
      if (event.type === 'result' || event.type === 'error') {
        // Refresh data when we get results or errors
        // Add a slight delay to ensure DB has persisted if it was a final event
        setTimeout(() => {
          mutate();
        }, 1000);
      }
    };

    const handleError = (err: Error) => {
      console.error('SSE error:', err);
    };

    sseCleanupRef.current = api.subscribeToStream(queryId, handleEvent, handleError);

    return () => {
      sseCleanupRef.current?.();
    };
  }, [queryId, sse, needsSync, mutate]);

  // Start analysis function
  const startAnalysis = useCallback(async (request: QueryRequest): Promise<QueryResponse> => {
    setOptimisticStatus('pending');
    setProgress(0);
    setEvents([]);
    
    const response = await api.startAnalysis(request);
    setOptimisticStatus(response.status);
    
    return response;
  }, []);

  // Refresh function
  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    status,
    data: data ?? null,
    error: error ?? null,
    isLoading,
    isProcessing,
    progress,
    events,
    startAnalysis,
    refresh,
  };
}

/**
 * Hook for history of past analyses
 */
export function useTrendHistory() {
  const { data, error, isLoading, mutate } = useSWR<{ queries: { id: string; idea: string; status: string; createdAt: string; savedAt?: string; isSaved?: boolean; visibility?: string; ipfsUri?: string; saveLabel?: string }[] }>(
    '/api/trends/history',
    () => api.getHistory(false),
    {
      refreshInterval: 60000, // Refresh every minute
    }
  );

  return {
    queries: data?.queries ?? [],
    error,
    isLoading,
    refresh: mutate,
  };
}

/**
 * Hook for wallet-bound saved research list.
 */
export function useSavedResearch(enabled: boolean) {
  const key = enabled ? '/api/trends/saved' : null;
  const { data, error, isLoading, mutate } = useSWR<{ saved: SavedResearchItem[]; total: number }>(
    key,
    () => api.getSavedResearch(100),
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
    }
  );

  return {
    saved: data?.saved ?? [],
    total: data?.total ?? 0,
    error,
    isLoading,
    refresh: mutate,
  };
}

/**
 * Hook for platform selection
 */
export function usePlatforms() {
  const { data, error, isLoading } = useSWR<{ platforms: { type: string; displayName: string; icon: string; color: string }[] }>(
    '/api/platforms',
    () => api.getPlatforms(),
  );

  return {
    platforms: data?.platforms ?? [],
    error,
    isLoading,
  };
}

/**
 * Hook for public research commons feed
 */
export function useCommons(sponsor?: string) {
  const key = sponsor ? ['/api/commons', sponsor] : '/api/commons';
  const { data, error, isLoading, mutate } = useSWR<CommonsResponse>(
    key,
    () => api.getCommons(sponsor),
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
    }
  );

  return {
    research: data?.research ?? [],
    total: data?.total ?? 0,
    error,
    isLoading,
    refresh: mutate,
  };
}
