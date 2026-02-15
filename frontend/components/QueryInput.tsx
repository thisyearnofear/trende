'use client';

import { useState, useCallback } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { QueryRequest } from '@/lib/types';

interface QueryInputProps {
  onSubmit: (request: QueryRequest) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const SUGGESTIONS = [
  'AI agents in blockchain',
  'Crypto regulation 2026',
  'Web3 gaming trends',
  'DeFi yield strategies',
  'NFT marketplace innovations',
];

export function QueryInput({ onSubmit, isLoading, disabled }: QueryInputProps) {
  const [idea, setIdea] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['twitter', 'newsapi']);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim() || isLoading || disabled) return;

    onSubmit({
      idea: idea.trim(),
      platforms,
    });
  }, [idea, platforms, onSubmit, isLoading, disabled]);

  const handleSuggestion = (suggestion: string) => {
    setIdea(suggestion);
  };

  const togglePlatform = (platform: string) => {
    setPlatforms(prev => 
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Query Input */}
        <div className="relative">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="What trends are you interested in? (e.g., AI agents in blockchain)"
            className="w-full h-32 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            disabled={disabled}
          />
          <button
            type="submit"
            disabled={!idea.trim() || isLoading || disabled}
            className="absolute bottom-3 right-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </span>
          </button>
        </div>

        {/* Platform Selection */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'twitter', label: '𝕏 Twitter', color: '#1DA1F2' },
            { id: 'linkedin', label: 'in LinkedIn', color: '#0A66C2' },
            { id: 'newsapi', label: '📰 News', color: '#FF6B35' },
            { id: 'web', label: '🌐 Web', color: '#6366F1' },
          ].map((platform) => (
            <button
              key={platform.id}
              type="button"
              onClick={() => togglePlatform(platform.id)}
              disabled={disabled}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                platforms.includes(platform.id)
                  ? 'bg-opacity-20 ring-1 ring-offset-2 ring-offset-slate-900'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700'
              }`}
              style={{
                backgroundColor: platforms.includes(platform.id) ? `${platform.color}33` : undefined,
                color: platforms.includes(platform.id) ? platform.color : undefined,
              }}
            >
              {platform.label}
            </button>
          ))}
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-2 items-center">
          <Sparkles className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-500">Try:</span>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSuggestion(suggestion)}
              disabled={disabled}
              className="text-sm text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
