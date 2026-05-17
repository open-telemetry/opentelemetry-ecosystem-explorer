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

import type { ReleaseDiffSummary } from "@/features/java-agent/hooks/use-release-diff";
import { GlowBadge } from "@/components/ui/glow-badge";

interface ReleaseSummaryStatsProps {
  summary: ReleaseDiffSummary;
  fromVersion: string;
  toVersion: string;
}

export function ReleaseSummaryStats({ summary, fromVersion, toVersion }: ReleaseSummaryStatsProps) {
  const hasTelemetryChanges =
    summary.totalMetricsAdded +
      summary.totalMetricsRemoved +
      summary.totalMetricsChanged +
      summary.totalSpansAdded +
      summary.totalSpansRemoved +
      summary.totalSpansChanged >
    0;

  return (
    <div className="border-border/30 bg-card/40 space-y-6 rounded-xl border p-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Comparing</span>
        <code className="bg-muted text-foreground/80 rounded px-2 py-1 text-sm">{fromVersion}</code>
        <span className="text-muted-foreground" aria-hidden="true">
          →
        </span>
        <code className="bg-muted text-foreground/80 rounded px-2 py-1 text-sm">{toVersion}</code>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCell
          label="Added"
          value={summary.instrumentationsAdded}
          variant="success"
          description="instrumentations added in this release"
        />
        <StatCell
          label="Removed"
          value={summary.instrumentationsRemoved}
          variant="error"
          description="instrumentations removed in this release"
        />
        <StatCell
          label="Changed"
          value={summary.instrumentationsChanged}
          variant="warning"
          description="instrumentations with telemetry changes"
        />
        <StatCell
          label="Unchanged"
          value={summary.instrumentationsUnchanged}
          variant="muted"
          description="instrumentations with no telemetry changes"
        />
      </dl>

      {hasTelemetryChanges && (
        <div className="border-border/30 space-y-3 border-t pt-4">
          <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
            Telemetry Changes
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            {summary.totalMetricsAdded > 0 && (
              <span className="text-green-400">+{summary.totalMetricsAdded} metrics</span>
            )}
            {summary.totalMetricsRemoved > 0 && (
              <span className="text-red-400">−{summary.totalMetricsRemoved} metrics</span>
            )}
            {summary.totalMetricsChanged > 0 && (
              <span className="text-amber-400">
                ~{summary.totalMetricsChanged} metrics modified
              </span>
            )}
            {summary.totalSpansAdded > 0 && (
              <span className="text-green-400">+{summary.totalSpansAdded} spans</span>
            )}
            {summary.totalSpansRemoved > 0 && (
              <span className="text-red-400">−{summary.totalSpansRemoved} spans</span>
            )}
            {summary.totalSpansChanged > 0 && (
              <span className="text-amber-400">~{summary.totalSpansChanged} spans modified</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCellProps {
  label: string;
  value: number;
  variant: "success" | "error" | "warning" | "muted";
  description: string;
}

function StatCell({ label, value, variant, description }: StatCellProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg p-3">
      <dt className="sr-only">{description}</dt>
      <dd className="text-3xl font-bold tabular-nums">{value}</dd>
      <GlowBadge variant={variant}>{label}</GlowBadge>
    </div>
  );
}
