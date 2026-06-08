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
import { INTEGRATIONS_STAT_VALUE } from "@/v1/lib/home-stats";

const STORAGE_KEY = "explorer:lastSearch";
const SEARCH_DEBOUNCE_MS = 200;
const MAX_VISIBLE_RESULTS = 10;

// Built from the canonical "Integrations" stat (see home-stats.ts) instead of a
// hardcoded literal, so the placeholder count tracks the stats band rather than
// drifting on its own. Building the real index just to count would re-trigger
// the mount-time fetch storm the dropdown deliberately defers, so the headline
// number stays the source of truth here.
const DEFAULT_PLACEHOLDER = `Search ${INTEGRATIONS_STAT_VALUE} components, instrumentations, vendors…`;

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
  return [result.ecosystem, ...(result.facets ?? []), result.version].filter(Boolean).join(" · ");
}

export interface GlobalSearchProps {
  placeholder?: string;
  /** Override navigation (mostly for tests). Default uses react-router's navigate. */
  onSelect?: (path: string) => void;
}

export function GlobalSearch({ placeholder = DEFAULT_PLACEHOLDER, onSelect }: GlobalSearchProps) {
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
  // Tracked via ref so the global keydown listener can read it without
  // re-binding the listener every time `isOpen` flips.
  const isOpenRef = useRef(isOpen);
  // Timestamp of the most recent ArrowUp/Down. Suppresses `onMouseEnter`
  // highlight-yank when programmatic `scrollIntoView` slides a row under a
  // stationary cursor right after a keyboard nav.
  const lastKeyboardNavAt = useRef(0);
  const navigate = useNavigate();
  const idPrefix = useId();

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  // Only run the engine while the dropdown is open. A persisted query in
  // sessionStorage would otherwise trigger a full index build (hundreds of
  // HTTP requests) on every home-page mount, with the user never seeing the
  // results.
  const { data: results, loading, error } = useSearch(isOpen ? debouncedQuery : "");
  const visibleResults = useMemo(() => (results ?? []).slice(0, MAX_VISIBLE_RESULTS), [results]);
  const totalMatches = results?.length ?? 0;
  const overflowCount = totalMatches - visibleResults.length;
  const hasVisibleResults = visibleResults.length > 0;
  const showDropdown = isOpen && Boolean(query.trim());

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

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
  // dropdown without consuming Escape elsewhere. Accept either modifier on
  // either platform: `navigator.platform` is deprecated and can be spoofed
  // via UA Client Hints, so a platform-conditional check would silently
  // drop the shortcut for users whose platform string is wrong.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (event.key === "Escape" && isOpenRef.current) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
      lastKeyboardNavAt.current = Date.now();
      setHighlightedIndex((i) => (i + 1) % visibleResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      lastKeyboardNavAt.current = Date.now();
      setHighlightedIndex((i) => (i - 1 + visibleResults.length) % visibleResults.length);
    } else if (event.key === "Enter") {
      const target = visibleResults[safeHighlightedIndex];
      if (target) {
        event.preventDefault();
        selectResult(target.path);
      }
    }
  };

  // Only expose the combobox→option relationship while the listbox is
  // actually in the DOM. Pointing `aria-activedescendant`/`aria-controls` at
  // option/listbox ids that aren't rendered (dropdown closed, or open but
  // loading/empty/errored) breaks the combobox pattern for assistive tech.
  const listboxRendered = showDropdown && hasVisibleResults;
  const activeOptionId = listboxRendered
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
          aria-expanded={showDropdown}
          aria-controls={listboxRendered ? `${idPrefix}-results` : undefined}
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
        // Plain panel — `role="listbox"` lives on the inner options-only list
        // below so the status/empty/error `<p>`s and the overflow footer never
        // sit inside the listbox (a listbox may contain only options).
        <div className="td-search__results">
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
                id={`${idPrefix}-results`}
                role="listbox"
                aria-label="Search results"
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
                      onMouseEnter={() => {
                        // Ignore mouseenter that fires within ~150ms of an
                        // arrow-key nav — programmatic scrollIntoView can
                        // slide a row under a stationary cursor and yank
                        // the highlight away from the keyboard target.
                        if (Date.now() - lastKeyboardNavAt.current < 150) return;
                        setHighlightedIndex(index);
                      }}
                      onClick={(e) => {
                        // Honor modifier-key intents (cmd/ctrl-click for new
                        // tab, shift-click for new window, middle-click) by
                        // letting the underlying <Link>'s native anchor
                        // semantics handle them. Only intercept plain left
                        // clicks for client-side navigation.
                        if (
                          e.defaultPrevented ||
                          e.button !== 0 ||
                          e.metaKey ||
                          e.ctrlKey ||
                          e.shiftKey ||
                          e.altKey
                        ) {
                          return;
                        }
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
              setHighlightedIndex(0);
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
