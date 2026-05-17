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

import { useSearchParams } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { BackButton } from "@/components/ui/back-button";
import { useVersions } from "@/hooks/use-javaagent-data";
import { useReleaseDiff } from "@/features/java-agent/hooks/use-release-diff";
import { VersionSelectorPanel } from "./components/telemetry-comparison/version-selector-panel";
import { ReleaseSummaryStats } from "./components/release-comparison/release-summary-stats";
import { ReleaseResultsTable } from "./components/release-comparison/release-results-table";

export function JavaReleaseComparisonPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: versionsData, loading: versionsLoading, error: versionsError } = useVersions();

  const versions = versionsData?.versions ?? [];
  const latestVersion = versions.find((v) => v.is_latest)?.version ?? "";
  // Use the first non-latest version as the default "from" baseline.
  const previousVersion = versions.find((v) => !v.is_latest)?.version ?? latestVersion;

  const fromVersion = searchParams.get("from") ?? previousVersion;
  const toVersion = searchParams.get("to") ?? latestVersion;

  const {
    diffs,
    summary,
    loading: diffLoading,
    error: diffError,
  } = useReleaseDiff(fromVersion, toVersion);

  const sameVersion = Boolean(fromVersion && toVersion && fromVersion === toVersion);

  return (
    <PageContainer>
      <div className="space-y-8">
        <BackButton />

        <div className="space-y-2">
          <h1 className="text-3xl font-bold md:text-4xl">
            <span className="from-otel-orange to-otel-blue bg-gradient-to-r bg-clip-text text-transparent">
              Release Comparison
            </span>
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Compare Java Agent releases to discover new instrumentations and changes in telemetry.
          </p>
        </div>

        {versionsLoading && (
          <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
            <Loader2 className="text-primary h-6 w-6 animate-spin" aria-hidden="true" />
            <span className="text-muted-foreground ml-3 text-sm">Loading versions…</span>
          </div>
        )}

        {versionsError && !versionsLoading && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium text-red-400">Error loading versions</p>
                <p className="mt-1 text-sm text-red-400/80">{versionsError.message}</p>
              </div>
            </div>
          </div>
        )}

        {!versionsLoading && !versionsError && (
          <VersionSelectorPanel
            versions={versions}
            fromVersion={fromVersion}
            toVersion={toVersion}
            onFromVersionChange={(v) => setSearchParams({ from: v, to: toVersion })}
            onToVersionChange={(v) => setSearchParams({ from: fromVersion, to: v })}
            whenCondition="default"
            onWhenConditionChange={() => {}}
            availableConditions={["default"]}
          />
        )}

        {!versionsLoading && !versionsError && sameVersion && (
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <p className="font-medium text-yellow-400">Same Version Selected</p>
                  <p className="text-sm text-yellow-400/80">
                    Please select different versions to compare.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {diffError && !diffLoading && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium text-red-400">Error loading comparison data</p>
                <p className="mt-1 text-sm text-red-400/80">{diffError.message}</p>
              </div>
            </div>
          </div>
        )}

        {diffLoading && (
          <div
            className="flex min-h-[300px] items-center justify-center"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="text-primary h-6 w-6 animate-spin" aria-hidden="true" />
              <p className="text-muted-foreground text-sm">Computing release diff…</p>
            </div>
          </div>
        )}

        {!diffLoading && !diffError && !sameVersion && summary && (
          <div className="space-y-8">
            <ReleaseSummaryStats
              summary={summary}
              fromVersion={fromVersion}
              toVersion={toVersion}
            />
            <ReleaseResultsTable diffs={diffs} fromVersion={fromVersion} toVersion={toVersion} />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
