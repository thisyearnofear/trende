'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTrendData, useTrendHistory } from '@/hooks/useTrendData';
import { QueryInput } from '@/components/QueryInput';
import { PlatformTabs } from '@/components/PlatformTabs';
import { TrendSummary } from '@/components/TrendSummary';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { QueryRequest } from '@/lib/types';
import { RefreshCw, History, Zap, Sparkles, Bot, Fingerprint } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Card, Stat, Button, IconButton } from '@/components/DesignSystem';

export default function Home() {
  const [queryId, setQueryId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { status, data, isProcessing, progress, events, startAnalysis, refresh } = useTrendData(queryId);
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

  const handleClear = () => {
    setQueryId(null);
    setShowHistory(false);
  };

  const stats = useMemo(() => {
    const platforms = new Set(data?.results.map((result) => result.platform) || []);
    const itemCount = data?.results.reduce((sum, result) => sum + result.items.length, 0) || 0;
    return { platforms: platforms.size, itemCount, confidence: Math.round((data?.summary?.confidenceScore || 0) * 100) };
  }, [data]);

  const activeQueryId = data?.query?.id || queryId;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] pb-10 transition-colors duration-200">
      {/* Header */}
      <header className="border-b-2 border-[var(--border-color)] bg-[var(--bg-primary)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2 sm:gap-3" onClick={handleClear}>
              <div 
                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--accent-cyan)', boxShadow: '2px 2px 0px 0px var(--shadow-color)' }}
              >
                <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--bg-primary)]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-black uppercase tracking-wider truncate">TRENDE</h1>
                <p className="text-[10px] font-mono text-[var(--accent-cyan)] truncate">TEE-SECURED</p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <IconButton
                icon={<RefreshCw className="w-5 h-5" />}
                onClick={() => refresh()}
                disabled={!queryId}
                ariaLabel="Refresh"
              />
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2.5 min-h-[44px] min-w-[44px] border-2 transition-colors flex items-center justify-center ${
                  showHistory 
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' 
                    : 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)]'
                }`}
                style={{ boxShadow: '2px 2px 0px 0px var(--shadow-color)' }}
                aria-label="History"
              >
                <History className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* History Panel */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowHistory(false)} />
          <Card className="relative w-full sm:w-96 h-full rounded-none" accent="cyan">
            <div className="flex items-center justify-between p-4 border-b-2 border-[var(--border-color)]">
              <h3 className="font-black uppercase tracking-wider">Mission History</h3>
              <button onClick={() => setShowHistory(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] font-mono">[CLOSE]</button>
            </div>
            <div className="p-4 overflow-y-auto">
              {historyLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-[var(--bg-primary)] border-2 border-[var(--text-muted)]" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p className="text-[var(--text-muted)] font-mono">NO MISSIONS ON RECORD</p>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectHistory(item.id)}
                      className="w-full text-left p-3 bg-[var(--bg-primary)] border-2 border-[var(--text-muted)] hover:border-[var(--accent-cyan)] transition-colors"
                    >
                      <p className="text-sm line-clamp-2 font-mono">{item.idea}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 font-mono ${
                          item.status === 'completed' ? 'bg-[var(--accent-emerald)] text-[var(--bg-primary)]' :
                          item.status === 'processing' ? 'bg-[var(--accent-amber)] text-[var(--bg-primary)]' :
                          'bg-[var(--text-muted)] text-[var(--text-primary)]'
                        }`}>
                          {item.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] font-mono">{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        {!queryId && !isProcessing && (
          <Card accent="cyan" shadow="lg" className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Fingerprint className="w-5 h-5 text-[var(--accent-cyan)]" />
              <span className="text-xs font-mono text-[var(--accent-cyan)]">EIGENCOMPUTE TEE // SECURE ENCLAVE</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mb-3">
              Turn Social Signal Into Conviction-Ready Intelligence
            </h2>
            <p className="text-[var(--text-secondary)] font-mono text-sm max-w-2xl">
              Run multi-platform research through verifiable TEE execution. 
              Cross-reference signals, validate consensus, generate cryptographic attestations.
            </p>
          </Card>
        )}

        {/* Query Input */}
        <QueryInput onSubmit={handleSubmit} isLoading={isProcessing} disabled={isProcessing} />

        {/* Processing Status */}
        {(isProcessing || status === 'processing') && (
          <ProcessingStatus status={status} progress={progress} events={events} isProcessing={isProcessing} />
        )}

        {/* Results */}
        {data && data.results && data.results.length > 0 && !isProcessing && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <Stat value={`${stats.confidence}%`} label="Confidence" accent="cyan" />
              <Stat value={stats.platforms} label="Sources" accent="emerald" />
              <Stat value={stats.itemCount} label="Signals" accent="amber" />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <TrendSummary summary={data.summary} />
                
                <Card accent="cyan" className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-[var(--accent-cyan)]" />
                    <span className="text-sm font-black uppercase text-[var(--accent-cyan)]">Forge Ready</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] font-mono mb-3">Conviction dashboard ready for thesis generation.</p>
                  <Link href={activeQueryId ? `/meme/${activeQueryId}?view=meme` : '#'}>
                    <Button variant="primary" className="w-full">Open Forge →</Button>
                  </Link>
                </Card>
              </div>

              <div className="lg:col-span-2">
                <PlatformTabs results={data.results} />
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!queryId && !isProcessing && (
          <div className="text-center py-12 border-2 border-dashed border-[var(--text-muted)]">
            <div 
              className="w-16 h-16 mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-cyan)', boxShadow: '4px 4px 0px 0px var(--shadow-color)' }}
            >
              <Zap className="w-8 h-8 text-[var(--bg-primary)]" />
            </div>
            <h3 className="text-xl font-black uppercase mb-2">Initialize Analysis</h3>
            <p className="text-[var(--text-muted)] font-mono text-sm max-w-md mx-auto">
              Enter a research brief above. Trende will execute in a TEE-secured environment 
              and return verifiable intelligence.
            </p>
          </div>
        )}

        {/* Error State */}
        {data?.query?.status === 'failed' && (
          <div 
            className="border-2 p-6 text-center"
            style={{ backgroundColor: 'rgba(255, 68, 68, 0.1)', borderColor: 'var(--accent-rose)' }}
          >
            <h3 className="font-black uppercase mb-2 text-[var(--accent-rose)]">[!] Analysis Failed</h3>
            <p className="text-[var(--text-secondary)] font-mono text-sm">{data.query.errorMessage || 'Unknown error occurred.'}</p>
          </div>
        )}
      </main>
    </div>
  );
}
