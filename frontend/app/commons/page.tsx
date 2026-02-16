'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Globe, 
  ShieldCheck, 
  ArrowLeft, 
  Search, 
  Wallet, 
  ExternalLink,
  Zap,
  Filter,
} from 'lucide-react';
import { WalletButton } from '@/components/WalletButton';
import { formatAddress } from '@/lib/wallet';

interface ResearchItem {
  id: string;
  topic: string;
  sponsor: string | null;
  platforms: string[];
  hasAttestation: boolean;
  createdAt: string;
}

interface CommonsResponse {
  research: ResearchItem[];
  total: number;
  filter: {
    sponsor: string | null;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function CommonsPage() {
  const [research, setResearch] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sponsorFilter, setSponsorFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchResearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sponsorFilter) params.set('sponsor', sponsorFilter);
      
      const response = await fetch(`${API_BASE}/api/commons?${params}`);
      const data: CommonsResponse = await response.json();
      setResearch(data.research);
    } catch (error) {
      console.error('Failed to fetch commons:', error);
    } finally {
      setLoading(false);
    }
  }, [sponsorFilter]);

  useEffect(() => {
    fetchResearch();
  }, [sponsorFilter, fetchResearch]);

  const filteredResearch = research.filter(item =>
    !searchQuery || item.topic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-10">
      {/* Header */}
      <header className="border-b-2 border-white bg-[#0a0a0a] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 text-gray-500 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#00ff88] flex items-center justify-center shrink-0" style={{ boxShadow: '2px 2px 0px 0px #fff' }}>
                  <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-lg font-black uppercase tracking-wider text-white truncate">RESEARCH COMMONS</h1>
                  <p className="text-[10px] font-mono text-[#00ff88] truncate">PUBLIC INTELLIGENCE</p>
                </div>
              </div>
            </div>
            <WalletButton compact />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="bg-[#141414] border-2 border-white p-6" style={{ boxShadow: '6px 6px 0px 0px #00ff88' }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-[#00ff88]" />
            <span className="text-xs font-mono text-[#00ff88]">MONAD // RESEARCH COMMONS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-3">
            Verifiable Intelligence for Everyone
          </h2>
          <p className="text-gray-400 font-mono text-sm max-w-2xl">
            Browse research funded by the Monad community. Every analysis is TEE-attested 
            and permanently verifiable. Connect your wallet to sponsor new research.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search research topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[#141414] border-2 border-gray-800 text-white font-mono focus:border-[#00ff88] focus:outline-none transition-colors"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Filter by sponsor (0x...)"
              value={sponsorFilter}
              onChange={(e) => setSponsorFilter(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-3 bg-[#141414] border-2 border-gray-800 text-white font-mono focus:border-[#00ff88] focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-[#141414] border-2 border-white p-4" style={{ boxShadow: '4px 4px 0px 0px #00ff88' }}>
            <p className="text-[10px] sm:text-xs font-mono text-gray-500 mb-1">TOTAL_RESEARCH</p>
            <p className="text-2xl sm:text-3xl font-black text-[#00ff88]">{research.length}</p>
          </div>
          <div className="bg-[#141414] border-2 border-white p-4" style={{ boxShadow: '4px 4px 0px 0px #00ffff' }}>
            <p className="text-[10px] sm:text-xs font-mono text-gray-500 mb-1">TEE_ATTESTED</p>
            <p className="text-2xl sm:text-3xl font-black text-[#00ffff]">
              {research.filter(r => r.hasAttestation).length}
            </p>
          </div>
          <div className="bg-[#141414] border-2 border-white p-4 col-span-2 sm:col-span-1" style={{ boxShadow: '4px 4px 0px 0px #ffaa00' }}>
            <p className="text-[10px] sm:text-xs font-mono text-gray-500 mb-1">UNIQUE_SPONSORS</p>
            <p className="text-2xl sm:text-3xl font-black text-[#ffaa00]">
              {new Set(research.filter(r => r.sponsor).map(r => r.sponsor)).size}
            </p>
          </div>
        </div>

        {/* Research Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-[#141414] border-2 border-gray-800 animate-pulse" />
            ))}
          </div>
        ) : filteredResearch.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-800">
            <Globe className="w-16 h-16 mx-auto mb-4 text-gray-700" />
            <h3 className="text-xl font-black uppercase text-white mb-2">No Research Found</h3>
            <p className="text-gray-500 font-mono text-sm">
              {searchQuery || sponsorFilter 
                ? 'Try adjusting your filters'
                : 'Be the first to contribute to the commons'}
            </p>
            <Link
              href="/"
              className="inline-block mt-6 px-6 py-3 bg-[#00ff88] text-black font-black uppercase text-sm border-2 border-white hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
              style={{ boxShadow: '4px 4px 0px 0px #fff' }}
            >
              Start Research →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResearch.map((item) => (
              <Link
                key={item.id}
                href={`/proof/${item.id}`}
                className="group bg-[#141414] border-2 border-gray-800 hover:border-[#00ff88] p-5 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
                style={{ boxShadow: '4px 4px 0px 0px transparent' }}
              >
                {/* Attestation Badge */}
                {item.hasAttestation && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <ShieldCheck className="w-4 h-4 text-[#00ff88]" />
                    <span className="text-[10px] font-mono text-[#00ff88] uppercase">TEE Attested</span>
                  </div>
                )}

                {/* Topic */}
                <h3 className="text-white font-black uppercase text-sm mb-3 line-clamp-2 group-hover:text-[#00ff88] transition-colors">
                  {item.topic}
                </h3>

                {/* Platforms */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {item.platforms.slice(0, 3).map((platform) => (
                    <span
                      key={platform}
                      className="px-2 py-0.5 bg-gray-900 text-gray-400 text-[10px] font-mono uppercase"
                    >
                      {platform}
                    </span>
                  ))}
                  {item.platforms.length > 3 && (
                    <span className="px-2 py-0.5 text-gray-500 text-[10px] font-mono">
                      +{item.platforms.length - 3}
                    </span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                  {item.sponsor ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <Wallet className="w-3 h-3" />
                      <span className="font-mono">{formatAddress(item.sponsor)}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-600 font-mono">Anonymous</span>
                  )}
                  <span className="text-[10px] text-gray-600 font-mono">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* View Indicator */}
                <div className="flex items-center gap-1 mt-3 text-[10px] text-gray-500 group-hover:text-[#00ff88] transition-colors">
                  <ExternalLink className="w-3 h-3" />
                  <span className="font-mono uppercase">View Proof</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-r from-[#00ff88]/10 to-[#00ffff]/10 border-2 border-[#00ff88]/30 p-6 text-center">
          <h3 className="text-lg font-black uppercase text-white mb-2">Contribute to the Commons</h3>
          <p className="text-gray-400 font-mono text-sm mb-4 max-w-md mx-auto">
            Connect your wallet and run research. All verified intelligence becomes part of the public commons.
          </p>
          <Link
            href="/"
            className="inline-block px-8 py-3 bg-[#00ff88] text-black font-black uppercase text-sm border-2 border-white hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
            style={{ boxShadow: '4px 4px 0px 0px #fff' }}
          >
            Start Research →
          </Link>
        </div>
      </main>
    </div>
  );
}
