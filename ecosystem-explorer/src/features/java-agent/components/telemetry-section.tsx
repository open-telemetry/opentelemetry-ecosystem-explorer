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
import { SectionDivider } from "@/components/ui/section-divider";
import { GlowBadge } from "@/components/ui/glow-badge";
import { AttributeTable } from "./attribute-table";
import { ConfigurationSelector } from "./configuration-selector";
import type { Telemetry } from "@/types/javaagent";

interface TelemetrySectionProps {
  telemetry: Telemetry[];
}

export function TelemetrySection({ telemetry }: TelemetrySectionProps) {
  const [selectedWhen, setSelectedWhen] = useState(telemetry[0]?.when ?? "default");

  // Validate selected value and fall back to first option if invalid
  const isCurrentSelectionValid = telemetry.some((t) => t.when === selectedWhen);
  const effectiveSelectedWhen = isCurrentSelectionValid
    ? selectedWhen
    : (telemetry[0]?.when ?? "default");

  const currentTelemetry = telemetry.find((t) => t.when === effectiveSelectedWhen) ?? telemetry[0];

  const hasMetrics = currentTelemetry?.metrics && currentTelemetry.metrics.length > 0;
  const hasSpans = currentTelemetry?.spans && currentTelemetry.spans.length > 0;
  const hasBothMetricsAndSpans = hasMetrics && hasSpans;

  return (
    <div className="space-y-8">
      {/* Configuration Selector - only show if multiple conditions exist */}
      {telemetry.length > 1 && (
        <ConfigurationSelector
          telemetry={telemetry}
          selectedWhen={effectiveSelectedWhen}
          onWhenChange={setSelectedWhen}
        />
      )}

      <div className={hasBothMetricsAndSpans ? "grid grid-cols-1 lg:grid-cols-2 gap-8" : ""}>
        {/* Metrics Section */}
        {hasMetrics && (
          <div>
            <SectionDivider>Metrics</SectionDivider>
            <div className={hasBothMetricsAndSpans ? "space-y-8" : "mx-auto max-w-3xl space-y-8"}>
              {currentTelemetry.metrics &&
                currentTelemetry.metrics.map((metric) => (
                  <div
                    key={metric.name}
                    className="rounded-2xl border border-border/30 bg-card/30 p-6 md:p-10"
                  >
                    <div className="space-y-6">
                      {/* Metric name and type badge */}
                      <div className="flex items-start justify-between gap-4">
                        <code className="flex-1 break-all font-mono text-lg font-semibold text-foreground">
                          {metric.name}
                        </code>
                        <GlowBadge variant="success" withGlow className="text-[10px]">
                          {metric.type}
                        </GlowBadge>
                      </div>

                      {/* Description */}
                      <p className="text-base leading-relaxed text-foreground/80 md:text-base">
                        {metric.description}
                      </p>

                      {/* Unit section with border */}
                      <div className="flex items-center gap-3 border-b border-border/30 pb-6">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Unit
                        </span>
                        <code className="rounded border border-border/30 bg-white/[0.03] px-2 py-1 text-sm text-foreground/80 ">
                          {metric.unit}
                        </code>
                      </div>

                      {/* Attributes section */}
                      {metric.attributes && metric.attributes.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                            Attributes
                          </h4>
                          <AttributeTable attributes={metric.attributes} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Spans Section */}
        {hasSpans && (
          <div>
            <SectionDivider>Spans</SectionDivider>
            <div className={hasBothMetricsAndSpans ? "space-y-8" : "mx-auto max-w-3xl space-y-8"}>
              {currentTelemetry.spans &&
                currentTelemetry.spans.map((span, index) => (
                  <div
                    key={`${span.span_kind}-${index}`}
                    className="rounded-2xl border border-border/30 bg-card/30 p-6 md:p-10"
                  >
                    <div className="space-y-6">
                      {/* Span kind badge */}
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-foreground md:text-xl">
                          {span.span_kind} Span
                        </h3>
                        <GlowBadge variant="info" withGlow className="text-xs">
                          {span.span_kind}
                        </GlowBadge>
                      </div>

                      {/* Attributes section */}
                      {span.attributes && span.attributes.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                            Attributes
                          </h4>
                          <AttributeTable attributes={span.attributes} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!hasMetrics && !hasSpans && (
        <div className="flex min-h-[200px] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No metrics or spans defined for this configuration.
          </p>
        </div>
      )}
    </div>
  );
}
