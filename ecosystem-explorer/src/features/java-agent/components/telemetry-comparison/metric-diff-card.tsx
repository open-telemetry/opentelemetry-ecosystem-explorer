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

import { GlowBadge } from "@/components/ui/glow-badge";
import type { MetricDiff } from "@/types/javaagent";
import { AttributeDiffTable } from "./attribute-diff-table";

interface MetricDiffCardProps {
  diff: MetricDiff;
}

export function MetricDiffCard({ diff }: MetricDiffCardProps) {
  const { status, metric, changes } = diff;

  const statusVariant = status === "added" ? "success" : "warning";

  const statusLabel = status === "added" ? "Added" : status === "removed" ? "Removed" : "Changed";

  return (
    <div className="border-border/30 bg-card/30 hover:bg-card-secondary rounded-2xl border p-6 transition-all duration-300 md:p-10">
      <div className="space-y-6">
        {/* Metric name and badges */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <code className="text-foreground flex-1 font-mono text-lg font-semibold break-all">
            {metric.name}
          </code>
          <div className="flex gap-2">
            <GlowBadge variant={statusVariant} withGlow className="text-[10px]">
              {statusLabel}
            </GlowBadge>
            <GlowBadge variant="success" withGlow className="text-[10px]">
              {metric.data_type}
            </GlowBadge>
          </div>
        </div>

        {/* Description */}
        {status !== "removed" && (
          <p className="text-foreground/80 text-base leading-relaxed">{metric.description}</p>
        )}

        {/* Description change indicator */}
        {status === "changed" && changes?.description && (
          <div className="space-y-2">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Description Changed
            </span>
            <div className="border-border/30 space-y-1 rounded-lg border bg-white/[0.03] p-3">
              <p className="text-sm text-red-400 line-through opacity-60">
                {changes.description.before}
              </p>
              <p className="text-sm text-green-400">{changes.description.after}</p>
            </div>
          </div>
        )}

        {/* Data type change indicator */}
        {status === "changed" && changes?.data_type && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Type Changed
            </span>
            <div className="flex items-center gap-2">
              <code className="rounded border border-red-400/30 bg-red-400/10 px-2 py-1 text-sm text-red-400 line-through">
                {changes.data_type.before}
              </code>
              <span className="text-muted-foreground">→</span>
              <code className="rounded border border-green-400/30 bg-green-400/10 px-2 py-1 text-sm text-green-400">
                {changes.data_type.after}
              </code>
            </div>
          </div>
        )}

        {/* Unit section */}
        {status !== "removed" && (
          <div className="border-border/30 flex items-center gap-3 border-b pb-6">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Unit
            </span>
            <code className="border-border/30 text-foreground/80 rounded border bg-white/[0.03] px-2 py-1 text-sm">
              {metric.unit}
            </code>
            {status === "changed" && changes?.unit && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">(was:</span>
                <code className="rounded border border-red-400/30 bg-red-400/10 px-2 py-1 text-sm text-red-400 line-through">
                  {changes.unit.before}
                </code>
                <span className="text-muted-foreground text-xs">)</span>
              </div>
            )}
          </div>
        )}

        {/* Attributes section */}
        {status === "changed" && changes?.attributes && (
          <div className="space-y-4">
            <h4 className="text-muted-foreground text-xs font-black tracking-[0.2em] uppercase">
              Attribute Changes
            </h4>
            <AttributeDiffTable changes={changes.attributes} />
          </div>
        )}

        {/* Removed indicator */}
        {status === "removed" && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-4">
            <p className="text-sm text-red-400">
              This metric is no longer emitted in the comparison version.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
