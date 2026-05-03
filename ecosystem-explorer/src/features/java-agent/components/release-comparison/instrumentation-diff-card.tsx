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

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Minus, RefreshCw } from "lucide-react";
import { GlowBadge } from "@/components/ui/glow-badge";
import { DiffResultsSection } from "../telemetry-comparison/diff-results-section";
import type { InstrumentationDiff } from "../../utils/release-diff";

interface InstrumentationDiffCardProps {
  diff: InstrumentationDiff;
}

const statusConfig = {
  added: {
    label: "Added",
    variant: "success" as const,
    icon: Plus,
    borderColor: "border-green-500/20",
    bgColor: "bg-green-500/5",
    iconColor: "text-green-400",
  },
  removed: {
    label: "Removed",
    variant: "warning" as const,
    icon: Minus,
    borderColor: "border-red-500/20",
    bgColor: "bg-red-500/5",
    iconColor: "text-red-400",
  },
  changed: {
    label: "Changed",
    variant: "info" as const,
    icon: RefreshCw,
    borderColor: "border-blue-500/20",
    bgColor: "bg-blue-500/5",
    iconColor: "text-blue-400",
  },
  unchanged: {
    label: "Unchanged",
    variant: "muted" as const,
    icon: RefreshCw,
    borderColor: "border-border/20",
    bgColor: "bg-card/40",
    iconColor: "text-muted-foreground",
  },
};

/**
 * InstrumentationDiffCard renders an expandable card summarizing the changes
 * for a single instrumentation module between two Java Agent releases.
 */
export function InstrumentationDiffCard({ diff }: InstrumentationDiffCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const config = statusConfig[diff.status];
  const StatusIcon = config.icon;

  const hasTelemetryChanges =
    diff.telemetryDiff.metrics.some((m) => m.status !== "unchanged") ||
    diff.telemetryDiff.spans.some((s) => s.status !== "unchanged");

  const hasConfigChanges =
    diff.configDiff &&
    (diff.configDiff.added.length > 0 ||
      diff.configDiff.removed.length > 0 ||
      diff.configDiff.changed.length > 0);

  const changedMetricsCount = diff.telemetryDiff.metrics.filter(
    (m) => m.status !== "unchanged"
  ).length;
  const changedSpansCount = diff.telemetryDiff.spans.filter((s) => s.status !== "unchanged").length;

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-all duration-300 ${config.borderColor} ${config.bgColor}`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-white/5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <StatusIcon className={`h-4 w-4 flex-shrink-0 ${config.iconColor}`} aria-hidden="true" />
          <span className="truncate font-mono text-sm font-semibold">{diff.displayName}</span>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <GlowBadge variant={config.variant}>{config.label}</GlowBadge>

          {changedMetricsCount > 0 && (
            <GlowBadge variant="primary">
              {changedMetricsCount} Metric{changedMetricsCount !== 1 ? "s" : ""}
            </GlowBadge>
          )}
          {changedSpansCount > 0 && (
            <GlowBadge variant="info">
              {changedSpansCount} Span{changedSpansCount !== 1 ? "s" : ""}
            </GlowBadge>
          )}
          {hasConfigChanges && <GlowBadge variant="warning">Config</GlowBadge>}

          {isExpanded ? (
            <ChevronDown className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-border/20 border-t px-5 py-6">
          {hasTelemetryChanges && (
            <div className="space-y-4">
              <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                Telemetry Changes
              </h3>
              <DiffResultsSection diffResult={diff.telemetryDiff} />
            </div>
          )}

          {hasConfigChanges && diff.configDiff && (
            <div className={`space-y-4 ${hasTelemetryChanges ? "mt-8" : ""}`}>
              <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                Configuration Changes
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {diff.configDiff.added.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-green-400 uppercase">Added</p>
                    <div className="flex flex-wrap gap-1.5">
                      {diff.configDiff.added.map((name) => (
                        <GlowBadge key={name} variant="success">
                          {name}
                        </GlowBadge>
                      ))}
                    </div>
                  </div>
                )}
                {diff.configDiff.removed.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-red-400 uppercase">Removed</p>
                    <div className="flex flex-wrap gap-1.5">
                      {diff.configDiff.removed.map((name) => (
                        <GlowBadge key={name} variant="warning">
                          {name}
                        </GlowBadge>
                      ))}
                    </div>
                  </div>
                )}
                {diff.configDiff.changed.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-blue-400 uppercase">Modified</p>
                    <div className="flex flex-wrap gap-1.5">
                      {diff.configDiff.changed.map((name) => (
                        <GlowBadge key={name} variant="info">
                          {name}
                        </GlowBadge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!hasTelemetryChanges && !hasConfigChanges && (
            <p className="text-muted-foreground text-sm">
              This module was {diff.status} with no detailed telemetry breakdown available.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
