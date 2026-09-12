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

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { CollectorTelemetryDiffResult } from "@/types/collector";
import { MetricDiffCard } from "./metric-diff-card";

interface DiffResultsSectionProps {
  diffResult: CollectorTelemetryDiffResult;
}

function SectionDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <div className="to-border h-px w-16 bg-gradient-to-r from-transparent" />
      <span className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
        {children}
      </span>
      <div className="to-border h-px w-16 bg-gradient-to-l from-transparent" />
    </div>
  );
}

export function DiffResultsSection({ diffResult }: DiffResultsSectionProps) {
  const { t } = useTranslation("collector");
  const { metrics } = diffResult;

  const addedOrRemoved = metrics.filter((m) => m.status === "added" || m.status === "removed");
  const changed = metrics.filter((m) => m.status === "changed");
  const hasAnyChanges = metrics.some((m) => m.status !== "unchanged");

  if (!hasAnyChanges) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="text-muted-foreground text-lg font-medium">
            {t("diffResults.empty.title")}
          </p>
          <p className="text-muted-foreground/70 text-sm">{t("diffResults.empty.description")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {addedOrRemoved.length > 0 && (
        <div className="space-y-6">
          <SectionDivider>{t("diffResults.addedRemovedHeader")}</SectionDivider>
          <div className="mx-auto max-w-3xl space-y-6">
            {addedOrRemoved.map((metricDiff) => (
              <MetricDiffCard key={metricDiff.name} diff={metricDiff} />
            ))}
          </div>
        </div>
      )}

      {changed.length > 0 && (
        <div className="space-y-6">
          <SectionDivider>{t("diffResults.changedHeader")}</SectionDivider>
          <div className="mx-auto max-w-3xl space-y-6">
            {changed.map((metricDiff) => (
              <MetricDiffCard key={metricDiff.name} diff={metricDiff} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
