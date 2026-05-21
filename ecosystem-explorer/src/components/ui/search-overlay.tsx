/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { search as performSearch } from "@/lib/search";
import { X, Search, ChevronRight } from "lucide-react";
import type { SearchResult } from "@/lib/search";

const RECENT_SEARCHES_KEY = "otel_recent_searches";

interface SearchOverlayProps {
  onClose: () => void;
  onSelect?: (query: string) => void;
}

export function SearchOverlay({ onClose, onSelect }: SearchOverlayProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) {
      return [];
    }

    try {
      return JSON.parse(stored) as string[];
    } catch {
      return [];
    }
  });
  const searchTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const recordSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      return;
    }

    const updated = [searchQuery, ...recentSearches.filter((x) => x !== searchQuery)].slice(0, 6);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  // Use a debounced search triggered from the input handler instead of an
  // effect so we avoid calling setState synchronously inside `useEffect`.
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // Handle search selection
  const handleSelect = (q: string, path?: string) => {
    recordSearch(q);

    if (path) {
      navigate(path);
    }

    onSelect?.(q);
    setQuery("");
    onClose();
  };

  const handleClearRecent = () => {
    setActiveIndex(0);
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  const handleRecentSearch = async (searchQuery: string) => {
    const results = await performSearch(searchQuery);
    if (results.length > 0) {
      handleSelect(searchQuery, results[0].path);
    } else {
      handleSelect(searchQuery);
    }
  };

  // Show recent searches if empty query, otherwise show search results
  const showRecent = !query.trim();
  const visibleItems = showRecent
    ? recentSearches.map((searchQuery) => ({
        kind: "recent" as const,
        key: searchQuery,
        label: searchQuery,
      }))
    : searchResults.map((result) => ({
        kind: "result" as const,
        key: result.path,
        label: result.title,
        result,
      }));

  const safeActiveIndex =
    visibleItems.length > 0 ? Math.min(activeIndex, visibleItems.length - 1) : 0;

  useEffect(() => {
    const activeItem = itemRefs.current[safeActiveIndex];
    if (activeItem) {
      activeItem.scrollIntoView({ block: "nearest" });
    }
  }, [safeActiveIndex]);

  const selectVisibleItem = (index: number) => {
    const item = visibleItems[index];
    if (!item) {
      return;
    }

    if (item.kind === "recent") {
      void handleRecentSearch(item.label);
      return;
    }

    handleSelect(item.label, item.result.path);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Overlay panel */}
      <div className="border-border/20 bg-background fixed inset-x-0 top-16 z-50 mx-auto max-w-2xl rounded-lg border shadow-lg">
        {/* Search input */}
        <div className="border-border/20 flex items-center gap-3 border-b px-4 py-3">
          <Search className="text-muted-foreground h-5 w-5" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, instrumentations, and components..."
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);

              if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
              }

              const trimmed = val.trim();
              if (!trimmed) {
                // Clear search results when input is empty.
                setSearchResults([]);
                setIsSearching(false);
                setActiveIndex(0);
                return;
              }

              setActiveIndex(0);
              searchTimerRef.current = window.setTimeout(() => {
                setIsSearching(true);
                void performSearch(trimmed)
                  .then((results) => {
                    setSearchResults(results);
                    setActiveIndex(0);
                  })
                  .catch(() => {
                    setSearchResults([]);
                    setActiveIndex(0);
                  })
                  .finally(() => {
                    setIsSearching(false);
                  });
              }, 250);
            }}
            onKeyDown={(e) => {
              if ((e.key === "ArrowDown" || e.key === "ArrowUp") && visibleItems.length > 0) {
                e.preventDefault();

                setActiveIndex((currentIndex) => {
                  const nextIndex =
                    e.key === "ArrowDown"
                      ? (currentIndex + 1) % visibleItems.length
                      : (currentIndex - 1 + visibleItems.length) % visibleItems.length;

                  return nextIndex;
                });
              } else if (e.key === "Enter") {
                if (visibleItems.length > 0) {
                  e.preventDefault();
                  selectVisibleItem(safeActiveIndex);
                } else if (query.trim()) {
                  handleSelect(query);
                }
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
            aria-label="Search"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Suggestions or recent searches */}
        <div className="max-h-96 overflow-y-auto">
          {isSearching && !showRecent ? (
            <div className="text-muted-foreground px-4 py-8 text-center text-sm">Searching...</div>
          ) : searchResults.length > 0 && !showRecent ? (
            <>
              <div className="text-muted-foreground px-4 py-2 text-xs font-semibold">Results</div>
              <ul className="space-y-1 px-2 py-2">
                {searchResults.map((result, index) => (
                  <li key={result.path}>
                    <Link
                      to={result.path}
                      onClick={() => handleSelect(result.title, result.path)}
                      onMouseEnter={() => setActiveIndex(index)}
                      ref={(node) => {
                        itemRefs.current[index] = node;
                      }}
                      className={`text-foreground flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors ${
                        safeActiveIndex === index ? "bg-accent" : "hover:bg-accent/70"
                      }`}
                    >
                      <div>
                        <div className="font-medium">{result.title}</div>
                        <div className="text-muted-foreground text-xs">{result.description}</div>
                      </div>
                      <ChevronRight className="text-muted-foreground ml-2 h-4 w-4 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : recentSearches.length > 0 && showRecent ? (
            <>
              <div className="text-muted-foreground px-4 py-2 text-xs font-semibold">
                Recent Searches
              </div>
              <ul className="space-y-1 px-2 py-2">
                {recentSearches.map((searchQuery, index) => (
                  <li key={searchQuery}>
                    <button
                      onClick={() => {
                        void handleRecentSearch(searchQuery);
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      ref={(node) => {
                        itemRefs.current[index] = node;
                      }}
                      className={`text-foreground w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                        safeActiveIndex === index ? "bg-accent" : "hover:bg-accent/70"
                      }`}
                    >
                      <Search className="text-muted-foreground mr-2 inline h-4 w-4" />
                      {searchQuery}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={handleClearRecent}
                className="text-muted-foreground hover:text-foreground border-border/20 w-full border-t px-4 py-2 text-xs"
              >
                Clear recent searches
              </button>
            </>
          ) : query.trim() ? (
            <div className="text-muted-foreground px-4 py-8 text-center text-sm">
              No results for "{query.trim()}"
            </div>
          ) : (
            <div className="text-muted-foreground px-4 py-8 text-center text-sm">
              Start typing to search
            </div>
          )}
        </div>
      </div>
    </>
  );
}
