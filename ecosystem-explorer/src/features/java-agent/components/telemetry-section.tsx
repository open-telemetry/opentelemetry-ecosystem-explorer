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
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";
import { SectionDivider } from "@/components/ui/section-divider";
import { GlowBadge } from "@/components/ui/glow-badge";
import { AttributeTable } from "./attribute-table";
import { ConfigurationSelector } from "./configuration-selector";
import type { Telemetry } from "@/types/javaagent";

interface TelemetrySectionProps {
  telemetry: Telemetry[];
}

interface ExpandCollapseToggleProps {
  expandedCount: number;
  totalCount: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

function ExpandCollapseToggle({
  expandedCount,
  totalCount,
  onExpandAll,
  onCollapseAll,
}: ExpandCollapseToggleProps) {
  const { t } = useTranslation("java-agent");
  return (
    <div className="mt-4 flex justify-center">
      <div className="border-border/50 bg-muted/80 inline-flex items-center rounded-xl border p-1 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={onExpandAll}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 ${
            expandedCount === totalCount && totalCount > 0
              ? "border-secondary/40 bg-secondary/12 text-secondary border shadow-sm"
              : "text-muted-foreground hover:text-foreground border border-transparent"
          }`}
        >
          <Maximize2 className="h-3 w-3" />
          {t("telemetrySection.expandAll")}
        </button>
        <button
          type="button"
          onClick={onCollapseAll}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 ${
            expandedCount === 0
              ? "border-secondary/40 bg-secondary/12 text-secondary border shadow-sm"
              : "text-muted-foreground hover:text-foreground border border-transparent"
          }`}
        >
          <Minimize2 className="h-3 w-3" />
          {t("telemetrySection.collapseAll")}
        </button>
      </div>
    </div>
  );
}

