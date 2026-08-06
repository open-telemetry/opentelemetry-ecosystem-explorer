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

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2, ArrowRight, ExternalLink, ChevronDown } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Seo } from "@/components/seo/seo";
import { BackButton } from "@/components/ui/back-button";
import { useVersions } from "@/hooks/use-javaagent-data";
import { useReleaseComparison } from "./hooks/use-release-comparison";
import { ReleaseVersionSelector } from "./components/release-comparison/release-version-selector";
import { InstrumentationDiffCard } from "./components/release-comparison/instrumentation-diff-card";
import {
  ModuleStatusFilter,
  type ModuleChangeStatus,
} from "./components/release-comparison/module-status-filter";
import {
  TelemetryFilter,
  type TelemetryType,
} from "./components/release-comparison/telemetry-filter";
import { GlowBadge } from "@/components/ui/glow-badge";

const VALID_MODULE_STATUSES: ModuleChangeStatus[] = ["added", "changed", "removed"];
const VALID_TELEMETRY_TYPES: TelemetryType[] = ["spans", "metrics"];

function parseStatusParam(value: string | null): ModuleChangeStatus | "" {
  if (value && (VALID_MODULE_STATUSES as string[]).includes(value)) {
    return value as ModuleChangeStatus;
  }
  return "";
}

function parseTelemetryParam(value: string | null): Set<TelemetryType> {
  const result = new Set<TelemetryType>();
  if (!value) return result;
  value.split(",").forEach((v) => {
    if ((VALID_TELEMETRY_TYPES as string[]).includes(v)) {
      result.add(v as TelemetryType);
    }
  });
  return result;
}

