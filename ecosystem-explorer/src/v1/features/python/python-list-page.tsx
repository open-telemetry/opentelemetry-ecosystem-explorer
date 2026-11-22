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
 * PythonListPageV1 — the V1 Python instrumentation catalogue.
 *
 * Data: `usePythonIndex`, which reads the python database's single index.json. Filters, density
 * and page round-trip through the URL (`features/python/utils/catalogue`), the same contract the
 * legacy page reads, so a shared link opens the same view in either app.
 *
 * Only what the index carries is filterable: free text over name and description, metrics
 * support and semantic-convention status. A null in the data is its own "Not specified"
 * option; it is never folded into "no".
 */

import { Filter, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePythonIndex } from "@/hooks/use-python-data";
import {
  DENSITIES,
  METRICS_FACETS,
  PYTHON_LIST_PATH,
  activeFilterCount,
  applyFilters,
  computeCounts,
  paginate,
  parseFilters,
  semconvOptions,
  serializeFilters,
  sortRows,
  toRow,
  type DensityMode,
  type PythonFilters,
} from "@/features/python/utils/catalogue";
import { metricsTone, semconvTone } from "@/features/python/styles/filter-styles";
import { SubNav } from "@/v1/components/layout/sub-nav";
import { DensityToggle, Pagination } from "@/v1/components/list/controls";
import { FacetPanelShell } from "@/v1/components/list/facet-panel";
import { CheckboxFacet, SearchFacet } from "@/v1/components/list/facets";
import {
  PythonCardView,
  PythonCompactList,
  PythonTableView,
} from "@/v1/components/python/python-rows";

