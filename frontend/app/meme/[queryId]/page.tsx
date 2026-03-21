'use client';

import { use, useEffect } from 'react';
import { useTrendData } from '@/hooks/useTrendData';
import { ReportViewer } from '@/components/ReportViewer';
import { Zap, ArrowLeft, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function MemePage({ params }: { params: Promise<{ queryId: string }> }) {
  const { queryId } = use(params);
  const searchParams = useSearchParams();
  const viewMode = (searchParams.get('view') as 'meme' | 'news') || 'meme';

  const { data, isProcessing, status } = useTrendData(queryId);

  useEffect(() => {
    if (typeof window !== 'undefined' && queryId) {
      window.localStorage.setItem('trende:last_query_id', queryId);
    }
  }, [queryId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Dynamic Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-24 -right-24 w-96 h-96 blur-[120px] rounded-full opacity-20 transition-colors duration-1000 ${viewMode === 'meme' ? 'bg-cyan-500' : 'bg-emerald-500'
          }`} />
        <div className={`absolute top-1/2 -left-24 w-64 h-64 blur-[120px] rounded-full opacity-10 transition-colors duration-1000 ${viewMode === 'meme' ? 'bg-purple-500' : 'bg-blue-500'
          }`} />
      </div>

      <header className="border-b border-white/5 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Back to Laboratory</span>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                href={`/meme/${queryId}?view=meme`}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${viewMode === 'meme'
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                  : 'border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Meme Thesis
              </Link>
              <Link
                href={`/meme/${queryId}?view=news`}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${viewMode === 'news'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Verifiable News
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 relative z-10">
        {!data || isProcessing ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-6">
            <div className="relative">
              <div className={`w-20 h-20 rounded-3xl animate-pulse blur-xl mix-blend-screen absolute -inset-2 ${viewMode === 'meme' ? 'bg-cyan-500' : 'bg-emerald-500'
                }`} />
              <div className="w-20 h-20 bg-slate-900 border border-slate-700 rounded-3xl flex items-center justify-center relative">
                <Loader2 className={`w-10 h-10 animate-spin ${viewMode === 'meme' ? 'text-cyan-400' : 'text-emerald-400'
                  }`} />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-100">
                {isProcessing ? 'Forging Conviction...' : 'Waking up the Agent...'}
              </h2>
              <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest">
                {status || 'Connecting to brain'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {data.summary && <ReportViewer summary={data.summary} mode={viewMode} queryId={queryId} />}
          </div>
        )}
      </main>

      {/* Verification footer */}
      <footer className="max-w-5xl mx-auto px-4 py-12 border-t border-white/5 opacity-50 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2 grayscale brightness-50 contrast-125">
          <Zap className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Hetzner Runtime Verified</span>
        </div>
        <div className="w-px h-4 bg-slate-800" />
        <div className="flex items-center gap-2 grayscale brightness-50 contrast-125">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Unbiased Consensus</span>
        </div>
      </footer>
    </div>
  );
}
