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
import { useTranslation } from "react-i18next";
import { AlertCircle, X } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { BackButton } from "@/components/ui/back-button";
import { useVersions, useInstrumentations } from "@/hooks/use-javaagent-data";
import { useLazyPagination } from "@/hooks/use-lazy-pagination";
import {
  type FilterState,
  InstrumentationFilterBar,
} from "@/features/java-agent/components/instrumentation-filter-bar.tsx";
import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { InstrumentationGroupCard } from "@/features/java-agent/components/instrumentation-group-card.tsx";
import { VersionSelector } from "@/features/java-agent/components/version-selector";
import { getInstrumentationDisplayName } from "./utils/format";
import { groupInstrumentationsByDisplayName } from "./utils/group-instrumentations";
import { PageContainer } from "@/components/layout/page-container";
import { Seo } from "@/components/seo/seo";

export function JavaInstrumentationListPage() {
  const { t } = useTranslation("java-agent");
  const [searchParams, setSearchParams] = useSearchParams();

  const navigate = useNavigate();
  const location = useLocation();

  const { data: versionsData, loading: versionsLoading, error: versionsError } = useVersions();

  const latestVersion = versionsData?.versions.find((v) => v.is_latest)?.version ?? "";

  const versionParam = searchParams.get("version");
  const invalidVersion = searchParams.get("redirectedFrom");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const isVersionValid =
    !versionParam ||
    versionParam === "latest" ||
    (!!versionsData && versionsData.versions.some((v) => v.version === versionParam));

  // Redirect: no-version/latest → latest (preserving query params so shared filter URLs survive).
  // Invalid version → latest with redirectedFrom banner.
  useEffect(() => {
    if (versionsData && latestVersion) {
      const params = new URLSearchParams(location.search);
      params.delete("version");

      const query = params.toString();

      if (!versionParam || versionParam === "latest") {
        navigate(`/java-agent/instrumentation${query ? `?${query}` : ""}`, {
          replace: true,
        });
      } else if (!isVersionValid) {
        navigate(`/java-agent/instrumentation?${query}&redirectedFrom=${versionParam}`, {
          replace: true,
        });
      }
    }
  }, [versionParam, versionsData, latestVersion, navigate, isVersionValid, location.search]);

  const resolvedVersion = versionParam ?? latestVersion;

  const {
    data: instrumentations,
    loading: instrumentationsLoading,
    error,
  } = useInstrumentations(resolvedVersion);

  const urlSearch = searchParams.get("search") ?? "";

  // Local state for the search input — updates immediately on every keystroke,
  // avoiding the URL round-trip lag that causes flicker on CTRL+A + type.
  const [localSearch, setLocalSearch] = useState(urlSearch);

  // Detect external URL changes (back/forward) and sync the input using
  // React's documented derived state during render pattern.
  const [syncedUrlSearch, setSyncedUrlSearch] = useState(urlSearch);
  if (syncedUrlSearch !== urlSearch) {
    setSyncedUrlSearch(urlSearch);
    setLocalSearch(urlSearch);
  }

  const filters: FilterState = useMemo(() => {
    const telemetryParam = searchParams.get("telemetry");
    const typeParam = searchParams.get("type");
    const semanticParam = searchParams.get("semantic");
    const featuresParam = searchParams.get("features");

    const telemetry = new Set<"spans" | "metrics">();
    if (telemetryParam) {
      telemetryParam.split(",").forEach((v) => {
        if (v === "spans" || v === "metrics") telemetry.add(v);
      });
    }

    const target = new Set<"javaagent" | "library">();
    if (typeParam) {
      typeParam.split(",").forEach((v) => {
        if (v === "javaagent" || v === "library") target.add(v);
      });
    }

    const semantic = semanticParam ? semanticParam.split(",").filter(Boolean) : [];
    const features = featuresParam ? featuresParam.split(",").filter(Boolean) : [];

    return { search: localSearch, telemetry, target, semantic, features };
  }, [searchParams, localSearch]);

  const handleFiltersChange = (newFilters: FilterState) => {
    // Update local search state immediately so the input never lags behind keystrokes.
    setLocalSearch(newFilters.search);

    // Use replace for high-frequency search typing to avoid polluting browser history.
    // Use push (replace: false) for discrete toggle changes so back button works.
    const setsUnchanged =
      newFilters.telemetry.size === filters.telemetry.size &&
      newFilters.target.size === filters.target.size &&
      newFilters.semantic.length === filters.semantic.length &&
      newFilters.features.length === filters.features.length &&
      [...newFilters.telemetry].every((v) => filters.telemetry.has(v)) &&
      [...newFilters.target].every((v) => filters.target.has(v)) &&
      newFilters.semantic.every((v, i) => filters.semantic[i] === v) &&
      newFilters.features.every((v, i) => filters.features[i] === v);

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (newFilters.search) {
          next.set("search", newFilters.search);
        } else {
          next.delete("search");
        }
        if (newFilters.telemetry.size > 0) {
          next.set("telemetry", [...newFilters.telemetry].join(","));
        } else {
          next.delete("telemetry");
        }
        if (newFilters.target.size > 0) {
          next.set("type", [...newFilters.target].join(","));
        } else {
          next.delete("type");
        }
        if (newFilters.semantic.length > 0) {
          next.set("semantic", newFilters.semantic.join(","));
        } else {
          next.delete("semantic");
        }
        if (newFilters.features.length > 0) {
          next.set("features", newFilters.features.join(","));
        } else {
          next.delete("features");
        }
        return next;
      },
      { replace: setsUnchanged }
    );
  };

  const filteredInstrumentations = useMemo(() => {
    if (!instrumentations) return [];

    return instrumentations.filter((instr) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = getInstrumentationDisplayName(instr).toLowerCase();
        const rawName = instr.name.toLowerCase();
        const description = (instr.description || "").toLowerCase();

        if (
          !name.includes(searchLower) &&
          !rawName.includes(searchLower) &&
          !description.includes(searchLower)
        ) {
          return false;
        }
      }

      if (filters.telemetry.size > 0) {
        if (filters.telemetry.has("spans") && !instr.has_spans) {
          return false;
        }
        if (filters.telemetry.has("metrics") && !instr.has_metrics) {
          return false;
        }
      }

      if (filters.target.size > 0) {
        const hasJavaAgent = instr.has_javaagent === true;
        const hasLibrary = instr.has_standalone_library === true;

        if (filters.target.has("javaagent") && !hasJavaAgent) {
          return false;
        }
        if (filters.target.has("library") && !hasLibrary) {
          return false;
        }
      }

      if (filters.semantic.length > 0) {
        const hasMatch = filters.semantic.some((s) => instr.semantic_conventions?.includes(s));
        if (!hasMatch) return false;
      }

      if (filters.features.length > 0) {
        const hasMatch = filters.features.some((f) => instr.features?.includes(f));
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [instrumentations, filters]);

  const { libraryInstrumentations, customInstrumentations } = useMemo(() => {
    return {
      libraryInstrumentations: filteredInstrumentations.filter((i) => !i._is_custom),
      customInstrumentations: filteredInstrumentations.filter((i) => i._is_custom),
    };
  }, [filteredInstrumentations]);

  const libraryGroups = useMemo(
    () => groupInstrumentationsByDisplayName(libraryInstrumentations),
    [libraryInstrumentations]
  );

  const customGroups = useMemo(
    () => groupInstrumentationsByDisplayName(customInstrumentations),
    [customInstrumentations]
  );

  const resetKey = useMemo(
    () =>
      JSON.stringify({
        v: resolvedVersion,
        s: filters.search,
        t: [...filters.telemetry].sort(),
        g: [...filters.target].sort(),
        sc: filters.semantic,
        f: filters.features,
      }),
    [resolvedVersion, filters]
  );

  const {
    visibleCount: libraryVisibleCount,
    setSentinel: setLibrarySentinel,
    hasMore: libraryHasMore,
  } = useLazyPagination({
    totalCount: libraryGroups.length,
    resetKey,
  });

  const {
    visibleCount: customVisibleCount,
    setSentinel: setCustomSentinel,
    hasMore: customHasMore,
  } = useLazyPagination({
    totalCount: customGroups.length,
    resetKey,
  });

  const visibleLibraryGroups = useMemo(
    () => libraryGroups.slice(0, libraryVisibleCount),
    [libraryGroups, libraryVisibleCount]
  );

  const visibleCustomGroups = useMemo(
    () => customGroups.slice(0, customVisibleCount),
    [customGroups, customVisibleCount]
  );

  const handleVersionChange = (newVersion: string) => {
    const params = new URLSearchParams(location.search);

    params.delete("redirectedFrom");

    if (newVersion === latestVersion || newVersion === "latest") {
      params.delete("version");
    } else {
      params.set("version", newVersion);
    }

    const query = params.toString();

    navigate(`/java-agent/instrumentation${query ? `?${query}` : ""}`);
  };

  return (
    <PageContainer>
      <Seo />
      <div className="space-y-4">
        <BackButton />

        {invalidVersion && !bannerDismissed && (
          <div className="flex items-start justify-between gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
            <p>{t("list.invalidVersion", { version: invalidVersion, latest: latestVersion })}</p>
            <button
              onClick={() => setBannerDismissed(true)}
              aria-label={t("list.dismiss")}
              className="mt-0.5 shrink-0 hover:opacity-70"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold md:text-4xl">
              <span className="text-gradient-brand">OpenTelemetry Java Agent</span>
            </h1>
            {instrumentations != null && (
              <p className="text-muted-foreground text-base">
                {t("list.description", { count: instrumentations.length })}
              </p>
            )}
          </div>

          <VersionSelector
            versions={versionsData?.versions ?? []}
            currentVersion={resolvedVersion}
            onVersionChange={handleVersionChange}
            disabled={versionsLoading}
          />
        </div>

        <InstrumentationFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          instrumentations={instrumentations ?? []}
        />

        {versionsError || error ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-32 text-center text-red-500">
            <AlertCircle className="mx-auto h-12 w-12 opacity-50" aria-hidden="true" />
            <h3 className="text-xl font-semibold">Error loading data</h3>
            {(versionsError ?? error)?.message && (
              <p className="text-muted-foreground text-sm">{(versionsError ?? error)!.message}</p>
            )}
            <p className="text-muted-foreground">Please try refreshing the page.</p>
          </div>
        ) : versionsLoading || instrumentationsLoading || (!resolvedVersion && !versionsError) ? (
          <Loader label={t("list.loading")} />
        ) : (
          <>
            <div className="border-border/50 flex items-center justify-between border-b pb-4">
              <div className="text-muted-foreground text-sm">
                {t("list.results.showing", {
                  shown: filteredInstrumentations.length,
                  total: instrumentations?.length ?? 0,
                })}
              </div>
            </div>

            {filteredInstrumentations.length === 0 ? (
              <div className="border-border/50 bg-card/30 flex min-h-[300px] items-center justify-center rounded-lg border">
                <div className="text-center">
                  <p className="text-muted-foreground text-base">
                    No instrumentations found matching your filters.
                  </p>
                  <p className="text-muted-foreground/70 mt-2 text-sm">
                    Try adjusting your search or filter criteria
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                {libraryGroups.length > 0 && (
                  <div className="space-y-4">
                    <div className="grid gap-6 md:grid-cols-2">
                      {visibleLibraryGroups.map((group) => (
                        <InstrumentationGroupCard
                          key={group.displayName}
                          group={group}
                          activeFilters={filters}
                          version={versionParam}
                        />
                      ))}
                    </div>
                    {libraryHasMore && (
                      <div
                        ref={setLibrarySentinel}
                        aria-hidden
                        data-testid="library-sentinel"
                        className="h-px"
                      />
                    )}
                  </div>
                )}

                {customGroups.length > 0 && (
                  <div className="space-y-6">
                    <div className="border-border/50 border-b pb-2">
                      <h2 className="text-foreground text-2xl font-semibold tracking-tight">
                        Custom Instrumentations
                      </h2>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Non-library instrumentations such as methods, JMX metrics, and external
                        annotations.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="grid gap-6 md:grid-cols-2">
                        {visibleCustomGroups.map((group) => (
                          <InstrumentationGroupCard
                            key={group.displayName}
                            group={group}
                            activeFilters={filters}
                            version={versionParam}
                          />
                        ))}
                      </div>
                      {customHasMore && (
                        <div
                          ref={setCustomSentinel}
                          aria-hidden
                          data-testid="custom-sentinel"
                          className="h-px"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
