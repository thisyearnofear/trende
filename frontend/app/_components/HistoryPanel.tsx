"use client";

import { Card, Button } from "@/components/DesignSystem";
import { QueryRequest } from "@/lib/types";

interface HistoryItem {
  id: string;
  idea: string;
  status: string;
  createdAt: string;
}

interface SavedItem {
  id: string;
  saveLabel: string | null;
  idea: string;
  visibility: string;
  ipfsUri: string | null;
  savedAt: string;
}

interface HistoryPanelProps {
  showHistory: boolean;
  onClose: () => void;
  historyMode: "recent" | "saved";
  setHistoryMode: (mode: "recent" | "saved") => void;
  history: HistoryItem[];
  historyLoading: boolean;
  savedResearch: SavedItem[];
  savedLoading: boolean;
  isConnected: boolean;
  onSelectHistory: (id: string) => void;
}

export function HistoryPanel({
  showHistory,
  onClose,
  historyMode,
  setHistoryMode,
  history,
  historyLoading,
  savedResearch,
  savedLoading,
  isConnected,
  onSelectHistory,
}: HistoryPanelProps) {
  if (!showHistory) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-[var(--bg-primary)]/80"
        onClick={onClose}
      />
      <Card
        className="relative w-full sm:w-96 h-full rounded-none"
        accent="cyan"
      >
        <div className="flex items-center justify-between p-4 border-b-2 border-[var(--border-color)]">
          <h3 className="font-black uppercase tracking-wider">
            Mission History
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] font-mono min-h-[44px] min-w-[44px] flex items-center justify-center px-3"
            aria-label="Close history panel"
          >
            [CLOSE]
          </button>
        </div>
        <div className="px-4 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={historyMode === "recent" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setHistoryMode("recent")}
            >
              Recent
            </Button>
            <Button
              variant={historyMode === "saved" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setHistoryMode("saved")}
              disabled={!isConnected}
            >
              Saved
            </Button>
          </div>
        </div>
        <div className="p-3 sm:p-4 overflow-y-auto max-h-[calc(100vh-180px)]">
          {historyMode === "saved" && !isConnected ? (
            <p className="text-[var(--text-muted)] font-mono text-xs sm:text-sm">
              CONNECT WALLET TO VIEW SAVED RESEARCH
            </p>
          ) : historyMode === "saved" ? (
            savedLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 sm:h-16 bg-[var(--bg-primary)] border-2 border-[var(--text-muted)]"
                  />
                ))}
              </div>
            ) : savedResearch.length === 0 ? (
              <p className="text-[var(--text-muted)] font-mono text-xs sm:text-sm">
                NO SAVED RUNS YET. SAVE A COMPLETED RUN TO SEE IT HERE.
              </p>
            ) : (
              <div className="space-y-2">
                {savedResearch.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectHistory(item.id)}
                    className="w-full text-left p-2 sm:p-2.5 md:p-3 bg-[var(--bg-primary)] border-2 border-[var(--text-muted)] hover:border-[var(--accent-cyan)] transition-colors"
                  >
                    <p className="text-xs sm:text-sm line-clamp-2 font-mono">
                      {item.saveLabel || item.idea}
                    </p>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2 flex-wrap">
                      <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 font-mono bg-[var(--accent-emerald)] text-[var(--bg-primary)]">
                        {item.visibility.toUpperCase()}
                      </span>
                      {item.ipfsUri && (
                        <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 font-mono bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                          ARCHIVED
                        </span>
                      )}
                      <span className="text-[10px] sm:text-xs text-[var(--text-muted)] font-mono">
                        {new Date(item.savedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : historyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 sm:h-16 bg-[var(--bg-primary)] border-2 border-[var(--text-muted)]"
                />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-[var(--text-muted)] font-mono text-xs sm:text-sm">
              NO MISSIONS ON RECORD. THIS LIST SHOWS SERVER-STORED RUNS.
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectHistory(item.id)}
                  className="w-full text-left p-2 sm:p-2.5 md:p-3 bg-[var(--bg-primary)] border-2 border-[var(--text-muted)] hover:border-[var(--accent-cyan)] transition-colors"
                >
                  <p className="text-xs sm:text-sm line-clamp-2 font-mono">
                    {item.idea}
                  </p>
                  <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                    <span
                      className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 font-mono ${item.status === "completed"
                        ? "bg-[var(--accent-emerald)] text-[var(--bg-primary)]"
                        : item.status === "processing"
                          ? "bg-[var(--accent-amber)] text-[var(--bg-primary)]"
                          : "bg-[var(--text-muted)] text-[var(--text-primary)]"
                        }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                    <span className="text-[10px] sm:text-xs text-[var(--text-muted)] font-mono">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
