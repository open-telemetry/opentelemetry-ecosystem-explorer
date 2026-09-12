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

import { useTranslation } from "react-i18next";
import { GlowBadge } from "@/components/ui/glow-badge";
import type { CollectorMetricDiff } from "@/types/collector";
import { AttributeDiffList } from "./attribute-diff-list";

interface MetricDiffCardProps {
  diff: CollectorMetricDiff;
}

export function MetricDiffCard({ diff }: MetricDiffCardProps) {
  const { t } = useTranslation("collector");
  const { status, name, metric, changes } = diff;

  const statusVariant = status === "added" ? "success" : status === "removed" ? "error" : "warning";
  const statusLabel =
    status === "added"
      ? t("diffCard.status.added")
      : status === "removed"
        ? t("diffCard.status.removed")
        : t("diffCard.status.changed");

  return (
    <div className="border-border/30 bg-card/30 hover:bg-card-secondary rounded-2xl border p-6 transition-all duration-300 md:p-10">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <code className="text-foreground flex-1 font-mono text-lg font-semibold break-all">
            {name}
          </code>
          <GlowBadge variant={statusVariant} withGlow className="text-[10px]">
            {statusLabel}
          </GlowBadge>
        </div>

        {status !== "removed" && (
          <p className="text-foreground/80 text-base leading-relaxed">{metric.description}</p>
        )}

        {status === "changed" && changes?.description && (
          <div className="space-y-2">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {t("diffCard.descriptionChanged")}
            </span>
            <div className="border-border/30 space-y-1 rounded-lg border bg-black/[0.02] p-3 dark:bg-white/[0.03]">
              <p className="text-sm text-red-700 line-through opacity-60 dark:text-red-400">
                {changes.description.before}
              </p>
              <p className="text-sm text-green-700 dark:text-green-400">
                {changes.description.after}
              </p>
            </div>
          </div>
        )}

        {status !== "removed" && (
          <div className="border-border/30 flex flex-wrap items-center gap-3 border-b pb-6">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {t("diffCard.unit")}
            </span>
            <code className="border-border/30 text-foreground/80 rounded border bg-black/[0.02] px-2 py-1 text-sm dark:bg-white/[0.03]">
              {metric.unit || "1"}
            </code>
            {status === "changed" && changes?.unit && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">(was:</span>
                <code className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-sm text-red-700 line-through dark:text-red-400">
                  {changes.unit.before}
                </code>
                <span className="text-muted-foreground text-xs">)</span>
              </div>
            )}
          </div>
        )}

        {status === "changed" && changes?.enabled && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {t("diffCard.enabledChanged")}
            </span>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-red-700 line-through opacity-60 dark:text-red-400">
                {changes.enabled.before
                  ? t("diffCard.enabledValue.enabled")
                  : t("diffCard.enabledValue.disabled")}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-green-700 dark:text-green-400">
                {changes.enabled.after
                  ? t("diffCard.enabledValue.enabled")
                  : t("diffCard.enabledValue.disabled")}
              </span>
            </div>
          </div>
        )}

        {status === "changed" && changes?.stability && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {t("diffCard.stabilityChanged")}
            </span>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-red-700 line-through opacity-60 dark:text-red-400">
                {changes.stability.before ?? "—"}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-green-700 dark:text-green-400">
                {changes.stability.after ?? "—"}
              </span>
            </div>
          </div>
        )}

        {status === "changed" && changes?.metricType && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {t("diffCard.metricTypeChanged")}
            </span>
            <div className="flex items-center gap-2">
              <code className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-sm text-red-700 line-through dark:text-red-400">
                {changes.metricType.before ?? "—"}
              </code>
              <span className="text-muted-foreground">→</span>
              <code className="rounded border border-green-500/30 bg-green-500/10 px-2 py-1 text-sm text-green-700 dark:text-green-400">
                {changes.metricType.after ?? "—"}
              </code>
            </div>
          </div>
        )}

        {status === "changed" && changes?.attributes && (
          <div className="space-y-4">
            <h4 className="text-muted-foreground text-xs font-black tracking-[0.2em] uppercase">
              {t("diffCard.attributeChanges")}
            </h4>
            <AttributeDiffList changes={changes.attributes} />
          </div>
        )}

        {status === "removed" && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{t("diffCard.metricRemoved")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
