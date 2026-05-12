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
import { BackButton } from "@/components/ui/back-button";
import { useVersions, useInstrumentations } from "@/hooks/use-javaagent-data";
import {
  type FilterState,
  InstrumentationFilterBar,
} from "@/features/java-agent/components/instrumentation-filter-bar.tsx";
import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

  // Redirect /java-agent/instrumentation (no version) or /latest to the actual latest version
  useEffect(() => {
    if (versionsData && latestVersion) {
      if (!versionParam || versionParam === "latest") {
        navigate(`/java-agent/instrumentation/${latestVersion}`, { replace: true });
      }
    }
  }, [versionParam, versionsData, latestVersion, navigate]);

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

  if (versionsLoading || instrumentationsLoading) {
    return (
      <PageContainer>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="space-y-2 text-center">
            <div className="text-lg font-medium">Loading instrumentations...</div>
            <div className="text-muted-foreground text-sm">This may take a moment</div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (versionsError) {
    return (
      <PageContainer>
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-red-600 dark:text-red-400">
          <h3 className="mb-2 font-semibold">Error loading versions</h3>
          <p className="text-sm">{versionsError.message}</p>
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-red-600 dark:text-red-400">
          <h3 className="mb-2 font-semibold">Error loading instrumentations</h3>
          <p className="text-sm">{error.message}</p>
        </div>
      </PageContainer>
    );
  }

  if (!resolvedVersion) {
    return (
      <PageContainer>
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-red-600 dark:text-red-400">
          <h3 className="mb-2 font-semibold">No version available</h3>
          <p className="text-sm">
            Could not determine the latest Java agent version. Please try refreshing the page.
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-4">
        <BackButton />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold md:text-4xl">
              <span className="from-otel-orange to-otel-blue bg-gradient-to-r bg-clip-text text-transparent">
                OpenTelemetry Java Agent
              </span>
            </h1>
            <p className="text-muted-foreground text-base">
              Explore {instrumentations?.length ?? 0} available instrumentations.
            </p>
          </div>

          {versionsData && versionsData.versions.length > 0 && (
            <VersionSelector
              versions={versionsData.versions}
              currentVersion={resolvedVersion}
              onVersionChange={handleVersionChange}
            />
          )}
        </div>

        <InstrumentationFilterBar filters={filters} onFiltersChange={setFilters} />

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
      </div>
    </PageContainer>
  );
}
