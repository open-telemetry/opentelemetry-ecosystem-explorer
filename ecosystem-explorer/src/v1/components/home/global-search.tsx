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

/*
 * GlobalSearch — top-of-home cross-ecosystem search input.
 *
 * Controlled input with ⌘K / Ctrl+K shortcut, suggestion chips, and a
 * keyboard-navigable results dropdown backed by `src/lib/search.ts`.
 * Persists the last query under `sessionStorage["explorer:lastSearch"]` so
 * a reload reproduces it. Per the v1 typescript-frontend rules the actual
 * fetch lives in `useSearch()`; this component is render + interaction
 * only.
 *
 * Row template (locked 2026-05-25): `[ecosystem pill] title [stability pill]`
 * on row 1; 2-line-clamped description on row 2; `ecosystem · type · version`
 * meta on row 3. Cap of 10 visible results with a "Showing 10 of N" footer.
 */

import { Search } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GlowBadge } from "@/components/ui/glow-badge";
import { StatusPill } from "@/components/ui/status-pill";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { SearchResult, SearchResultEcosystem } from "@/lib/search";
import { useSearch } from "@/v1/hooks/use-search";

const STORAGE_KEY = "explorer:lastSearch";
const SEARCH_DEBOUNCE_MS = 200;
const MAX_VISIBLE_RESULTS = 10;

const DEFAULT_SUGGESTIONS = [
  { label: "otlp exporter" },
  { label: "redis instrumentation" },
  { label: "kafka receiver" },
  { label: "trace sampling" },
];

type GlowVariant = "accent" | "secondary" | "success" | "info" | "warning" | "error" | "muted";

const ECOSYSTEM_VARIANT: Record<SearchResultEcosystem, GlowVariant> = {
  collector: "info", // blue family — Collector is the technical-platform face
  "java-agent": "accent", // OTel-secondary (orange) — Java Agent is brand-forward
  page: "muted", // navigational chrome, low emphasis
};

function metaLine(result: SearchResult): string {
  return [result.ecosystem, result.componentType, result.version].filter(Boolean).join(" · ");
}

export interface GlobalSearchProps {
  placeholder?: string;
  /** Override navigation (mostly for tests). Default uses react-router's navigate. */
  onSelect?: (path: string) => void;
}

