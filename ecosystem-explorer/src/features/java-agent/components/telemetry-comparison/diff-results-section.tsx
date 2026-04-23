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
import type { TelemetryDiffResult } from "@/types/javaagent";
import { MetricDiffCard } from "./metric-diff-card";
import { SpanDiffCard } from "./span-diff-card";

interface DiffResultsSectionProps {
  diffResult: TelemetryDiffResult;
  whenCondition?: string;
}

function SectionDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <div className="h-px w-16 bg-gradient-to-r from-transparent to-border" />
      <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        {children}
      </span>
      <div className="h-px w-16 bg-gradient-to-l from-transparent to-border" />
    </div>
  );
}

export function DiffResultsSection({
  diffResult,
  whenCondition = "default",
}: DiffResultsSectionProps) {
  const { metrics, spans } = diffResult;

  // Separate diffs by status
  const addedOrRemovedMetrics = metrics.filter(
    (m) => m.status === "added" || m.status === "removed"
  );
  const changedMetrics = metrics.filter((m) => m.status === "changed");

  const addedOrRemovedSpans = spans.filter((s) => s.status === "added" || s.status === "removed");
  const changedSpans = spans.filter((s) => s.status === "changed");

  const hasAddedOrRemoved = addedOrRemovedMetrics.length > 0 || addedOrRemovedSpans.length > 0;
  const hasChanged = changedMetrics.length > 0 || changedSpans.length > 0;

  const hasAnyChanges =
    metrics.some((m) => m.status !== "unchanged") || spans.some((s) => s.status !== "unchanged");

  if (!hasAnyChanges) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-muted-foreground">No differences found</p>
          <p className="text-sm text-muted-foreground/70">
            Telemetry is identical for <span className="font-mono">{whenCondition}</span> between
            the selected versions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Added/Removed Section */}
      {hasAddedOrRemoved && (
        <div className="space-y-6">
          <SectionDivider>Telemetry Added/Removed</SectionDivider>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Metrics */}
            {addedOrRemovedMetrics.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Metrics
                </h3>
                <div className="space-y-6">
                  {addedOrRemovedMetrics.map((metricDiff) => (
                    <MetricDiffCard key={metricDiff.metric.name} diff={metricDiff} />
                  ))}
                </div>
              </div>
            )}

            {/* Spans */}
            {addedOrRemovedSpans.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Spans
                </h3>
                <div className="space-y-6">
                  {addedOrRemovedSpans.map((spanDiff, index) => (
                    <SpanDiffCard key={`${spanDiff.span.span_kind}-${index}`} diff={spanDiff} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Changed Section */}
      {hasChanged && (
        <div className="space-y-6">
          <SectionDivider>Telemetry Changed</SectionDivider>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Metrics */}
            {changedMetrics.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Metrics
                </h3>
                <div className="space-y-6">
                  {changedMetrics.map((metricDiff) => (
                    <MetricDiffCard key={metricDiff.metric.name} diff={metricDiff} />
                  ))}
                </div>
              </div>
            )}

            {/* Spans */}
            {changedSpans.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Spans
                </h3>
                <div className="space-y-6">
                  {changedSpans.map((spanDiff, index) => (
                    <SpanDiffCard key={`${spanDiff.span.span_kind}-${index}`} diff={spanDiff} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
