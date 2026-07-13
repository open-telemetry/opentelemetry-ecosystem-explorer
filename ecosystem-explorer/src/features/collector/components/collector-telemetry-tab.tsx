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
import type { CollectorMetric, CollectorAttribute } from "@/types/collector";

interface CollectorTelemetryTabProps {
  metrics: Record<string, CollectorMetric>;
  attributes?: Record<string, CollectorAttribute>;
  resourceAttributes?: Record<string, CollectorAttribute>;
}

function getMetricType(metric: CollectorMetric): "sum" | "gauge" | "histogram" | null {
  if (metric.sum) return "sum";
  if (metric.gauge) return "gauge";
  if (metric.histogram) return "histogram";
  return null;
}

function getStabilityVariant(
  stability: string | undefined
): "success" | "info" | "warning" | "muted" {
  if (!stability) return "muted";
  const lower = stability.toLowerCase();
  if (lower === "stable") return "success";
  if (lower === "beta") return "info";
  if (
    lower === "alpha" ||
    lower === "development" ||
    lower === "deprecated" ||
    lower === "unmaintained"
  )
    return "warning";
  return "muted";
}

export function CollectorTelemetryTab({
  metrics,
  attributes,
  resourceAttributes,
}: CollectorTelemetryTabProps) {
  const { t } = useTranslation("collector");
  const metricEntries = Object.entries(metrics).sort(([a], [b]) => a.localeCompare(b));
  const totalCount = metricEntries.length;

  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(
    () => new Set(metricEntries.map(([name]) => name))
  );

  // Synchronize expanded state when metrics prop changes without using useEffect
  const [prevMetrics, setPrevMetrics] = useState(metrics);
  if (metrics !== prevMetrics) {
    setPrevMetrics(metrics);
    setExpandedMetrics(new Set(metricEntries.map(([name]) => name)));
  }

  const expandAll = () => setExpandedMetrics(new Set(metricEntries.map(([name]) => name)));
  const collapseAll = () => setExpandedMetrics(new Set());

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

  if (totalCount === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground text-sm">{t("detail.telemetryTab.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionDivider className="mb-0">{t("detail.telemetryTab.metricsHeader")}</SectionDivider>

      {/* Expand / Collapse toggle */}
      <div className="mt-4 flex justify-center">
        <div className="border-border/50 bg-muted/80 inline-flex items-center rounded-xl border p-1 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            aria-pressed={expandedMetrics.size === totalCount && totalCount > 0}
            onClick={expandAll}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 ${
              expandedMetrics.size === totalCount && totalCount > 0
                ? "border-secondary/40 bg-secondary/12 text-secondary border shadow-sm"
                : "text-muted-foreground hover:text-foreground border border-transparent"
            }`}
          >
            <Maximize2 className="h-3 w-3" aria-hidden="true" />
            {t("detail.telemetryTab.expandAll")}
          </button>
          <button
            type="button"
            aria-pressed={expandedMetrics.size === 0}
            onClick={collapseAll}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all duration-200 ${
              expandedMetrics.size === 0
                ? "border-secondary/40 bg-secondary/12 text-secondary border shadow-sm"
                : "text-muted-foreground hover:text-foreground border border-transparent"
            }`}
          >
            <Minimize2 className="h-3 w-3" aria-hidden="true" />
            {t("detail.telemetryTab.collapseAll")}
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="mx-auto max-w-3xl space-y-4">
        {metricEntries.map(([metricName, metric]) => {
          const isExpanded = expandedMetrics.has(metricName);
          const metricType = getMetricType(metric);
          const stabilityVariant = getStabilityVariant(metric.stability);
          const resolvedAttributes = (metric.attributes ?? []).map((key) => ({
            key,
            definition: attributes?.[key] ?? resourceAttributes?.[key],
          }));

          return (
            <div
              key={metricName}
              className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                isExpanded
                  ? "border-primary/20 bg-surface-card shadow-md"
                  : "border-border/40 bg-surface-card hover:border-border/60 shadow-sm"
              }`}
            >
              {/* Card header — always visible */}
              <button
                type="button"
                onClick={() => toggleMetric(metricName)}
                aria-expanded={isExpanded}
                className={`hover:bg-muted/30 flex w-full cursor-pointer items-center justify-between gap-4 p-4 transition-colors sm:px-6 sm:py-5 ${
                  isExpanded ? "border-border/40 bg-muted/20 border-b" : ""
                }`}
              >
                <code className="text-foreground min-w-0 flex-1 text-left font-mono text-sm font-semibold break-all sm:text-base">
                  {metricName}
                </code>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {metricType && (
                    <GlowBadge variant="success" withGlow className="py-0.5 text-[9px]">
                      {t(`detail.telemetryTab.metricType.${metricType}`)}
                    </GlowBadge>
                  )}
                  {metric.stability && (
                    <GlowBadge variant={stabilityVariant} className="py-0.5 text-[9px]">
                      {metric.stability}
                    </GlowBadge>
                  )}
                  <GlowBadge
                    variant={metric.enabled ? "info" : "muted"}
                    className="py-0.5 text-[9px]"
                  >
                    {metric.enabled
                      ? t("detail.telemetryTab.enabled")
                      : t("detail.telemetryTab.disabled")}
                  </GlowBadge>
                  {isExpanded ? (
                    <ChevronUp
                      className="text-muted-foreground/50 h-4 w-4 transition-transform duration-200"
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronDown
                      className="text-muted-foreground/50 h-4 w-4 transition-transform duration-200"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-border/20 border-t p-4 pt-6 sm:p-6 sm:pt-8">
                  <div className="space-y-6">
                    {/* Description */}
                    <p className="text-foreground/80 text-base leading-relaxed">
                      {metric.description}
                    </p>

                    {/* Extended documentation */}
                    {metric.extended_documentation && (
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {metric.extended_documentation}
                      </p>
                    )}

                    {/* Unit */}
                    <div className="border-border/30 flex items-center gap-3 border-b pb-6">
                      <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                        {t("detail.telemetryTab.unit")}
                      </span>
                      <code className="border-border/30 text-foreground/80 bg-muted/40 rounded border px-2 py-1 text-sm">
                        {metric.unit || "1"}
                      </code>
                    </div>

                    {/* Aggregation info for sum */}
                    {metric.sum && (
                      <div className="space-y-2">
                        <h4 className="text-muted-foreground text-xs font-black tracking-[0.2em] uppercase">
                          {t("detail.telemetryTab.aggregation")}
                        </h4>
                        <div className="flex flex-wrap gap-3 text-sm">
                          {metric.sum.aggregation_temporality && (
                            <span className="border-border/30 bg-muted/40 rounded border px-2 py-1 text-xs font-medium capitalize">
                              {metric.sum.aggregation_temporality}
                            </span>
                          )}
                          <span className="border-border/30 bg-muted/40 rounded border px-2 py-1 text-xs font-medium">
                            {t("detail.telemetryTab.monotonic")}:{" "}
                            {metric.sum.monotonic ? "true" : "false"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Aggregation info for histogram */}
                    {metric.histogram && metric.histogram.bucket_boundaries && (
                      <div className="space-y-2">
                        <h4 className="text-muted-foreground text-xs font-black tracking-[0.2em] uppercase">
                          {t("detail.telemetryTab.aggregation")}
                        </h4>
                        <code className="border-border/30 bg-muted/40 text-foreground/80 block rounded border px-3 py-2 text-xs">
                          [{metric.histogram.bucket_boundaries.join(", ")}]
                        </code>
                      </div>
                    )}

                    {/* Attributes table */}
                    {resolvedAttributes.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-muted-foreground text-xs font-black tracking-[0.2em] uppercase">
                          {t("detail.telemetryTab.attributes")}
                        </h4>
                        <div className="border-border/30 overflow-x-auto rounded-lg border">
                          <table
                            aria-label={t("detail.telemetryTab.attributes")}
                            className="w-full min-w-[260px] border-collapse"
                          >
                            <thead>
                              <tr className="bg-muted/30">
                                <th
                                  scope="col"
                                  className="text-muted-foreground p-2 text-left text-[10px] font-bold tracking-widest uppercase sm:p-3"
                                >
                                  {t("detail.telemetryTab.table.key")}
                                </th>
                                <th
                                  scope="col"
                                  className="text-muted-foreground p-2 text-left text-[10px] font-bold tracking-widest uppercase sm:p-3"
                                >
                                  {t("detail.telemetryTab.table.type")}
                                </th>
                                <th
                                  scope="col"
                                  className="text-muted-foreground p-2 text-left text-[10px] font-bold tracking-widest uppercase sm:p-3"
                                >
                                  {t("detail.telemetryTab.table.description")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {resolvedAttributes.map(({ key, definition }, index) => (
                                <tr key={key} className={index % 2 === 1 ? "bg-muted/20" : ""}>
                                  <td className="p-2 font-mono text-xs sm:p-4 sm:text-sm">
                                    {definition?.name_override ?? key}
                                  </td>
                                  <td className="p-2 sm:p-4">
                                    {definition?.type ? (
                                      <span className="border-border/30 bg-card/80 text-muted-foreground inline-block w-fit rounded border px-2 py-1 text-xs font-bold tracking-wider uppercase">
                                        {definition.type}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">—</span>
                                    )}
                                  </td>
                                  <td className="text-muted-foreground p-2 text-xs sm:p-4">
                                    {definition?.description ?? "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
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
  );
}
