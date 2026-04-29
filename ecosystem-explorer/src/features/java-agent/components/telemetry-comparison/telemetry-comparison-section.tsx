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
import type { VersionInfo } from "@/types/javaagent";
import { useTelemetryComparison } from "../../hooks/use-telemetry-comparison";
import { VersionSelectorPanel } from "./version-selector-panel";
import { DiffResultsSection } from "./diff-results-section";

interface TelemetryComparisonSectionProps {
  instrumentationName: string;
  versions: VersionInfo[];
  currentVersion: string;
}

export function TelemetryComparisonSection({
  instrumentationName,
  versions,
  currentVersion,
}: TelemetryComparisonSectionProps) {
  // "To" defaults to the version being viewed; "From" defaults to the previous release.
  const currentIndex = versions.findIndex((v) => v.version === currentVersion);
  const defaultFromVersion =
    currentIndex < versions.length - 1
      ? versions[currentIndex + 1].version
      : versions[0]?.version || currentVersion;

  const {
    fromVersion,
    toVersion,
    setFromVersion,
    setToVersion,
    whenCondition,
    setWhenCondition,
    availableConditions,
    diffResult,
    loading,
    error,
    fromNotFound,
    toNotFound,
  } = useTelemetryComparison(instrumentationName, defaultFromVersion, currentVersion);

  return (
    <div className="space-y-8">
      {/* Version selector panel */}
      <VersionSelectorPanel
        versions={versions}
        fromVersion={fromVersion}
        toVersion={toVersion}
        onFromVersionChange={setFromVersion}
        onToVersionChange={setToVersion}
        whenCondition={whenCondition}
        onWhenConditionChange={setWhenCondition}
        availableConditions={availableConditions}
      />

      {/* Loading state */}
      {loading && (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="flex items-center gap-3">
            <Loader2 className="text-primary h-6 w-6 animate-spin" />
            <p className="text-muted-foreground text-sm">Loading comparison data...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="max-w-2xl rounded-lg border border-red-400/30 bg-red-400/10 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
              <div className="space-y-1">
                <p className="font-medium text-red-400">Comparison Error</p>
                <p className="text-sm text-red-400/80">{error.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning for missing versions */}
      {!loading && !error && (fromNotFound || toNotFound) && (
        <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
            <div className="space-y-1">
              <p className="font-medium text-yellow-400">Version Availability Note</p>
              {fromNotFound && (
                <p className="text-sm text-yellow-400/80">
                  The instrumentation was not available in version {fromVersion}.
                  {toNotFound ? "" : " All telemetry from the “to” version is shown as added."}
                </p>
              )}
              {toNotFound && !fromNotFound && (
                <p className="text-sm text-yellow-400/80">
                  The instrumentation was not available in version {toVersion}. All telemetry from
                  the &ldquo;from&rdquo; version is shown as removed.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Same version warning */}
      {!loading && !error && fromVersion === toVersion && (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
              <div className="space-y-1">
                <p className="font-medium text-yellow-400">Same Version Selected</p>
                <p className="text-sm text-yellow-400/80">
                  Please select different versions to compare telemetry.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && !error && diffResult && fromVersion !== toVersion && (
        <DiffResultsSection diffResult={diffResult} whenCondition={whenCondition} />
      )}
    </div>
  );
}
