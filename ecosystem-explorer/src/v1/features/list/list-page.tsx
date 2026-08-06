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
 * CollectorListPageV1 — Phase 4 list page for the Collector ecosystem.
 *
 * Data layer: reuses `useCollectorVersions` and `useCollectorComponents`
 * from `src/hooks/`, so the v1 view is a re-skin, not a re-implementation
 * of the registry fetcher. Filtering, sorting, paging, and density all
 * round-trip through the URL via the `listFilters` contract.
 *
 * URL: every filter, sort, density, and page change updates `location.search`
 * without a full reload — paste a URL into Slack and it reproduces the same
 * view on someone else's screen.
 *
 * Signal facet only matches the four `Signal` literals (traces/metrics/logs/
 * baggage) against `IndexComponent.signals`. The real index also carries
 * `"profiles"`, the synthetic `"extension"` marker, and connector compound
 * tokens (`"traces_to_metrics"`, etc.) — those are intentionally excluded
 * rather than remapped onto the four buckets (decision #10).
 */

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { CollectorComponentType } from "@/components/ui/type-stripe-colors";
import { useCollectorComponents, useCollectorVersions } from "@/hooks/use-collector-data";
import type { IndexComponent } from "@/types/collector";
import { SubNav } from "@/v1/components/layout/sub-nav";
import {
  ActiveFilterChips,
  DensityToggle,
  EmptyState,
  FacetDrawerToggle,
  Pagination,
  SortDropdown,
} from "@/v1/components/list/controls";
import { FacetPanel, type FacetCounts } from "@/v1/components/list/facet-panel";
import { CardView, CompactList, type ListRow, TableView } from "@/v1/components/list/views";
import {
  DEFAULT_FILTERS,
  DISTRIBUTIONS,
  type Distribution,
  type ListFilters,
  SIGNALS,
  type Signal,
  type StabilityFacet,
  parseFilters,
  serializeFilters,
} from "@/v1/lib/list-filters";

const PAGE_SIZE = 50;
const DENSITY_STORAGE_KEY = "explorer:listDensity";
const KNOWN_SIGNALS = new Set<string>(SIGNALS);
const KNOWN_DISTRIBUTIONS = new Set<string>(DISTRIBUTIONS);

function toDistribution(raw: string): Distribution {
  return KNOWN_DISTRIBUTIONS.has(raw) ? (raw as Distribution) : "core";
}

function componentToRow(c: IndexComponent, basePath: string): ListRow {
  const signals = (c.signals ?? [])
    .map((s) => s.toLowerCase())
    .filter((s): s is Signal => KNOWN_SIGNALS.has(s));
  return {
    id: c.id,
    name: c.name,
    displayName: c.display_name?.trim() || c.name,
    type: c.type as CollectorComponentType,
    distribution: toDistribution(c.distribution),
    description: c.description ?? null,
    stability: (c.stability ?? "development") as StabilityFacet,
    signals,
    href: `${basePath}/${c.distribution}/${c.name}`,
  };
}

const STABILITY_RANK: Record<StabilityFacet, number> = {
  stable: 5,
  beta: 4,
  alpha: 3,
  development: 2,
  deprecated: 1,
  unmaintained: 0,
};

function applyFilters(rows: ListRow[], filters: ListFilters): ListRow[] {
  const q = filters.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.types.length > 0 && !filters.types.includes(row.type)) return false;
    if (filters.stabilities.length > 0 && !filters.stabilities.includes(row.stability))
      return false;
    if (filters.distributions.length > 0 && !filters.distributions.includes(row.distribution))
      return false;
    if (filters.signals.length > 0) {
      const rowSignals = new Set(row.signals);
      const hit = filters.signals.some((s) => rowSignals.has(s));
      if (!hit) return false;
    }
    if (q.length > 0) {
      const hay = `${row.displayName} ${row.name} ${row.description ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function sortRows(rows: ListRow[], sort: ListFilters["sort"]): ListRow[] {
  const sorted = rows.slice();
  if (sort === "stability") {
    sorted.sort(
      (a, b) =>
        STABILITY_RANK[b.stability] - STABILITY_RANK[a.stability] ||
        a.displayName.localeCompare(b.displayName)
    );
  } else if (sort === "updated") {
    // No per-row updated timestamp in v1 data — fall back to name order so
    // the view is still stable. When the data layer adds it, key off it here.
    sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
  } else {
    sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  return sorted;
}

function computeCounts(rows: ListRow[]): FacetCounts {
  const counts: FacetCounts = {
    types: {},
    signals: {},
    stabilities: {},
    distributions: {},
  };
  for (const row of rows) {
    counts.types![row.type] = (counts.types![row.type] ?? 0) + 1;
    counts.stabilities![row.stability] = (counts.stabilities![row.stability] ?? 0) + 1;
    counts.distributions![row.distribution] = (counts.distributions![row.distribution] ?? 0) + 1;
    for (const sig of row.signals) {
      counts.signals![sig] = (counts.signals![sig] ?? 0) + 1;
    }
  }
  return counts;
}

export function CollectorListPageV1() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hydrate density from localStorage on first mount if URL doesn't override
  useEffect(() => {
    if (searchParams.has("density")) return;
    try {
      const saved = window.localStorage.getItem(DENSITY_STORAGE_KEY);
      if (saved === "cards" || saved === "compact" || saved === "table") {
        if (saved !== DEFAULT_FILTERS.density) {
          updateFilters({ density: saved }, /* replace= */ true);
        }
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilters(patch: Partial<ListFilters>, replace = false) {
    const next: ListFilters = { ...filters, ...patch };
    const qs = serializeFilters(next).toString();
    navigate({ pathname: "/collector/components", search: qs ? `?${qs}` : "" }, { replace });
    if (patch.density) {
      try {
        window.localStorage.setItem(DENSITY_STORAGE_KEY, patch.density);
      } catch {
        /* ignore */
      }
    }
  }

  const {
    data: versionsData,
    loading: versionsLoading,
    error: versionsError,
  } = useCollectorVersions();
  const currentVersion =
    filters.version ?? versionsData?.versions.find((v) => v.is_latest)?.version ?? "";
  const allVersions = useMemo(
    () => versionsData?.versions.map((v) => v.version) ?? [],
    [versionsData]
  );

  const {
    data: componentsData,
    loading: componentsLoading,
    error: componentsError,
  } = useCollectorComponents(currentVersion);

  const allRows = useMemo(() => {
    if (!componentsData) return [];
    return componentsData.map((c) => componentToRow(c, "/collector/components"));
  }, [componentsData]);
  const filteredRows = useMemo(
    () => sortRows(applyFilters(allRows, filters), filters.sort),
    [allRows, filters]
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(filters.page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const counts = useMemo(() => computeCounts(allRows), [allRows]);

  const loading = versionsLoading || componentsLoading;
  const error = versionsError || componentsError;

  return (
    <div className="td-list-page">
      <SubNav
        crumbs={[
          { label: "Explorer", href: "/" },
          { label: "Collector", href: "/collector" },
          { label: "Components" },
        ]}
      />

      <header className="td-list-page__header td-box td-box--light">
        <div className="td-box__container">
          <div className="td-list-page__heading">
            <h1 className="td-list-page__title">
              <span className="td-cover-block__title-accent">Collector</span> components
            </h1>
            <p className="td-list-page__count" aria-live="polite">
              {loading
                ? "Loading components…"
                : `Showing ${pagedRows.length} of ${filteredRows.length} (${allRows.length} total)`}
            </p>
          </div>
          <div className="td-list-page__controls">
            <FacetDrawerToggle filters={filters} onClick={() => setDrawerOpen(true)} />
            <SortDropdown
              value={filters.sort}
              onChange={(sort) => updateFilters({ sort, page: 1 })}
            />
            <DensityToggle
              value={filters.density}
              onChange={(density) => updateFilters({ density })}
            />
          </div>
        </div>
      </header>

      <div className="td-box td-box--light td-list-page__body">
        <div className="td-list-page__layout">
          <div className="td-list-page__rail">
            <FacetPanel
              filters={filters}
              onChange={updateFilters}
              versions={allVersions}
              counts={counts}
              isOpen={drawerOpen}
              onClose={() => setDrawerOpen(false)}
            />
          </div>

          <div className="td-list-page__main">
            <ActiveFilterChips filters={filters} onChange={updateFilters} />

            {error && (
              <div role="alert" className="td-empty">
                <p className="td-empty__title">Couldn't load components</p>
                <p className="td-empty__lead">{String(error)}</p>
              </div>
            )}

            {!error && loading && (
              <div className="td-list-loading" role="status" aria-live="polite">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                <span>Loading components…</span>
              </div>
            )}

            {!error && !loading && filteredRows.length === 0 && (
              <EmptyState
                hasActiveFilters={
                  filters.types.length +
                    filters.signals.length +
                    filters.stabilities.length +
                    filters.distributions.length >
                    0 || filters.q.trim().length > 0
                }
                onClearAll={() =>
                  updateFilters({
                    q: "",
                    types: [],
                    signals: [],
                    stabilities: [],
                    distributions: [],
                    page: 1,
                  })
                }
              />
            )}

            {!error && !loading && filteredRows.length > 0 && (
              <>
                {filters.density === "cards" && <CardView rows={pagedRows} />}
                {filters.density === "compact" && <CompactList rows={pagedRows} />}
                {filters.density === "table" && <TableView rows={pagedRows} />}
                <Pagination
                  page={safePage}
                  totalPages={totalPages}
                  onChange={(page) => updateFilters({ page })}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
