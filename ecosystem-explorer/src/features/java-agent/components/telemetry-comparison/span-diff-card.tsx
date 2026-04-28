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
import type { SpanDiff } from "@/types/javaagent";
import { AttributeDiffTable } from "./attribute-diff-table";

interface SpanDiffCardProps {
  diff: SpanDiff;
}

export function SpanDiffCard({ diff }: SpanDiffCardProps) {
  const { status, span, changes } = diff;

  const statusVariant = status === "added" ? "success" : "warning";

  const statusLabel = status === "added" ? "Added" : status === "removed" ? "Removed" : "Changed";

  return (
    <div className="border-border/30 bg-card/30 hover:bg-card-secondary rounded-2xl border p-6 transition-all duration-300 md:p-10">
      <div className="space-y-6">
        {/* Span kind and badges */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h3 className="text-foreground text-lg font-bold md:text-xl">{span.span_kind} Span</h3>
          <div className="flex gap-2">
            <GlowBadge variant={statusVariant} withGlow className="text-[10px]">
              {statusLabel}
            </GlowBadge>
            <GlowBadge variant="info" withGlow className="text-xs">
              {span.span_kind}
            </GlowBadge>
          </div>
        </div>

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
              This span is no longer emitted in the comparison version.
            </p>
          </div>
        )}

        {/* Added indicator */}
        {status === "added" && (
          <div className="rounded-lg border border-green-400/30 bg-green-400/10 p-4">
            <p className="text-sm text-green-400">
              This span is newly emitted in the comparison version.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
