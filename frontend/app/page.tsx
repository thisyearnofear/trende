'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTrendData, useTrendHistory } from '@/hooks/useTrendData';
import { QueryInput } from '@/components/QueryInput';
import { PlatformTabs } from '@/components/PlatformTabs';
import { TrendSummary } from '@/components/TrendSummary';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { QueryRequest } from '@/lib/types';
import {
  RefreshCw,
  History,
  Zap,
  Database,
  Network,
  LockKeyhole,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Fingerprint,
  Bot,
} from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [queryId, setQueryId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { status, data, isProcessing, progress, events, startAnalysis, refresh } = useTrendData(queryId);
  const { queries: history, isLoading: historyLoading } = useTrendHistory();

  const handleClear = useCallback(() => {
    setQueryId(null);
    setShowHistory(false);
  }, []);

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

  const stats = useMemo(() => {
    const platforms = new Set(data?.results.map((result) => result.platform) || []);
    const itemCount = data?.results.reduce((sum, result) => sum + result.items.length, 0) || 0;
    return { platforms: platforms.size, itemCount, confidence: Math.round((data?.summary?.confidenceScore || 0) * 100) };
  }, [data]);

  const activeQueryId = data?.query?.id || queryId;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-10">
      {/* Header */}
      <header className="border-b-2 border-white bg-[#0a0a0a] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2 sm:gap-3" onClick={handleClear}>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#00ffff] flex items-center justify-center shrink-0" style={{ boxShadow: '2px 2px 0px 0px #fff' }}>
                <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-black uppercase tracking-wider text-white truncate">TRENDE</h1>
                <p className="text-[10px] font-mono text-[#00ffff] truncate">TEE-SECURED</p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <button
                onClick={() => refresh()}
                disabled={!queryId}
                className="p-2.5 sm:p-2 border-2 border-white bg-[#0a0a0a] text-white hover:bg-white hover:text-black transition-colors disabled:opacity-30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                style={{ boxShadow: '2px 2px 0px 0px #fff' }}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2.5 sm:p-2 border-2 border-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                  showHistory ? 'bg-white text-black' : 'bg-[#0a0a0a] text-white hover:bg-white hover:text-black'
                }`}
                style={{ boxShadow: '2px 2px 0px 0px #fff' }}
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
          <div className="relative w-full sm:w-96 bg-[#0a0a0a] border-l-2 border-white p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black uppercase tracking-wider text-white">Mission History</h3>
              <button 
                onClick={() => setShowHistory(false)} 
                className="text-gray-500 hover:text-white min-h-[44px] px-2 font-mono"
              >
                [CLOSE]
              </button>
            </div>
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-[#141414] border-2 border-gray-800" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="text-gray-500 font-mono">NO MISSIONS ON RECORD</p>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectHistory(item.id)}
                    className="w-full text-left p-4 bg-[#141414] border-2 border-gray-800 hover:border-[#00ffff] transition-colors min-h-[44px]"
                  >
                    <p className="text-sm text-white line-clamp-2 font-mono">{item.idea}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 font-mono ${
                        item.status === 'completed' ? 'bg-[#00ff88] text-black' :
                        item.status === 'processing' ? 'bg-[#ffaa00] text-black' :
                        'bg-gray-700 text-white'
                      }`}>
                        {item.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        {!queryId && !isProcessing && (
          <div className="bg-[#141414] border-2 border-white p-6" style={{ boxShadow: '6px 6px 0px 0px #00ffff' }}>
            <div className="flex items-center gap-2 mb-4">
              <Fingerprint className="w-5 h-5 text-[#00ffff]" />
              <span className="text-xs font-mono text-[#00ffff]">EIGENCOMPUTE TEE // SECURE ENCLAVE</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-3">
              Turn Social Signal Into Conviction-Ready Intelligence
            </h2>
            <p className="text-gray-400 font-mono text-sm max-w-2xl">
              Run multi-platform research through verifiable TEE execution. 
              Cross-reference signals, validate consensus, generate cryptographic attestations.
            </p>
          </div>
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-[#141414] border-2 border-white p-4" style={{ boxShadow: '4px 4px 0px 0px #00ffff' }}>
                <p className="text-[10px] sm:text-xs font-mono text-gray-500 mb-1 truncate">CONFIDENCE_SCORE</p>
                <p className="text-2xl sm:text-3xl font-black text-[#00ffff]">{stats.confidence}%</p>
              </div>
              <div className="bg-[#141414] border-2 border-white p-4" style={{ boxShadow: '4px 4px 0px 0px #00ff88' }}>
                <p className="text-[10px] sm:text-xs font-mono text-gray-500 mb-1 truncate">SOURCES_ANALYZED</p>
                <p className="text-2xl sm:text-3xl font-black text-[#00ff88]">{stats.platforms}</p>
              </div>
              <div className="bg-[#141414] border-2 border-white p-4 col-span-2 md:col-span-1" style={{ boxShadow: '4px 4px 0px 0px #ffaa00' }}>
                <p className="text-[10px] sm:text-xs font-mono text-gray-500 mb-1 truncate">SIGNALS_CAPTURED</p>
                <p className="text-2xl sm:text-3xl font-black text-[#ffaa00]">{stats.itemCount}</p>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <TrendSummary summary={data.summary} />
                
                {/* Forge Link */}
                <div className="bg-[#141414] border-2 border-[#00ffff] p-4" style={{ boxShadow: '4px 4px 0px 0px #00ffff' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-[#00ffff]" />
                    <span className="text-sm font-black uppercase text-[#00ffff]">Forge Ready</span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mb-3">Conviction dashboard ready for thesis generation.</p>
                  <Link
                    href={activeQueryId ? `/meme/${activeQueryId}?view=meme` : '#'}
                    className="block w-full py-2 bg-[#00ffff] text-black text-center font-black uppercase text-sm border-2 border-white hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
                    style={{ boxShadow: '3px 3px 0px 0px #fff' }}
                  >
                    Open Forge →
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-2">
                <PlatformTabs results={data.results} />
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!queryId && !isProcessing && (
          <div className="text-center py-12 border-2 border-dashed border-gray-800">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#00ffff] flex items-center justify-center" style={{ boxShadow: '4px 4px 0px 0px #fff' }}>
              <Zap className="w-8 h-8 text-black" />
            </div>
            <h3 className="text-xl font-black uppercase text-white mb-2">Initialize Analysis</h3>
            <p className="text-gray-500 font-mono text-sm max-w-md mx-auto">
              Enter a research brief above. Trende will execute in a TEE-secured environment 
              and return verifiable intelligence.
            </p>
          </div>
        )}

        {/* Error State */}
        {data?.query?.status === 'failed' && (
          <div className="bg-[#ff4444]/10 border-2 border-[#ff4444] p-6 text-center">
            <h3 className="text-[#ff4444] font-black uppercase mb-2">[!] Analysis Failed</h3>
            <p className="text-gray-400 font-mono text-sm">{data.query.errorMessage || 'Unknown error occurred.'}</p>
          </div>
        )}
      </main>
    </div>
  );
}
