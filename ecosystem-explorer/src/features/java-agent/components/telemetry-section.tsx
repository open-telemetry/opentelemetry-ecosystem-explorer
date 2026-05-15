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
import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";
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

  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(
    new Set(currentTelemetry?.metrics?.map((m) => m.name) || [])
  );
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(
    new Set(currentTelemetry?.spans?.map((_, i) => i.toString()) || [])
  );

  // Synchronize expanded state when telemetry changes without using useEffect
  const [prevTelemetry, setPrevTelemetry] = useState(currentTelemetry);
  if (currentTelemetry !== prevTelemetry) {
    setPrevTelemetry(currentTelemetry);
    setExpandedMetrics(new Set(currentTelemetry?.metrics?.map((m) => m.name) || []));
    setExpandedSpans(new Set(currentTelemetry?.spans?.map((_, i) => i.toString()) || []));
  }

  const expandAllMetrics = () => {
    setExpandedMetrics(new Set(currentTelemetry?.metrics?.map((m) => m.name) || []));
  };

  const collapseAllMetrics = () => {
    setExpandedMetrics(new Set());
  };

  const expandAllSpans = () => {
    setExpandedSpans(new Set(currentTelemetry?.spans?.map((_, i) => i.toString()) || []));
  };

  const collapseAllSpans = () => {
    setExpandedSpans(new Set());
  };

  const toggleMetric = (name: string) => {
    setExpandedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleSpan = (index: string) => {
    setExpandedSpans((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

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

      <div className={hasBothMetricsAndSpans ? "grid grid-cols-1 gap-8 lg:grid-cols-2" : ""}>
        {/* Metrics Section */}
        {hasMetrics && (
          <div className="space-y-6">
            <SectionDivider className="mb-0">Metrics</SectionDivider>
            <div className="mt-4 flex justify-center">
              <div className="border-border/50 bg-muted/80 inline-flex items-center rounded-xl border p-1 shadow-sm backdrop-blur-sm">
                <button
                  type="button"
                  onClick={expandAllMetrics}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 ${expandedMetrics.size === (currentTelemetry.metrics?.length || 0)
                    ? "border-secondary/40 bg-secondary/12 text-secondary border shadow-sm"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                >
                  <Maximize2 className="h-3 w-3" />
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAllMetrics}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 ${expandedMetrics.size === 0
                    ? "border-secondary/40 bg-secondary/12 text-secondary border shadow-sm"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                >
                  <Minimize2 className="h-3 w-3" />
                  Collapse All
                </button>
              </div>
            </div>

            <div className={hasBothMetricsAndSpans ? "space-y-4" : "mx-auto max-w-3xl space-y-4"}>
              {currentTelemetry.metrics &&
                currentTelemetry.metrics.map((metric) => {
                  const isExpanded = expandedMetrics.has(metric.name);
                  return (
                    <div
                      key={metric.name}
                      className="border-border/30 bg-card/30 rounded-2xl border transition-all duration-200"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleMetric(metric.name)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleMetric(metric.name);
                          }
                        }}
                        className="flex cursor-pointer items-center justify-between gap-4 p-4 transition-colors hover:bg-white/[0.02] sm:px-6 sm:py-5"
                      >
                        <code className="text-foreground min-w-0 flex-1 font-mono text-sm font-semibold break-all sm:text-base">
                          {metric.name}
                        </code>
                        <div className="flex shrink-0 items-center gap-3">
                          <GlowBadge
                            variant="success"
                            withGlow
                            className="py-0.5 text-[9px]"
                          >
                            {metric.instrument}
                          </GlowBadge>
                          {isExpanded ? (
                            <ChevronUp className="text-muted-foreground/50 h-4 w-4 transition-transform duration-200" />
                          ) : (
                            <ChevronDown className="text-muted-foreground/50 h-4 w-4 transition-transform duration-200" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-border/20 border-t p-4 pt-6 sm:p-6 sm:pt-8 md:p-10 md:pt-10">
                          <div className="space-y-6">
                            {/* Description */}
                            <p className="text-foreground/80 text-base leading-relaxed md:text-base">
                              {metric.description}
                            </p>

                            {/* Unit section with border */}
                            <div className="border-border/30 flex items-center gap-3 border-b pb-6">
                              <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                                Unit
                              </span>
                              <code className="border-border/30 text-foreground/80 rounded border bg-white/[0.03] px-2 py-1 text-sm">
                                {metric.unit}
                              </code>
                            </div>

                            {/* Attributes section */}
                            {metric.attributes && metric.attributes.length > 0 && (
                              <div className="space-y-4">
                                <h4 className="text-muted-foreground text-xs font-black tracking-[0.2em] uppercase">
                                  Attributes
                                </h4>
                                <AttributeTable attributes={metric.attributes} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Spans Section */}
        {hasSpans && (
          <div className="space-y-6">
            <SectionDivider className="mb-0">Spans</SectionDivider>
            <div className="mt-4 flex justify-center">
              <div className="border-border/50 bg-muted/80 inline-flex items-center rounded-xl border p-1 shadow-sm backdrop-blur-sm">
                <button
                  type="button"
                  onClick={expandAllSpans}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 ${expandedSpans.size === (currentTelemetry.spans?.length || 0)
                    ? "border-secondary/40 bg-secondary/12 text-secondary border shadow-sm"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                >
                  <Maximize2 className="h-3 w-3" />
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAllSpans}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 ${expandedSpans.size === 0
                    ? "border-secondary/40 bg-secondary/12 text-secondary border shadow-sm"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                >
                  <Minimize2 className="h-3 w-3" />
                  Collapse All
                </button>
              </div>
            </div>

            <div className={hasBothMetricsAndSpans ? "space-y-4" : "mx-auto max-w-3xl space-y-4"}>
              {currentTelemetry.spans &&
                currentTelemetry.spans.map((span, index) => {
                  const isExpanded = expandedSpans.has(index.toString());
                  return (
                    <div
                      key={`${span.span_kind}-${index}`}
                      className="border-border/30 bg-card/30 rounded-2xl border transition-all duration-200"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleSpan(index.toString())}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleSpan(index.toString());
                          }
                        }}
                        className="flex cursor-pointer items-center justify-between gap-4 p-4 transition-colors hover:bg-white/[0.02] sm:px-6 sm:py-5"
                      >
                        <h3 className="text-foreground flex-1 text-sm font-bold sm:text-base md:text-lg">
                          {span.span_kind} Span
                        </h3>
                        <div className="flex flex-shrink-0 items-center gap-3">
                          <GlowBadge
                            variant="info"
                            withGlow
                            className="py-0.5 text-[9px]"
                          >
                            {span.span_kind}
                          </GlowBadge>
                          {isExpanded ? (
                            <ChevronUp className="text-muted-foreground/50 h-4 w-4 transition-transform duration-200" />
                          ) : (
                            <ChevronDown className="text-muted-foreground/50 h-4 w-4 transition-transform duration-200" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-border/20 border-t p-4 pt-6 sm:p-6 sm:pt-8 md:p-10 md:pt-10">
                          <div className="space-y-6">
                            {/* Attributes section */}
                            {span.attributes && span.attributes.length > 0 && (
                              <div className="space-y-4">
                                <h4 className="text-muted-foreground text-xs font-black tracking-[0.2em] uppercase">
                                  Attributes
                                </h4>
                                <AttributeTable attributes={span.attributes} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!hasMetrics && !hasSpans && (
        <div className="flex min-h-[200px] items-center justify-center">
          <p className="text-muted-foreground text-sm">
            No metrics or spans defined for this configuration.
          </p>
        </div>
      )}
    </div>
  );
}
