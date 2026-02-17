import { useState, useEffect } from 'react';
import { Button, Input } from '@/components/DesignSystem';
import { CheckCircle2, ExternalLink, Loader2, X, Zap } from 'lucide-react';

interface ParagraphConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (apiKey: string) => void;
}

export function ParagraphConnectModal({ isOpen, onClose, onConnect }: ParagraphConnectModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setApiKey('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsValidating(true);
    setError(null);

    try {
      if (apiKey.length < 10) {
        throw new Error("Invalid API Key format");
      }

      // Simulate validation delay
      await new Promise(resolve => setTimeout(resolve, 800));

      onConnect(apiKey);
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to validate key");
      }
    } finally {
      setIsValidating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className="relative w-full max-w-md bg-[#0a0a0a] border-2 border-stone-800 text-stone-100 p-6 shadow-2xl"
        style={{ boxShadow: '6px 6px 0px 0px #10b981' }} // Emerald shadow
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xl text-emerald-400">⚡</span>
            <h2 className="text-xl font-black uppercase tracking-tight">Connect Paragraph</h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 text-sm text-stone-400 font-mono">
          Link your Paragraph account to publish trend reports directly as drafts.
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="bg-stone-900/50 p-4 border border-stone-800 space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-stone-200">How to get your API Key</h3>
              <ol className="list-decimal list-inside text-xs text-stone-400 space-y-2 font-mono">
                <li>Log in to <a href="https://paragraph.xyz/dashboard" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline inline-flex items-center gap-1">Paragraph <ExternalLink className="w-3 h-3" /></a></li>
                <li>Go to <strong>Settings</strong> &gt; <strong>API</strong></li>
                <li>Copy <strong>Personal Access Token</strong></li>
              </ol>
            </div>

            <div className="space-y-2">
              <label htmlFor="apiKey" className="text-xs font-black uppercase tracking-wider text-stone-500">API Key</label>
              <Input
                value={apiKey}
                onChange={(val) => setApiKey(val)}
                placeholder="para_..."
                className="font-mono"
              />
              {error && <p className="text-red-400 text-xs font-mono mt-1">{error}</p>}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!apiKey || isValidating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700"
            >
              {isValidating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Save & Connect
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
