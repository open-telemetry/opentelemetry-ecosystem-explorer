import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { search as performSearch } from "@/lib/search";
import { X, Search, ChevronRight } from "lucide-react";

const RECENT_SEARCHES_KEY = "otel_recent_searches";

interface SearchOverlayProps {
  onClose: () => void;
  onSelect?: (query: string) => void;
}

export function SearchOverlay({ onClose, onSelect }: SearchOverlayProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debouncedQuery = useDebouncedValue(query, 250);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch {
        setRecentSearches([]);
      }
    }
  }, []);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle search selection
  const handleSelect = (q: string, path?: string) => {
    if (q.trim()) {
      // Add to recent searches
      const updated = [q, ...recentSearches.filter((x) => x !== q)].slice(0, 6);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    }
    
    if (path) {
      navigate(path);
    }
    
    onSelect?.(q);
    setQuery("");
    onClose();
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  // Get search results if query is debounced
  const searchResults = performSearch(debouncedQuery);
  
  // Show recent searches if empty query, otherwise show search results
  const showRecent = !query.trim();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Overlay panel */}
      <div className="fixed inset-x-0 top-16 z-50 mx-auto max-w-2xl rounded-lg border border-border/20 bg-background shadow-lg">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border/20 px-4 py-3">
          <Search className="text-muted-foreground h-5 w-5" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search instrumentations, collectors..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) {
                handleSelect(query);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-sm"
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
          {searchResults.length > 0 && !showRecent ? (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                Results
              </div>
              <ul className="space-y-1 px-2 py-2">
                {searchResults.map((result) => (
                  <li key={result.path}>
                    <button
                      onClick={() => handleSelect(result.title, result.path)}
                      className="w-full text-left rounded px-3 py-2 text-sm hover:bg-accent text-foreground transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{result.title}</div>
                        <div className="text-xs text-muted-foreground">{result.description}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : recentSearches.length > 0 && showRecent ? (
            <>
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                Recent Searches
              </div>
              <ul className="space-y-1 px-2 py-2">
                {recentSearches.map((searchQuery) => (
                  <li key={searchQuery}>
                    <button
                      onClick={() => {
                        const results = performSearch(searchQuery);
                        if (results.length > 0) {
                          handleSelect(searchQuery, results[0].path);
                        } else {
                          handleSelect(searchQuery);
                        }
                      }}
                      className="w-full text-left rounded px-3 py-2 text-sm hover:bg-accent text-foreground transition-colors"
                    >
                      <Search className="mr-2 inline h-4 w-4 text-muted-foreground" />
                      {searchQuery}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={handleClearRecent}
                className="w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground border-t border-border/20"
              >
                Clear recent searches
              </button>
            </>
          ) : query.trim() ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results for "{debouncedQuery}"
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Start typing to search
            </div>
          )}
        </div>
      </div>
    </>
  );
}