const DENSITY_STORAGE_KEY = "explorer:listDensity";

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function PythonListPageV1() {
  const { t } = useTranslation("python");
  const { t: tl } = useTranslation("list");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: index, loading, error } = usePythonIndex();

  // Same density preference the Collector list keeps, so the choice carries across ecosystems.
  const [storedDensity] = useState<DensityMode | null>(() => {
    try {
      const saved = window.localStorage.getItem(DENSITY_STORAGE_KEY);
      return saved && (DENSITIES as readonly string[]).includes(saved)
        ? (saved as DensityMode)
        : null;
    } catch {
      return null;
    }
  });
  const density = searchParams.has("density")
    ? filters.density
    : (storedDensity ?? filters.density);

  function updateFilters(patch: Partial<PythonFilters>) {
    // A new filter set is a new result set, so it starts at page 1 unless the caller moves the page.
    const next: PythonFilters = { ...filters, density, page: 1, ...patch };
    const qs = serializeFilters(next).toString();
    void navigate({ pathname: PYTHON_LIST_PATH, search: qs ? `?${qs}` : "" });
    if (patch.density) {
      try {
        window.localStorage.setItem(DENSITY_STORAGE_KEY, patch.density);
      } catch {
        /* ignore */
      }
    }
  }

  const allRows = useMemo(() => (index ? index.packages.map(toRow) : []), [index]);
  const filteredRows = useMemo(() => sortRows(applyFilters(allRows, filters)), [allRows, filters]);
  const counts = useMemo(() => computeCounts(allRows), [allRows]);
  const semconv = useMemo(() => semconvOptions(allRows), [allRows]);
  const paged = paginate(filteredRows, filters.page);

  const activeCount = activeFilterCount(filters);
  const hasActiveFilters = activeCount > 0;

  const chips: Chip[] = [];
  if (filters.q) {
    chips.push({
      key: `q:${filters.q}`,
      label: tl("chips.search", { value: filters.q }),
      onRemove: () => updateFilters({ q: "" }),
    });
  }
  for (const value of filters.metrics) {
    chips.push({
      key: `metrics:${value}`,
      label: `${t("metrics.label")}: ${t(`metrics.${value}`)}`,
      onRemove: () => updateFilters({ metrics: filters.metrics.filter((v) => v !== value) }),
    });
  }
  for (const value of filters.semconv) {
    chips.push({
      key: `semconv:${value}`,
      label: `${t("semconv.label")}: ${t(`semconv.${value}`, { defaultValue: value })}`,
      onRemove: () => updateFilters({ semconv: filters.semconv.filter((v) => v !== value) }),
    });
  }

  return (
    <div className="td-list-page">
      <SubNav
        crumbs={[
          { label: t("breadcrumb.explorer"), href: "/" },
          { label: t("breadcrumb.python") },
          { label: t("breadcrumb.instrumentation") },
        ]}
      />

      <header className="td-list-page__header td-box td-box--light">
        <div className="td-box__container">
          <div className="td-list-page__heading">
            <h1 className="td-list-page__title">
              <span className="td-cover-block__title-accent">{t("list.titleAccent")}</span>{" "}
              {t("list.titleRest")}
            </h1>
            <p className="td-list-page__count" aria-live="polite">
              {loading
                ? t("list.loading")
                : t("list.count", {
                    shown: paged.items.length,
                    filtered: filteredRows.length,
                    total: allRows.length,
                  })}
            </p>
          </div>
          <div className="td-list-page__controls">
            <button
              type="button"
              className="td-facet-toggle"
              onClick={() => setDrawerOpen(true)}
              aria-label={
                activeCount === 0
                  ? tl("facetToggle.openAriaLabel")
                  : tl("facetToggle.openWithCountAriaLabel", { count: activeCount })
              }
            >
              <Filter className="h-4 w-4" aria-hidden focusable="false" />
              <span>{tl("facetToggle.label")}</span>
              {activeCount > 0 && <span className="td-facet-toggle__badge">{activeCount}</span>}
            </button>
            <DensityToggle value={density} onChange={(next) => updateFilters({ density: next })} />
          </div>
        </div>
      </header>

      <div className="td-box td-box--light td-list-page__body">
        <div className="td-list-page__layout">
          <div className="td-list-page__rail">
            <FacetPanelShell isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
              <SearchFacet
                title={t("list.filters.searchLabel")}
                placeholder={t("list.filters.searchPlaceholder")}
                value={filters.q}
                onChange={(q) => updateFilters({ q })}
              />
              <CheckboxFacet
                title={t("metrics.label")}
                options={METRICS_FACETS.map((value) => ({
                  value,
                  label: t(`metrics.${value}`),
                  swatch: metricsTone(value).swatch,
                  count: counts.metrics[value],
                }))}
                selected={filters.metrics}
                onChange={(metrics) => updateFilters({ metrics })}
              />
              {semconv.length > 0 && (
                <CheckboxFacet
                  title={t("semconv.label")}
                  options={semconv.map((value) => ({
                    value,
                    label: t(`semconv.${value}`, { defaultValue: value }),
                    swatch: semconvTone(value).swatch,
                    count: counts.semconv[value] ?? 0,
                  }))}
                  selected={filters.semconv}
                  onChange={(next) => updateFilters({ semconv: next })}
                />
              )}
            </FacetPanelShell>
          </div>

          <div className="td-list-page__main">
            {chips.length > 0 && (
              <div className="td-chips" aria-label={tl("chips.ariaLabel")}>
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className="td-chip"
                    onClick={chip.onRemove}
                    aria-label={tl("chips.removeAriaLabel", { label: chip.label })}
                  >
                    <span>{chip.label}</span>
                    <X className="td-chip__x" aria-hidden focusable="false" />
                  </button>
                ))}
                <button
                  type="button"
                  className="td-chip td-chip--clear"
                  onClick={() => updateFilters({ q: "", metrics: [], semconv: [] })}
                >
                  {tl("chips.clearAll")}
                </button>
              </div>
            )}

            {error && (
              <div role="alert" className="td-empty">
                <p className="td-empty__title">{t("list.error.title")}</p>
                <p className="td-empty__lead">{error.message || t("list.error.description")}</p>
              </div>
            )}

            {!error && loading && (
              <div className="td-list-loading" role="status" aria-live="polite">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                <span>{t("list.loading")}</span>
              </div>
            )}

            {/* The shared EmptyState speaks of "components", which reads wrong for packages, so the
                same \`td-empty\` markup is used with this page's own copy. */}
            {!error && !loading && filteredRows.length === 0 && (
              <div className="td-empty" role="status" aria-live="polite">
                <p className="td-empty__title">{t("list.empty.title")}</p>
                <p className="td-empty__lead">
                  {hasActiveFilters ? t("list.empty.leadFiltered") : t("list.empty.leadUnfiltered")}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="td-btn td-btn--outline-regular"
                    onClick={() => updateFilters({ q: "", metrics: [], semconv: [] })}
                  >
                    {t("list.empty.clearAll")}
                  </button>
                )}
              </div>
            )}

            {!error && !loading && filteredRows.length > 0 && (
              <>
                {density === "cards" && <PythonCardView rows={paged.items} />}
                {density === "compact" && <PythonCompactList rows={paged.items} />}
                {density === "table" && <PythonTableView rows={paged.items} />}
                <Pagination
                  page={paged.page}
                  totalPages={paged.totalPages}
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
