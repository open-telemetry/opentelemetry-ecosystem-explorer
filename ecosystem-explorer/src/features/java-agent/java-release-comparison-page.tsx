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
import { AlertCircle, Loader2, ArrowRight, ExternalLink } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { BackButton } from "@/components/ui/back-button";
import { useVersions } from "@/hooks/use-javaagent-data";
import { useReleaseComparison } from "./hooks/use-release-comparison";
import { ReleaseVersionSelector } from "./components/release-comparison/release-version-selector";
import { InstrumentationDiffCard } from "./components/release-comparison/instrumentation-diff-card";
import { GlowBadge } from "@/components/ui/glow-badge";

export function JavaReleaseComparisonPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"changes" | "metrics">("changes");

  const { data: versionsData, loading: versionsLoading } = useVersions();

  const versions = useMemo(() => versionsData?.versions ?? [], [versionsData]);
  const latestVersion = versions.find((v) => v.is_latest)?.version ?? "";
  const previousVersion = versions.length > 1 ? versions[1].version : "";

  const fromVersion = searchParams.get("from") || previousVersion;
  const toVersion = searchParams.get("to") || latestVersion;

  const changelogUrl = `https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/tag/v${toVersion}`;

  useEffect(() => {
    if (versions.length > 0 && (!searchParams.get("from") || !searchParams.get("to"))) {
      setSearchParams(
        {
          from: fromVersion || versions[Math.min(1, versions.length - 1)].version,
          to: toVersion || versions[0].version,
        },
        { replace: true }
      );
    }
  }, [versions, fromVersion, toVersion, searchParams, setSearchParams]);

  const { diff, loading: diffLoading, error } = useReleaseComparison(fromVersion, toVersion);

  const handleFromVersionChange = (version: string) => {
    setSearchParams({ from: version, to: toVersion });
  };

  const handleToVersionChange = (version: string) => {
    setSearchParams({ from: fromVersion, to: version });
  };

  const filteredInstrumentations = useMemo(() => {
    if (!diff) return [];
    return diff.instrumentations.filter((i) => i.status !== "unchanged");
  }, [diff]);

  const isInvalidComparison = useMemo(() => {
    if (!fromVersion || !toVersion || versions.length === 0) return false;
    const fromIndex = versions.findIndex((v) => v.version === fromVersion);
    const toIndex = versions.findIndex((v) => v.version === toVersion);
    return fromIndex <= toIndex && fromIndex !== -1 && toIndex !== -1;
  }, [fromVersion, toVersion, versions]);

  return (
    <PageContainer>
      <div className="space-y-8">
        <BackButton />

        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold md:text-4xl">
              <span className="bg-gradient-to-r from-[hsl(var(--secondary-hsl))] to-[hsl(var(--primary-hsl))] bg-clip-text text-transparent">
                Release Comparison
              </span>
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Compare Java Agent releases to discover new features and changes in telemetry.
            </p>
          </div>
          <a
            href={changelogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border/30 hover:bg-card/60 bg-card/40 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
          >
            View Changelog for {toVersion}
            <ExternalLink className="h-4 w-4" />
          </a>
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
                <p className="font-medium text-yellow-400">Invalid Comparison Direction</p>
                <p className="text-sm text-yellow-400/80">
                  Comparisons are usually performed from an older version to a newer version.
                </p>
              </div>
            </div>
          </div>
        )}

        {fromVersion === toVersion && (
          <div className="border-border flex min-h-[300px] items-center justify-center rounded-xl border border-dashed">
            <div className="text-center">
              <p className="text-muted-foreground">Select two different versions to see changes.</p>
            </div>
          </div>
        )}

        {(versionsLoading || diffLoading) && fromVersion !== toVersion && (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="text-primary h-12 w-12 animate-spin" />
              <div className="text-center">
                <p className="text-lg font-medium">Comparing Releases...</p>
                <p className="text-muted-foreground text-sm">
                  Analyzing {fromVersion} and {toVersion}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-6 text-red-400">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">Error loading comparison data: {error.message}</p>
            </div>
          </div>
        )}

        {diff && fromVersion !== toVersion && !diffLoading && (
          <div className="animate-in fade-in space-y-12 duration-300">
            <div className="border-border/30 bg-card/40 flex flex-col gap-8 rounded-2xl border p-8 backdrop-blur-sm">
              <div className="flex items-center justify-center gap-12">
                <div className="text-center">
                  <p className="text-muted-foreground mb-1 text-xs font-bold tracking-widest uppercase">
                    From
                  </p>
                  <p className="font-mono text-3xl font-black">{fromVersion}</p>
                </div>
                <div className="bg-primary/20 flex h-12 w-12 items-center justify-center rounded-full">
                  <ArrowRight className="text-primary h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground mb-1 text-xs font-bold tracking-widest uppercase">
                    To
                  </p>
                  <p className="font-mono text-3xl font-black">{toVersion}</p>
                </div>
              </div>

              <div className="border-border/30 grid grid-cols-3 gap-6 border-t pt-8">
                <div className="text-center">
                  <p className="text-4xl font-black text-green-400">{diff.totals.added}</p>
                  <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                    Added
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-black text-blue-400">{diff.totals.changed}</p>
                  <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                    Changed
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-black text-red-400">{diff.totals.removed}</p>
                  <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                    Removed
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="border-border/30 flex gap-8 border-b">
                <button
                  onClick={() => setActiveTab("changes")}
                  aria-selected={activeTab === "changes"}
                  role="tab"
                  className={`relative pb-4 text-sm font-bold tracking-widest uppercase transition-colors ${
                    activeTab === "changes"
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Changes Summary
                  {activeTab === "changes" && (
                    <div className="bg-primary absolute right-0 bottom-0 left-0 h-1 rounded-t-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("metrics")}
                  aria-selected={activeTab === "metrics"}
                  role="tab"
                  className={`relative pb-4 text-sm font-bold tracking-widest uppercase transition-colors ${
                    activeTab === "metrics"
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Metrics ({toVersion})
                  {activeTab === "metrics" && (
                    <div className="bg-primary absolute right-0 bottom-0 left-0 h-1 rounded-t-full" />
                  )}
                </button>
              </div>

              {activeTab === "changes" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Module Changes</h2>
                    <div className="bg-muted/50 text-foreground/70 rounded-full px-4 py-1 text-xs font-bold">
                      {filteredInstrumentations.length} Modules Impacted
                    </div>
                  </div>

                  {filteredInstrumentations.length === 0 ? (
                    <div className="border-border flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed">
                      <div className="text-center">
                        <p className="text-muted-foreground text-lg">
                          No changes found in telemetry or configuration.
                        </p>
                        <p className="text-muted-foreground/60 mt-1 text-sm">
                          Everything is identical between these two versions.
                        </p>
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
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Aggregate Metrics</h2>
                    <div className="bg-muted/50 text-foreground/70 rounded-full px-4 py-1 text-xs font-bold">
                      {diff.aggregateMetrics.length} Total Metrics in {toVersion}
                    </div>
                  </div>

                  <div className="border-border/30 overflow-hidden rounded-2xl border">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-muted/30 border-border/30 border-b">
                          <th className="p-4 text-xs font-bold tracking-widest uppercase">
                            Metric Name
                          </th>
                          <th className="p-4 text-xs font-bold tracking-widest uppercase">
                            Description
                          </th>
                          <th className="p-4 text-xs font-bold tracking-widest uppercase">
                            Emitted By
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {diff.aggregateMetrics.map((metric, index) => (
                          <tr
                            key={metric.name}
                            className={`border-border/10 border-b transition-colors hover:bg-white/5 ${
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
