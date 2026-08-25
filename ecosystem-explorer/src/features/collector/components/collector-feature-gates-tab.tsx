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
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { GlowBadge } from "@/components/ui/glow-badge";
import type { FeatureGate, Stability } from "@/types/collector";

interface CollectorFeatureGatesTabProps {
  featureGates: FeatureGate[];
}

function getStageVariant(stage: Stability): "success" | "info" | "warning" | "muted" {
  const lower = stage.toLowerCase();
  if (lower === "stable") return "success";
  if (lower === "beta") return "info";
  if (
    lower === "alpha" ||
    lower === "development" ||
    lower === "deprecated" ||
    lower === "unmaintained"
  ) {
    return "warning";
  }
  return "muted";
}

export function CollectorFeatureGatesTab({ featureGates }: CollectorFeatureGatesTabProps) {
  const { t } = useTranslation("collector");
  const [expandedGates, setExpandedGates] = useState<Set<string>>(
    () => new Set(featureGates.map((gate) => gate.id))
  );

  const toggleGate = (id: string) => {
    setExpandedGates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {featureGates.map((gate) => {
        const isExpanded = expandedGates.has(gate.id);

        return (
          <div
            key={gate.id}
            className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
              isExpanded
                ? "border-primary/20 bg-surface-card shadow-md"
                : "border-border/40 bg-surface-card hover:border-border/60 shadow-sm"
            }`}
          >
            <button
              type="button"
              onClick={() => toggleGate(gate.id)}
              aria-expanded={isExpanded}
              className={`hover:bg-muted/30 flex w-full cursor-pointer items-center justify-between gap-4 p-4 transition-colors sm:px-6 sm:py-5 ${
                isExpanded ? "border-border/40 bg-muted/20 border-b" : ""
              }`}
            >
              <code className="text-foreground min-w-0 flex-1 text-left font-mono text-sm font-semibold break-all sm:text-base">
                {gate.id}
              </code>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <GlowBadge
                  variant={getStageVariant(gate.stage)}
                  className="py-0.5 text-[9px] capitalize"
                >
                  {t(`detail.stabilityLabels.${gate.stage.toLowerCase()}`, {
                    defaultValue: gate.stage,
                  })}
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

            {isExpanded && (
              <div className="border-border/20 border-t p-4 pt-6 sm:p-6 sm:pt-8">
                <div className="space-y-4">
                  {gate.description && (
                    <p className="text-foreground/80 text-base leading-relaxed">
                      {gate.description}
                    </p>
                  )}

                  {(gate.from_version || gate.to_version) && (
                    <div className="flex flex-wrap gap-3 text-sm">
                      {gate.from_version && (
                        <span className="border-border/30 bg-muted/40 rounded border px-2 py-1 text-xs font-medium">
                          {t("detail.featureGatesTab.introducedIn", { version: gate.from_version })}
                        </span>
                      )}
                      {gate.to_version && (
                        <span className="border-border/30 bg-muted/40 rounded border px-2 py-1 text-xs font-medium">
                          {t(
                            gate.stage === "deprecated"
                              ? "detail.featureGatesTab.deprecatedIn"
                              : "detail.featureGatesTab.stableIn",
                            { version: gate.to_version }
                          )}
                        </span>
                      )}
                    </div>
                  )}

                  {gate.reference_url && /^https?:\/\//i.test(gate.reference_url) && (
                    <a
                      href={gate.reference_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
                    >
                      {t("detail.featureGatesTab.reference")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