export function GlobalSearch({
  placeholder = "Search 1,005+ components, instrumentations, vendors…",
  onSelect,
}: GlobalSearchProps) {
  const [query, setQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.sessionStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<Map<number, HTMLAnchorElement>>(new Map());
  const navigate = useNavigate();
  const idPrefix = useId();

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const { data: results, loading, error } = useSearch(debouncedQuery);
  const visibleResults = useMemo(() => (results ?? []).slice(0, MAX_VISIBLE_RESULTS), [results]);
  const totalMatches = results?.length ?? 0;
  const overflowCount = totalMatches - visibleResults.length;
  const hasVisibleResults = visibleResults.length > 0;
  const showDropdown = isOpen && Boolean(query.trim());

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, query);
    } catch {
      /* sessionStorage may be unavailable (private mode, sandboxing) — ignore */
    }
  }, [query]);

  // Clamp the highlight so it never points outside the current result set.
  // Resetting to 0 on `onChange` covers the typing case; this guard covers
  // the loading → loaded and error → loaded transitions without needing a
  // setState-inside-effect (which the react-hooks/set-state-in-effect rule
  // flags as a cascading-render smell).
  const safeHighlightedIndex = hasVisibleResults
    ? Math.min(highlightedIndex, visibleResults.length - 1)
    : 0;

  // Scroll the highlighted row into the dropdown viewport when arrow nav
  // moves the highlight outside the visible area.
  useEffect(() => {
    if (!hasVisibleResults) return;
    const el = optionsRef.current.get(safeHighlightedIndex);
    el?.scrollIntoView({ block: "nearest" });
  }, [safeHighlightedIndex, hasVisibleResults]);

  // Global ⌘K / Escape handler — focus the input from anywhere, close the
  // dropdown without consuming Escape elsewhere.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selectResult = useCallback(
    (path: string) => {
      if (onSelect) onSelect(path);
      else navigate(path);
      setIsOpen(false);
    },
    [navigate, onSelect]
  );

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!hasVisibleResults) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((i) => (i + 1) % visibleResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((i) => (i - 1 + visibleResults.length) % visibleResults.length);
    } else if (event.key === "Enter") {
      const target = visibleResults[safeHighlightedIndex];
      if (target) {
        event.preventDefault();
        selectResult(target.path);
      }
    }
  };

  const activeOptionId = hasVisibleResults
    ? `${idPrefix}-option-${safeHighlightedIndex}`
    : undefined;
  // Keep-stale-while-loading: when a new query is in flight but prior results
  // exist, dim them instead of blanking to "Searching…". Only blank on the
  // very first search.
  const isStaleLoading = loading && hasVisibleResults;

  return (
    <div ref={containerRef} className="td-search">
      <div className="td-search__input-wrapper">
        <Search className="td-search__icon" aria-hidden focusable="false" />
        <input
          ref={inputRef}
          className="td-search__input"
          type="search"
          role="combobox"
          aria-label="Search the ecosystem"
          aria-expanded={showDropdown && hasVisibleResults}
          aria-controls={`${idPrefix}-results`}
          aria-activedescendant={activeOptionId}
          aria-busy={loading}
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={onInputKeyDown}
        />
        <kbd className="td-search__kbd" aria-hidden>
          ⌘K
        </kbd>
      </div>

      {showDropdown && (
        <div id={`${idPrefix}-results`} role="listbox" className="td-search__results">
          {error ? (
            <p className="td-search__result-empty" role="status">
              Couldn't reach the search index right now. Please try again.
            </p>
          ) : loading && !hasVisibleResults ? (
            <p className="td-search__result-empty" role="status" aria-live="polite">
              Searching…
            </p>
          ) : !hasVisibleResults ? (
            <p className="td-search__result-empty">
              No matches for "{query.trim()}". Try one of the suggestions below.
            </p>
          ) : (
            <>
              <div
                className={
                  "td-search__result-list" +
                  (isStaleLoading ? " td-search__result-list--stale" : "")
                }
              >
                {visibleResults.map((r, index) => {
                  const optionId = `${idPrefix}-option-${index}`;
                  const isActive = index === safeHighlightedIndex;
                  return (
                    <Link
                      key={`${r.type}:${r.path}`}
                      id={optionId}
                      ref={(el) => {
                        if (el) optionsRef.current.set(index, el);
                        else optionsRef.current.delete(index);
                      }}
                      to={r.path}
                      role="option"
                      aria-selected={isActive}
                      title={r.description}
                      className={
                        "td-search__result-item" +
                        (isActive ? " td-search__result-item--active" : "")
                      }
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={(e) => {
                        e.preventDefault();
                        selectResult(r.path);
                      }}
                    >
                      <div className="td-search__result-pill td-search__result-pill--lead">
                        {r.ecosystem ? (
                          <GlowBadge variant={ECOSYSTEM_VARIANT[r.ecosystem]}>
                            {r.ecosystem}
                          </GlowBadge>
                        ) : null}
                      </div>
                      <div className="td-search__result-body">
                        <div className="td-search__result-title">{r.title}</div>
                        <div className="td-search__result-description">{r.description}</div>
                        <div className="td-search__result-meta">{metaLine(r)}</div>
                      </div>
                      <div className="td-search__result-pill td-search__result-pill--trail">
                        {r.stability ? <StatusPill stability={r.stability} /> : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
              {overflowCount > 0 && (
                <p className="td-search__result-footer" aria-live="polite">
                  Showing {visibleResults.length} of {totalMatches} matches
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="td-search__suggestions">
        <span className="td-search__suggest-label">Try:</span>
        {DEFAULT_SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            className="td-search__suggest-chip"
            onClick={() => {
              setQuery(s.label);
              setIsOpen(true);
              inputRef.current?.focus();
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
