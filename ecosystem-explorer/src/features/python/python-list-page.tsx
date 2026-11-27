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
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { Seo } from "@/components/seo/seo";
import { BackButton } from "@/components/ui/back-button";
import { Loader } from "@/components/ui/loader";
import { PageContainer } from "@/components/layout/page-container";
import { useLazyPagination } from "@/hooks/use-lazy-pagination";
import { usePythonIndex } from "@/hooks/use-python-data";
import {
  PAGE_SIZE,
  applyFilters,
  computeCounts,
  parseFilters,
  semconvOptions,
  serializeFilters,
  sortRows,
  toRow,
  type PythonFilters,
} from "@/features/python/utils/catalogue";
import { PythonFilterBar } from "./components/python-filter-bar";
import { PythonPackageCard } from "./components/python-package-card";

/**
 * Legacy-theme Python instrumentation catalogue. Reads and writes the same URL contract as
 * the V1 page (`q`, `metrics`, `semconv`), so a shared link opens the same view in either.
 */
export function PythonListPage() {
  const { t } = useTranslation("python");
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: index, loading, error } = usePythonIndex();

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  // The URL holds the trimmed query, so the input keeps its own text. Otherwise typing a
  // trailing space ("flask ") would be trimmed away before the next word could be typed. When the
  // URL changes for another reason (back/forward, reset) the input follows it. This is synced
  // during render, as React documents for "storing information from previous renders", because
  // the repo's lint rules forbid setting state from an effect.
  const [search, setSearch] = useState(filters.q);
  const [lastQuery, setLastQuery] = useState(filters.q);
  if (filters.q !== lastQuery) {
    setLastQuery(filters.q);
    if (search.trim() !== filters.q) setSearch(filters.q);
  }

  function updateFilters(patch: Partial<PythonFilters>) {
    const qs = serializeFilters({ ...filters, ...patch, page: 1 }).toString();
    setSearchParams(new URLSearchParams(qs), { replace: true });
  }

  const rows = useMemo(() => (index ? index.packages.map(toRow) : []), [index]);
  const filtered = useMemo(() => sortRows(applyFilters(rows, filters)), [rows, filters]);
  const counts = useMemo(() => computeCounts(rows), [rows]);
  const semconv = useMemo(() => semconvOptions(rows), [rows]);

  const { visibleCount, setSentinel, hasMore } = useLazyPagination({
    totalCount: filtered.length,
    pageSize: PAGE_SIZE,
    resetKey: serializeFilters(filters).toString(),
  });
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  return (
    <PageContainer>
      <Seo />
      <div className="space-y-4">
        <BackButton fallbackTo="/" />

        <div className="space-y-3">
          <h1 className="text-3xl font-bold md:text-4xl">
            <span className="text-gradient-brand">{t("list.title")}</span>
          </h1>
          <p className="text-muted-foreground text-base">{t("list.description")}</p>
        </div>

        <PythonFilterBar
          filters={filters}
          search={search}
          semconvOptions={semconv}
          counts={counts}
          onSearchChange={(value) => {
            setSearch(value);
            updateFilters({ q: value });
          }}
          onChange={updateFilters}
          onReset={() => {
            setSearch("");
            updateFilters({ q: "", metrics: [], semconv: [] });
          }}
        />

        {error ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center space-y-4 py-32 text-center text-red-500"
          >
            <AlertCircle className="mx-auto h-12 w-12 opacity-50" aria-hidden="true" />
            <h2 className="text-xl font-semibold">{t("list.error.title")}</h2>
            {error.message && <p className="text-muted-foreground text-sm">{error.message}</p>}
            <p className="text-muted-foreground">{t("list.error.description")}</p>
          </div>
        ) : loading || !index ? (
          <Loader label={t("list.loading")} />
        ) : (
          <>
            <div className="border-border/50 border-b pb-4">
              <p className="text-muted-foreground text-sm" aria-live="polite">
                {t("list.count", {
                  shown: visible.length,
                  filtered: filtered.length,
                  total: rows.length,
                })}
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="border-border/50 bg-card/30 flex min-h-[300px] items-center justify-center rounded-lg border">
                <div className="space-y-2 text-center">
                  <p className="text-foreground text-base font-semibold">{t("list.empty.title")}</p>
                  <p className="text-muted-foreground text-sm">
                    {rows.length === 0
                      ? t("list.empty.leadUnfiltered")
                      : t("list.empty.leadFiltered")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {visible.map((row) => (
                    <li key={row.name}>
                      <PythonPackageCard row={row} />
                    </li>
                  ))}
                </ul>
                {hasMore && (
                  <div
                    ref={setSentinel}
                    aria-hidden
                    data-testid="python-sentinel"
                    className="h-px"
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