export function JavaReleaseComparisonPage() {
  const { t } = useTranslation("java-agent");
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"changes" | "metrics">("changes");

  const { data: versionsData, loading: versionsLoading } = useVersions();

  const versions = useMemo(() => versionsData?.versions ?? [], [versionsData]);
  const latestVersion = versions.find((v) => v.is_latest)?.version ?? "";
  const previousVersion = versions.length > 1 ? versions[1].version : "";

  const fromVersion = searchParams.get("from") || previousVersion;
  const toVersion = searchParams.get("to") || latestVersion;

  useEffect(() => {
    if (versions.length > 0 && (!searchParams.get("from") || !searchParams.get("to"))) {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (!params.has("from")) {
            params.set("from", fromVersion || versions[Math.min(1, versions.length - 1)].version);
          }
          if (!params.has("to")) {
            params.set("to", toVersion || versions[0].version);
          }
          return params;
        },
        { replace: true }
      );
    }
  }, [versions, fromVersion, toVersion, searchParams, setSearchParams]);

  const validVersionStrings = useMemo(() => versions.map((v) => v.version), [versions]);

  const {
    diff,
    loading: diffLoading,
    error,
  } = useReleaseComparison(fromVersion, toVersion, validVersionStrings);

  const handleFromVersionChange = (version: string) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("from", version);
      params.set("to", toVersion);
      return params;
    });
  };

  const handleToVersionChange = (version: string) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("from", fromVersion);
      params.set("to", version);
      return params;
    });
  };

  const statusFilter = useMemo(() => parseStatusParam(searchParams.get("status")), [searchParams]);

  const handleStatusFilterChange = (next: ModuleChangeStatus | "") => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next) {
          params.set("status", next);
        } else {
          params.delete("status");
        }
        return params;
      },
      { replace: false }
    );
  };

  const telemetryFilter = useMemo(
    () => parseTelemetryParam(searchParams.get("telemetry")),
    [searchParams]
  );

  const handleTelemetryFilterChange = (next: Set<TelemetryType>) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next.size > 0) {
          params.set("telemetry", [...next].join(","));
        } else {
          params.delete("telemetry");
        }
        return params;
      },
      { replace: false }
    );
  };

  const handleClearFilters = () => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete("status");
        params.delete("telemetry");
        return params;
      },
      { replace: false }
    );
  };

  const hasAnyChanges = useMemo(() => {
    if (!diff) return false;
    return diff.instrumentations.some((i) => i.status !== "unchanged");
  }, [diff]);

  const filteredInstrumentations = useMemo(() => {
    if (!diff) return [];
    return diff.instrumentations.filter((i) => {
      if (i.status === "unchanged") return false;
      if (statusFilter && i.status !== statusFilter) return false;
      if (
        telemetryFilter.has("spans") &&
        i.telemetryDiff.spans.filter((s) => s.status !== "unchanged").length === 0
      )
        return false;
      if (
        telemetryFilter.has("metrics") &&
        i.telemetryDiff.metrics.filter((m) => m.status !== "unchanged").length === 0
      )
        return false;
      return true;
    });
  }, [diff, statusFilter, telemetryFilter]);

  const isFilteredEmpty = hasAnyChanges && filteredInstrumentations.length === 0;

  const isInvalidComparison = useMemo(() => {
    if (!fromVersion || !toVersion || versions.length === 0) return false;
    const fromIndex = versions.findIndex((v) => v.version === fromVersion);
    const toIndex = versions.findIndex((v) => v.version === toVersion);
    if (fromIndex === -1 || toIndex === -1) return true;
    return fromIndex <= toIndex;
  }, [fromVersion, toVersion, versions]);

  const changelogVersions = useMemo(() => {
    if (isInvalidComparison || !versions.length) return [toVersion];
    const fromIndex = versions.findIndex((v) => v.version === fromVersion);
    const toIndex = versions.findIndex((v) => v.version === toVersion);
    if (fromIndex > toIndex) {
      return versions.slice(toIndex, fromIndex).map((v) => v.version);
    }
    return [toVersion];
  }, [fromVersion, toVersion, versions, isInvalidComparison]);

  return (
    <PageContainer>
      <Seo />
      <div className="space-y-8">
        <BackButton />

        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold md:text-4xl">
              <span className="bg-gradient-to-r from-[hsl(var(--secondary-hsl))] to-[hsl(var(--primary-hsl))] bg-clip-text text-transparent">
                {t("releaseComparison.title")}
              </span>
            </h1>
            <p className="text-muted-foreground max-w-2xl">{t("releaseComparison.description")}</p>
          </div>
          {changelogVersions.length <= 1 ? (
            <a
              href={`https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/tag/v${changelogVersions[0]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border/30 hover:bg-card/60 bg-card/40 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            >
              {t("releaseComparison.viewChangelog", { version: changelogVersions[0] })}
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <details className="group relative">
              <summary className="border-border/30 hover:bg-card/60 bg-card/40 flex cursor-pointer list-none items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors">
                {t("releaseComparison.viewChangelogs")}
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-border/30 bg-card absolute top-full right-0 z-50 mt-1 max-h-64 w-max min-w-full overflow-y-auto rounded-lg border shadow-lg">
                {changelogVersions.map((v) => (
                  <a
                    key={v}
                    href={`https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/tag/v${v}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-muted/50 block px-4 py-2 text-sm transition-colors"
                  >
                    {t("releaseComparison.release", { version: v })}
                  </a>
                ))}
              </div>
            </details>
          )}
        </div>

        <ReleaseVersionSelector
          versions={versions}
          fromVersion={fromVersion}
          toVersion={toVersion}
          onFromVersionChange={handleFromVersionChange}
          onToVersionChange={handleToVersionChange}
        />

        {isInvalidComparison && fromVersion !== toVersion && (
          <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
              <div className="space-y-1">
                <p className="font-medium text-yellow-400">
                  {t("releaseComparison.invalidComparison")}
                </p>
                <p className="text-sm text-yellow-400/80">
                  {versions.findIndex((v) => v.version === fromVersion) === -1 ||
                  versions.findIndex((v) => v.version === toVersion) === -1
                    ? t("releaseComparison.invalidComparisonDescOne")
                    : t("releaseComparison.invalidComparisonDescTwo")}
                </p>
              </div>
            </div>
          </div>
        )}

        {fromVersion === toVersion && (
          <div className="border-border flex min-h-[300px] items-center justify-center rounded-xl border border-dashed">
            <div className="text-center">
              <p className="text-muted-foreground">{t("releaseComparison.selectDifferent")}</p>
            </div>
          </div>
        )}

        {(versionsLoading || diffLoading) && fromVersion !== toVersion && !isInvalidComparison && (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="text-primary h-12 w-12 animate-spin" />
              <div className="text-center">
                <p className="text-lg font-medium">{t("releaseComparison.comparingReleases")}</p>
                <p className="text-muted-foreground text-sm">
                  {t("releaseComparison.analyzing", { fromVersion, toVersion })}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && !isInvalidComparison && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-6 text-red-400">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">
                {t("releaseComparison.errorLoading", { message: error.message })}
              </p>
            </div>
          </div>
        )}

        {diff && fromVersion !== toVersion && !diffLoading && !isInvalidComparison && (
          <div className="animate-in fade-in space-y-12 duration-500">
            <div className="border-border/30 bg-card/40 flex flex-col gap-8 rounded-2xl border p-8 backdrop-blur-sm">
              <div className="flex items-center justify-center gap-12">
                <div className="text-center">
                  <p className="text-muted-foreground mb-1 text-xs font-bold tracking-widest uppercase">
                    {t("releaseComparison.from")}
                  </p>
                  <p className="font-mono text-3xl font-black">{fromVersion}</p>
                </div>
                <div className="bg-primary/20 flex h-12 w-12 items-center justify-center rounded-full">
                  <ArrowRight className="text-primary h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground mb-1 text-xs font-bold tracking-widest uppercase">
                    {t("releaseComparison.to")}
                  </p>
                  <p className="font-mono text-3xl font-black">{toVersion}</p>
                </div>
              </div>

              <div className="border-border/30 grid grid-cols-3 gap-6 border-t pt-8">
                <div className="text-center">
                  <p className="text-4xl font-black text-green-400">{diff.totals.added}</p>
                  <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                    {t("releaseComparison.instrumentationsAdded")}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-black text-blue-400">{diff.totals.changed}</p>
                  <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                    {t("releaseComparison.instrumentationsChanged")}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-black text-red-400">{diff.totals.removed}</p>
                  <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                    {t("releaseComparison.instrumentationsRemoved")}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div
                className="border-border/30 flex gap-8 border-b"
                role="tablist"
                aria-label={t("releaseComparison.comparisonSections")}
              >
                <button
                  id="tab-changes"
                  aria-controls="panel-changes"
                  onClick={() => setActiveTab("changes")}
                  aria-selected={activeTab === "changes"}
                  role="tab"
                  className={`relative pb-4 text-sm font-bold tracking-widest uppercase transition-colors ${
                    activeTab === "changes"
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("releaseComparison.changesSummary")}
                  {activeTab === "changes" && (
                    <div className="bg-primary absolute right-0 bottom-0 left-0 h-1 rounded-t-full" />
                  )}
                </button>
                <button
                  id="tab-metrics"
                  aria-controls="panel-metrics"
                  onClick={() => setActiveTab("metrics")}
                  aria-selected={activeTab === "metrics"}
                  role="tab"
                  className={`relative pb-4 text-sm font-bold tracking-widest uppercase transition-colors ${
                    activeTab === "metrics"
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("releaseComparison.allMetrics", { version: toVersion })}
                  {activeTab === "metrics" && (
                    <div className="bg-primary absolute right-0 bottom-0 left-0 h-1 rounded-t-full" />
                  )}
                </button>
              </div>

              {activeTab === "changes" && (
                <div
                  id="panel-changes"
                  role="tabpanel"
                  aria-labelledby="tab-changes"
                  className="space-y-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-2xl font-bold">{t("releaseComparison.moduleChanges")}</h2>
                    <div className="flex flex-wrap items-center gap-3">
                      {hasAnyChanges && (
                        <>
                          <TelemetryFilter
                            value={telemetryFilter}
                            onChange={handleTelemetryFilterChange}
                          />
                          <ModuleStatusFilter
                            value={statusFilter}
                            onChange={handleStatusFilterChange}
                          />
                        </>
                      )}
                      <div className="bg-muted/50 text-foreground/70 rounded-full px-4 py-1 text-xs font-bold">
                        {t("releaseComparison.modulesImpacted", {
                          count: filteredInstrumentations.length,
                        })}
                      </div>
                    </div>
                  </div>

                  {!hasAnyChanges ? (
                    <div className="border-border flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed">
                      <div className="text-center">
                        <p className="text-muted-foreground text-lg">
                          {t("releaseComparison.noChanges")}
                        </p>
                        <p className="text-muted-foreground/60 mt-1 text-sm">
                          {t("releaseComparison.noChangesDesc")}
                        </p>
                      </div>
                    </div>
                  ) : isFilteredEmpty ? (
                    <div className="border-border flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed">
                      <div className="text-center">
                        <p className="text-muted-foreground text-lg">
                          {t("releaseComparison.noFilteredResults")}
                        </p>
                        <p className="text-muted-foreground/60 mt-1 text-sm">
                          {t("releaseComparison.noFilteredResultsDesc")}
                        </p>
                        <button
                          onClick={handleClearFilters}
                          className="text-primary mt-4 text-sm font-semibold hover:underline"
                        >
                          {t("filter.reset")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {filteredInstrumentations.map((instr) => (
                        <InstrumentationDiffCard key={instr.id} diff={instr} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "metrics" && (
                <div
                  id="panel-metrics"
                  role="tabpanel"
                  aria-labelledby="tab-metrics"
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">
                      {t("releaseComparison.aggregateMetrics")}
                    </h2>
                    <div className="bg-muted/50 text-foreground/70 rounded-full px-4 py-1 text-xs font-bold">
                      {t("releaseComparison.totalMetrics", {
                        count: diff.aggregateMetrics.length,
                        version: toVersion,
                      })}
                    </div>
                  </div>

                  <div className="border-border/30 overflow-hidden rounded-2xl border">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-muted/30 border-border/30 border-b">
                          <th className="p-4 text-xs font-bold tracking-widest uppercase">
                            {t("releaseComparison.metricName")}
                          </th>
                          <th className="p-4 text-xs font-bold tracking-widest uppercase">
                            {t("releaseComparison.metricDescription")}
                          </th>
                          <th className="p-4 text-xs font-bold tracking-widest uppercase">
                            {t("releaseComparison.emittedBy")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {diff.aggregateMetrics.map((metric, index) => (
                          <tr
                            key={metric.name}
                            className={`border-border/10 hover:bg-muted/50 border-b transition-colors ${
                              index % 2 === 1 ? "bg-muted/40" : ""
                            }`}
                          >
                            <td className="p-4">
                              <code className="text-primary font-mono text-sm font-bold">
                                {metric.name}
                              </code>
                            </td>
                            <td className="text-muted-foreground p-4 text-sm">
                              {metric.description}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-2">
                                {metric.emittedBy.map((instr) => (
                                  <GlowBadge key={instr} variant="info">
                                    {instr}
                                  </GlowBadge>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
