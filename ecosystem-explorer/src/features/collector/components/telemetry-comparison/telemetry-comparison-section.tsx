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

import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Loader } from "@/components/ui/loader";
import type { VersionInfo } from "@/types/collector";
import { useComponentVersions } from "@/hooks/use-collector-data";
import { useTelemetryComparison } from "../../hooks/use-telemetry-comparison";
import { VersionSelectorPanel } from "./version-selector-panel";
import { DiffResultsSection } from "./diff-results-section";

interface TelemetryComparisonSectionProps {
  distribution: string;
  name: string;
  versions: VersionInfo[];
  currentVersion: string;
}

export function TelemetryComparisonSection({
  distribution,
  name,
  versions,
  currentVersion,
}: TelemetryComparisonSectionProps) {
  const { t } = useTranslation("collector");

  // Not every Collector release includes this component (e.g. core-only components skip
  // contrib-only releases), so comparisons must be scoped to releases the component actually
  // exists in rather than `versions` (every Collector release). Otherwise the default/selectable
  // "from" version can point at a release without this component, and loadComponent() throwing
  // for that side makes the diff misreport every metric on the other side as "added"/"removed".
  const {
    data: componentVersionList,
    loading: componentVersionsLoading,
    error: componentVersionsError,
  } = useComponentVersions(distribution, name);
  const scopedVersions = componentVersionList
    ? versions.filter((v) => componentVersionList.includes(v.version))
    : [];

  // "To" defaults to the version being viewed. "From" defaults to the previous release,
  // or falls back to currentVersion (triggering a same-version warning) if viewing the oldest version.
  const currentIndex = scopedVersions.findIndex((v) => v.version === currentVersion);
  const defaultFromVersion =
    currentIndex >= 0 && currentIndex < scopedVersions.length - 1
      ? scopedVersions[currentIndex + 1].version
      : currentVersion;

  const {
    fromVersion,
    toVersion,
    setFromVersion,
    setToVersion,
    diffResult,
    loading,
    error,
    fromNotFound,
    toNotFound,
  } = useTelemetryComparison(distribution, name, defaultFromVersion, currentVersion);

  if (componentVersionsLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader size="sm" label={t("telemetryComparison.loading")} />
      </div>
    );
  }

  if (componentVersionsError) {
    // Mirrors collector-detail-page.tsx's sibling failure branch: the raw error (an internal
    // message from collector-data.ts, e.g. "Collector versions index returned null
    // unexpectedly") is never rendered to users -- only the localized, generic explanation.
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="max-w-2xl rounded-lg border border-red-500/30 bg-red-500/10 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="font-medium text-red-700 dark:text-red-400">
                {t("detail.view.comparisonUnavailable.title")}
              </p>
              <p className="text-sm text-red-700 dark:text-red-400">
                {t("detail.view.comparisonUnavailable.message")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (scopedVersions.length < 2) {
    // The component exists in zero or one of the passed-in releases, so there is no second
    // version to compare against. Showing the version selector + "same version selected"
    // warning here would tell the user to do something impossible.
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="font-medium text-orange-700 dark:text-orange-400">
                {t("telemetryComparison.warnings.insufficientVersions.title")}
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-400">
                {t("telemetryComparison.warnings.insufficientVersions.message")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <VersionSelectorPanel
        versions={scopedVersions}
        fromVersion={fromVersion}
        toVersion={toVersion}
        onFromVersionChange={setFromVersion}
        onToVersionChange={setToVersion}
      />

      {loading && (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader size="sm" label={t("telemetryComparison.loading")} />
        </div>
      )}

      {error && !loading && (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="max-w-2xl rounded-lg border border-red-500/30 bg-red-500/10 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-medium text-red-700 dark:text-red-400">
                  {t("telemetryComparison.error.title")}
                </p>
                <p className="text-sm text-red-700 dark:text-red-400">{error.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && (fromNotFound || toNotFound) && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="font-medium text-orange-700 dark:text-orange-400">
                {t("telemetryComparison.warnings.availability.title")}
              </p>
              {fromNotFound && (
                <p className="text-sm text-orange-700 dark:text-orange-400">
                  {t("telemetryComparison.warnings.availability.fromNotFound", { fromVersion })}
                </p>
              )}
              {toNotFound && !fromNotFound && (
                <p className="text-sm text-orange-700 dark:text-orange-400">
                  {t("telemetryComparison.warnings.availability.toNotFound", { toVersion })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && !error && fromVersion === toVersion && (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600 dark:text-orange-400"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-medium text-orange-700 dark:text-orange-400">
                  {t("telemetryComparison.warnings.sameVersion.title")}
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-400">
                  {t("telemetryComparison.warnings.sameVersion.message")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && diffResult && fromVersion !== toVersion && (
        <DiffResultsSection diffResult={diffResult} />
      )}
    </div>
  );
}