export function TelemetrySection({ telemetry }: TelemetrySectionProps) {
  const { t } = useTranslation("java-agent");
  const [selectedWhen, setSelectedWhen] = useState(telemetry[0]?.when ?? "default");

  // Validate selected value and fall back to first option if invalid
  const isCurrentSelectionValid = telemetry.some((t) => t.when === selectedWhen);
  const effectiveSelectedWhen = isCurrentSelectionValid
    ? selectedWhen
    : (telemetry[0]?.when ?? "default");

  const currentTelemetry = telemetry.find((t) => t.when === effectiveSelectedWhen) ?? telemetry[0];

  const getExpandedMetricIds = (current: Telemetry | undefined) =>
    new Set(current?.metrics?.map((_, i) => i.toString()) || []);

  const getExpandedSpanIds = (current: Telemetry | undefined) =>
    new Set(current?.spans?.map((span, i) => `${span.span_kind}-${i}`) || []);

  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(
    getExpandedMetricIds(currentTelemetry)
  );
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(
    getExpandedSpanIds(currentTelemetry)
  );

  // Synchronize expanded state when telemetry changes without using useEffect
  const [prevTelemetry, setPrevTelemetry] = useState(currentTelemetry);
  if (currentTelemetry !== prevTelemetry) {
    setPrevTelemetry(currentTelemetry);
    setExpandedMetrics(getExpandedMetricIds(currentTelemetry));
    setExpandedSpans(getExpandedSpanIds(currentTelemetry));
  }

  const expandAllMetrics = () => {
    setExpandedMetrics(getExpandedMetricIds(currentTelemetry));
  };

  const collapseAllMetrics = () => {
    setExpandedMetrics(new Set());
  };

  const expandAllSpans = () => {
    setExpandedSpans(getExpandedSpanIds(currentTelemetry));
  };

  const collapseAllSpans = () => {
    setExpandedSpans(new Set());
  };

  const toggleMetric = (id: string) => {
    setExpandedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSpan = (id: string) => {
    setExpandedSpans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
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
            <SectionDivider className="mb-0">{t("telemetrySection.metrics")}</SectionDivider>
            <ExpandCollapseToggle
              expandedCount={expandedMetrics.size}
              totalCount={currentTelemetry.metrics?.length || 0}
              onExpandAll={expandAllMetrics}
              onCollapseAll={collapseAllMetrics}
            />

            <div className={hasBothMetricsAndSpans ? "space-y-4" : "mx-auto max-w-3xl space-y-4"}>
              {currentTelemetry.metrics &&
                currentTelemetry.metrics.map((metric, index) => {
                  const metricId = index.toString();
                  const isExpanded = expandedMetrics.has(metricId);
                  return (
                    <div
                      key={`${metric.name}-${index}`}
                      className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                        isExpanded
                          ? "border-primary/20 bg-surface-card shadow-md"
                          : "border-border/40 bg-surface-card hover:border-border/60 shadow-sm"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleMetric(metricId)}
                        aria-expanded={isExpanded}
                        className={`hover:bg-muted/30 flex w-full cursor-pointer items-center justify-between gap-4 p-4 transition-colors sm:px-6 sm:py-5 ${
                          isExpanded ? "border-border/40 bg-muted/20 border-b" : ""
                        }`}
                      >
                        <code className="text-foreground min-w-0 flex-1 text-left font-mono text-sm font-semibold break-all sm:text-base">
                          {metric.name}
                        </code>
                        <div className="flex shrink-0 items-center gap-3">
                          <GlowBadge variant="success" withGlow className="py-0.5 text-[9px]">
                            {metric.instrument}
                          </GlowBadge>
                          {isExpanded ? (
                            <ChevronUp className="text-muted-foreground/50 h-4 w-4 transition-transform duration-200" />
                          ) : (
                            <ChevronDown className="text-muted-foreground/50 h-4 w-4 transition-transform duration-200" />
                          )}
                        </div>
                      </button>

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
                                {t("telemetrySection.unit")}
                              </span>
                              <code className="border-border/30 text-foreground/80 bg-muted/40 rounded border px-2 py-1 text-sm">
                                {metric.unit}
                              </code>
                            </div>

                            {/* Attributes section */}
                            {metric.attributes && metric.attributes.length > 0 && (
                              <div className="space-y-4">
                                <h4 className="text-muted-foreground text-xs font-black tracking-[0.2em] uppercase">
                                  {t("telemetrySection.attributes")}
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
            <SectionDivider className="mb-0">{t("telemetrySection.spans")}</SectionDivider>
            <ExpandCollapseToggle
              expandedCount={expandedSpans.size}
              totalCount={currentTelemetry.spans?.length || 0}
              onExpandAll={expandAllSpans}
              onCollapseAll={collapseAllSpans}
            />

            <div className={hasBothMetricsAndSpans ? "space-y-4" : "mx-auto max-w-3xl space-y-4"}>
              {currentTelemetry.spans &&
                currentTelemetry.spans.map((span, index) => {
                  const spanId = `${span.span_kind}-${index}`;
                  const isExpanded = expandedSpans.has(spanId);
                  return (
                    <div
                      key={spanId}
                      className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                        isExpanded
                          ? "border-primary/20 bg-surface-card shadow-md"
                          : "border-border/40 bg-surface-card hover:border-border/60 shadow-sm"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSpan(spanId)}
                        aria-expanded={isExpanded}
                        className={`hover:bg-muted/30 flex w-full cursor-pointer items-center justify-between gap-4 p-4 transition-colors sm:px-6 sm:py-5 ${
                          isExpanded ? "border-border/40 bg-muted/20 border-b" : ""
                        }`}
                      >
                        <h3 className="text-foreground flex-1 text-left text-sm font-bold sm:text-base md:text-lg">
                          {t("telemetrySection.spanTitle", { kind: span.span_kind })}
                        </h3>
                        <div className="flex flex-shrink-0 items-center gap-3">
                          <GlowBadge variant="info" withGlow className="py-0.5 text-[9px]">
                            {span.span_kind}
                          </GlowBadge>
                          {isExpanded ? (
                            <ChevronUp className="text-muted-foreground/50 h-4 w-4 transition-transform duration-200" />
                          ) : (
                            <ChevronDown className="text-muted-foreground/50 h-4 w-4 transition-transform duration-200" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-border/20 border-t p-4 pt-6 sm:p-6 sm:pt-8 md:p-10 md:pt-10">
                          <div className="space-y-6">
                            {/* Attributes section */}
                            {span.attributes && span.attributes.length > 0 && (
                              <div className="space-y-4">
                                <h4 className="text-muted-foreground text-xs font-black tracking-[0.2em] uppercase">
                                  {t("telemetrySection.attributes")}
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
          <p className="text-muted-foreground text-sm">{t("telemetrySection.empty")}</p>
        </div>
      )}
    </div>
  );
}
