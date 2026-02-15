'use client';

import { useState, useCallback } from 'react';
import { useTrendData, useTrendHistory } from '@/hooks/useTrendData';
import { QueryInput } from '@/components/QueryInput';
import { PlatformTabs } from '@/components/PlatformTabs';
import { TrendSummary } from '@/components/TrendSummary';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { QueryRequest, QueryStatus } from '@/lib/types';
import { RefreshCw, History, Zap } from 'lucide-react';

export default function Home() {
  const [queryId, setQueryId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const {
    status,
    data,
    isLoading,
    isProcessing,
    progress,
    events,
    startAnalysis,
    refresh,
  } = useTrendData(queryId);

  const { queries: history, isLoading: historyLoading } = useTrendHistory();

  const handleSubmit = useCallback(async (request: QueryRequest) => {
    try {
      const response = await startAnalysis(request);
      setQueryId(response.id);
    } catch (error) {
      console.error('Failed to start analysis:', error);
    }
  }, [startAnalysis]);

  const handleSelectHistory = (id: string) => {
    setQueryId(id);
    setShowHistory(false);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">Trende</h1>
                <p className="text-xs text-slate-500">AI Trend Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refresh()}
                disabled={!queryId}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                title="History"
              >
                <History className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* History Sidebar */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowHistory(false)}
          />
          <div className="relative w-80 bg-slate-900 border-l border-slate-800 p-4 overflow-y-auto">
            <h3 className="font-semibold text-slate-100 mb-4">Recent Analyses</h3>
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="text-slate-500 text-sm">No recent analyses</p>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectHistory(item.id)}
                    className="w-full text-left p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <p className="text-sm text-slate-200 line-clamp-2">{item.idea}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          item.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : item.status === 'processing'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Query Input */}
        <div className="mb-8">
          <QueryInput
            onSubmit={handleSubmit}
            isLoading={isProcessing}
            disabled={isProcessing}
          />
        </div>

        {/* Processing Status */}
        {(isProcessing || status === 'processing') && (
          <div className="mb-8">
            <ProcessingStatus
              status={status}
              progress={progress}
              events={events}
              isProcessing={isProcessing}
            />
          </div>
        )}

        {/* Results */}
        {data && data.results && data.results.length > 0 && !isProcessing && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Summary */}
            <div className="lg:col-span-1">
              <TrendSummary summary={data.summary} />
            </div>

            {/* Results List */}
            <div className="lg:col-span-2">
              <PlatformTabs results={data.results} />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!queryId && !isProcessing && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-10 h-10 text-indigo-500" />
            </div>
            <h2 className="text-xl font-semibold text-slate-200 mb-2">
              Discover Trends with AI
            </h2>
            <p className="text-slate-500 max-w-md mx-auto">
              Enter a topic or idea above to analyze trends across Twitter, LinkedIn,
              news sources, and the web using AI agents.
            </p>
          </div>
        )}

        {/* Error State */}
        {data?.query?.status === 'failed' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
            <h3 className="text-red-400 font-semibold mb-2">Analysis Failed</h3>
            <p className="text-slate-400 text-sm">
              {data.query.errorMessage || 'An error occurred while processing your request.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
