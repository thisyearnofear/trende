"use client";

import { Card, Button } from "@/components/DesignSystem";
import { ListTree, ExternalLink } from "lucide-react";
import Link from "next/link";

interface CommonsItem {
  id: string;
  topic: string;
  platforms: string[];
  hasAttestation: boolean;
  sponsor: string | null;
  createdAt: string;
}

interface CommonsSectionProps {
  commonsResearch: CommonsItem[];
  commonsLoading: boolean;
  showCommons: boolean;
  setShowCommons: (show: boolean) => void;
  commonsSearch: string;
  setCommonsSearch: (search: string) => void;
  visibleCommons: CommonsItem[];
  filteredCommons: CommonsItem[];
  setCommonsVisibleCount: (count: number) => void;
  onLoadItem: (id: string) => void;
}

export function CommonsSection({
  commonsResearch,
  commonsLoading,
  showCommons,
  setShowCommons,
  commonsSearch,
  setCommonsSearch,
  visibleCommons,
  filteredCommons,
  setCommonsVisibleCount,
  onLoadItem,
}: CommonsSectionProps) {
  return (
    <div>
      <Card accent="emerald" className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListTree className="w-4 h-4 text-[var(--accent-emerald)]" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">
                Community Commons
              </h3>
              <p className="text-xs font-mono text-[var(--text-muted)]">
                Public completed research runs from the network (saved with visibility = PUBLIC)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[var(--text-muted)]">
              {commonsLoading ? "Loading..." : `${commonsResearch.length} runs`}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCommons((prev) => !prev)}
            >
              {showCommons ? "Hide" : "Explore"}
            </Button>
            <Link href="/commons">
              <Button variant="ghost" size="sm">
                Full Page
                <ExternalLink className="w-3.5 h-3.5 ml-1 inline-block" />
              </Button>
            </Link>
          </div>
        </div>

        {showCommons && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={commonsSearch}
                onChange={(event) => {
                  setCommonsSearch(event.target.value);
                  setCommonsVisibleCount(2);
                }}
                placeholder="Filter by topic or platform..."
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border-2 border-[var(--border-color)] font-mono text-sm focus:outline-none focus:border-[var(--accent-emerald)]"
              />
              <div className="text-xs font-mono text-[var(--text-muted)] border-2 border-[var(--border-color)] px-3 py-2 bg-[var(--bg-primary)]">
                Showing {visibleCommons.length} / {filteredCommons.length}
              </div>
            </div>
            <p className="text-[11px] font-mono text-[var(--text-muted)]">
              Runs set to <span className="text-[var(--accent-emerald)] font-black">PUBLIC</span> appear here.{" "}
              <span className="text-[var(--text-secondary)]">UNLISTED runs stay shareable via direct proof link only.</span>
            </p>

            {commonsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {[1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="h-36 border-2 border-[var(--border-color)] bg-[var(--bg-primary)] animate-pulse"
                  />
                ))}
              </div>
            ) : filteredCommons.length === 0 ? (
              <div className="p-4 border-2 border-dashed border-[var(--border-color)] text-sm font-mono text-[var(--text-muted)]">
                No commons runs match this filter.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {visibleCommons.map((item) => (
                    <div
                      key={item.id}
                      className="border-2 border-[var(--border-color)] bg-[var(--bg-primary)] p-3 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-sm line-clamp-3">{item.topic}</p>
                        {item.hasAttestation && (
                          <span className="shrink-0 text-[10px] font-black uppercase px-2 py-0.5 bg-[var(--accent-emerald)] text-[var(--bg-primary)]">
                            Attested
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.platforms.slice(0, 4).map((platform) => (
                          <span
                            key={platform}
                            className="text-[10px] font-mono px-1.5 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] uppercase"
                          >
                            {platform}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
                        <span>
                          {item.sponsor
                            ? `${item.sponsor.slice(0, 6)}...${item.sponsor.slice(-4)}`
                            : "Anonymous"}
                        </span>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          onClick={() => onLoadItem(item.id)}
                        >
                          Load Here
                        </Button>
                        <Link href={`/proof/${item.id}`} className="flex-1">
                          <Button variant="ghost" size="sm" className="w-full">
                            Open Proof
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredCommons.length > visibleCommons.length && (
                  <div className="flex justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setCommonsVisibleCount((prev) => Math.min(prev + 2, filteredCommons.length))
                      }
                    >
                      Load More
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
