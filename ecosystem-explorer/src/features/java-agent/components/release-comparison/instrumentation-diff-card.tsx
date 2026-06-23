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
import { ChevronDown, ChevronUp, Plus, Minus, RefreshCcw, ExternalLink } from "lucide-react";
import type { InstrumentationDiff } from "../../utils/release-diff";
import { DiffResultsSection } from "../telemetry-comparison/diff-results-section";
import { GlowBadge } from "@/components/ui/glow-badge";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/tooltip";

const STATUS_CONFIG: Record<
  InstrumentationDiff["status"],
  { className: string; icon: React.ReactNode }
> = {
  added: {
    className: "border-green-400/30 bg-green-400/10 text-green-400",
    icon: <Plus className="h-4 w-4" />,
  },
  removed: {
    className: "border-red-400/30 bg-red-400/10 text-red-400",
    icon: <Minus className="h-4 w-4" />,
  },
  changed: {
    className: "border-blue-400/30 bg-blue-400/10 text-blue-400",
    icon: <RefreshCcw className="h-4 w-4" />,
  },
  unchanged: {
    className: "border-border/50 bg-muted/20 text-muted-foreground",
    icon: <div className="h-2 w-2 rounded-full bg-current" />,
  },
};

interface InstrumentationDiffCardProps {
  diff: InstrumentationDiff;
}

export function InstrumentationDiffCard({ diff }: InstrumentationDiffCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const changedMetricsCount = diff.telemetryDiff.metrics.filter(
    (m) => m.status !== "unchanged"
  ).length;
  const changedSpansCount = diff.telemetryDiff.spans.filter((s) => s.status !== "unchanged").length;
  const configChangesCount =
    (diff.configDiff?.added.length || 0) +
    (diff.configDiff?.removed.length || 0) +
    (diff.configDiff?.changed.length || 0);

  const statusInfo = STATUS_CONFIG[diff.status];
  const { t } = useTranslation("java-agent");

  const tooltipContent =
    diff.status === "added"
      ? t("diffCard.moduleAddedTooltip")
      : diff.status === "removed"
        ? t("diffCard.moduleRemovedTooltip")
        : t("diffCard.moduleChangedTooltip");

  return (
    <div className="border-border/30 bg-card/20 overflow-hidden rounded-xl border transition-all duration-200">
      <div className="hover:bg-muted/50 flex w-full items-center justify-between p-4 text-left transition-colors">
        <div className="flex items-center gap-4">
          <Tooltip content={tooltipContent} side="top">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg border ${statusInfo.className}`}
            >
              {statusInfo.icon}
            </div>
          </Tooltip>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{diff.displayName}</h3>
              <Link
                to={`/java-agent/instrumentation/${diff.id}`}
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label={t("diffCard.viewInstrumentation")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="text-muted-foreground text-xs">{diff.id}</p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={t("diffCard.expandAriaLabel", { name: diff.displayName })}
          className="focus-visible:ring-primary hover:bg-muted/50 flex cursor-pointer items-center gap-6 rounded-md p-2 outline-none focus-visible:ring-2"
        >
          <div className="flex items-center gap-2">
            {changedMetricsCount > 0 && (
              <GlowBadge variant="success">
                {t("diffCard.metricCount", { count: changedMetricsCount })}
              </GlowBadge>
            )}
            {changedSpansCount > 0 && (
              <GlowBadge variant="info">
                {t("diffCard.spanCount", { count: changedSpansCount })}
              </GlowBadge>
            )}
            {configChangesCount > 0 && (
              <GlowBadge variant="warning">
                {t("diffCard.configCount", { count: configChangesCount })}
              </GlowBadge>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="text-muted-foreground h-5 w-5" />
          ) : (
            <ChevronDown className="text-muted-foreground h-5 w-5" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="border-border/30 animate-in fade-in slide-in-from-top-2 space-y-8 border-t p-6 duration-200">
          {configChangesCount > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <div className="to-border h-px w-16 bg-gradient-to-r from-transparent" />
                <span className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
                  {t("diffCard.configurationChanges")}
                </span>
                <div className="to-border h-px w-16 bg-gradient-to-l from-transparent" />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {diff.configDiff?.added.map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 rounded-lg border border-green-400/20 bg-green-400/5 p-3"
                  >
                    <Plus className="h-4 w-4 text-green-400" />
                    <code className="text-foreground/90 font-mono text-xs">{name}</code>
                  </div>
                ))}
                {diff.configDiff?.changed.map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 rounded-lg border border-blue-400/20 bg-blue-400/5 p-3"
                  >
                    <RefreshCcw className="h-4 w-4 text-blue-400" />
                    <code className="text-foreground/90 font-mono text-xs">{name}</code>
                  </div>
                ))}
                {diff.configDiff?.removed.map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/5 p-3"
                  >
                    <Minus className="h-4 w-4 text-red-400" />
                    <code className="text-foreground/90 font-mono text-xs">{name}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DiffResultsSection diffResult={diff.telemetryDiff} />
        </div>
      )}
    </div>
  );
}
