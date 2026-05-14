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
import { AlertCircle, Loader2 } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { useVersions, useInstrumentations } from "@/hooks/use-javaagent-data";
import {
  type FilterState,
  InstrumentationFilterBar,
} from "@/features/java-agent/components/instrumentation-filter-bar.tsx";
import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { InstrumentationGroupCard } from "@/features/java-agent/components/instrumentation-group-card.tsx";
import { VersionSelector } from "@/features/java-agent/components/version-selector";
import { getInstrumentationDisplayName } from "./utils/format";
import { groupInstrumentationsByDisplayName } from "./utils/group-instrumentations";
import { PageContainer } from "@/components/layout/page-container";

export function JavaInstrumentationListPage() {
  const { version: versionParam } = useParams<{ version?: string }>();
  const navigate = useNavigate();

  const { data: versionsData, loading: versionsLoading, error: versionsError } = useVersions();

  const latestVersion = versionsData?.versions.find((v) => v.is_latest)?.version ?? "";

  const [searchParams] = useSearchParams();
  const invalidVersion = searchParams.get("redirectedFrom");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const isVersionValid =
    !versionParam ||
    versionParam === "latest" ||
    (!!versionsData && versionsData.versions.some((v) => v.version === versionParam));

  // Redirect /java-agent/instrumentation (no version) or /latest to the actual latest version
  // Also redirect invalid versions to latest and show a dismissible inline alert
  useEffect(() => {
    if (versionsData && latestVersion) {
      if (!versionParam || versionParam === "latest") {
        navigate(`/java-agent/instrumentation/${latestVersion}`, { replace: true });
      } else if (!isVersionValid) {
        navigate(`/java-agent/instrumentation/${latestVersion}?redirectedFrom=${versionParam}`, {
          replace: true,
        });
      }
    }
  }, [versionParam, versionsData, latestVersion, navigate, isVersionValid]);

  const resolvedVersion = versionParam && versionParam !== "latest" ? versionParam : "";

  const {
    data: instrumentations,
    loading: instrumentationsLoading,
    error,
  } = useInstrumentations(resolvedVersion);

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    telemetry: new Set(),
    target: new Set(),
    semantic: [],
    features: [],
  });

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
        const hasSpans = instr.telemetry?.some((t) => t.spans && t.spans.length > 0);
        const hasMetrics = instr.telemetry?.some((t) => t.metrics && t.metrics.length > 0);

        if (filters.telemetry.has("spans") && !hasSpans) {
          return false;
        }
        if (filters.telemetry.has("metrics") && !hasMetrics) {
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
        const hasMatch = filters.features.some((f) => {
          return instr.features?.includes(f);
        });
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

  const handleVersionChange = (newVersion: string) => {
    navigate(`/java-agent/instrumentation/${newVersion}`);
  };

  return (
    <PageContainer>
      <div className="space-y-4">
        <BackButton />

        {invalidVersion && !bannerDismissed && (
          <div className="flex items-start justify-between gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
            <p>
              Version &quot;{invalidVersion}&quot; was not found. Showing the latest version (
              {latestVersion}) instead.
            </p>
            <button
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss"
              className="mt-0.5 shrink-0 hover:opacity-70"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold md:text-4xl">
              <span className="from-otel-orange to-otel-blue bg-gradient-to-r bg-clip-text text-transparent">
                OpenTelemetry Java Agent
              </span>
            </h1>
            {instrumentations != null && (
              <p className="text-muted-foreground text-base">
                Explore {instrumentations.length} available instrumentations.
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
          onFiltersChange={setFilters}
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
          <div className="flex flex-col items-center justify-center space-y-4 py-32">
            <div className="inline-flex animate-pulse rounded-full p-4 shadow-[0_0_60px_hsl(var(--primary-hsl)/0.2)]">
              <Loader2 className="text-primary h-10 w-10 animate-spin" aria-hidden="true" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">Loading instrumentations...</p>
          </div>
        ) : (
          <>
            <div className="border-border/50 flex items-center justify-between border-b pb-4">
              <div className="text-muted-foreground text-sm">
                Showing {filteredInstrumentations.length} of {instrumentations?.length ?? 0}{" "}
                instrumentations
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
                  <div className="grid gap-6 md:grid-cols-2">
                    {libraryGroups.map((group) => (
                      <InstrumentationGroupCard
                        key={group.displayName}
                        group={group}
                        activeFilters={filters}
                        version={resolvedVersion}
                      />
                    ))}
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
                    <div className="grid gap-6 md:grid-cols-2">
                      {customGroups.map((group) => (
                        <InstrumentationGroupCard
                          key={group.displayName}
                          group={group}
                          activeFilters={filters}
                          version={resolvedVersion}
                        />
                      ))}
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
