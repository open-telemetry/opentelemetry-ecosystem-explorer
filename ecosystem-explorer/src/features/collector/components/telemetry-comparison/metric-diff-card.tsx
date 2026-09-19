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

import { Trans, useTranslation } from "react-i18next";
import { GlowBadge } from "@/components/ui/glow-badge";
import type { CollectorMetricDiff, CollectorMetricWarnings } from "@/types/collector";
import { AttributeDiffList } from "./attribute-diff-list";

interface MetricDiffCardProps {
  diff: CollectorMetricDiff;
}

/** Translation label keys for the warning fields currently modeled in CollectorMetricWarnings. */
const KNOWN_WARNING_LABEL_KEYS: Record<keyof CollectorMetricWarnings, string> = {
  if_enabled: "ifEnabled",
  if_enabled_not_set: "ifEnabledNotSet",
  if_configured: "ifConfigured",
};

/**
 * Readable fallback label for a warning key the frontend type doesn't model yet (e.g. one
 * introduced upstream after this file was last updated), so it renders as "Some new key"
 * rather than being silently dropped.
 */
function formatUnknownWarningKey(key: string): string {
  const [first, ...rest] = key.split("_").filter(Boolean);
  if (!first) return key;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
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

        {status === "changed" && changes?.extendedDocumentation && (
          <div className="space-y-2">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {t("diffCard.extendedDocumentationChanged")}
            </span>
            <div className="border-border/30 space-y-1 rounded-lg border bg-black/[0.02] p-3 dark:bg-white/[0.03]">
              <p className="text-sm text-red-700 line-through opacity-60 dark:text-red-400">
                {changes.extendedDocumentation.before ?? "—"}
              </p>
              <p className="text-sm text-green-700 dark:text-green-400">
                {changes.extendedDocumentation.after ?? "—"}
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
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Trans
                  i18nKey="diffCard.unitWas"
                  ns="collector"
                  values={{ unit: changes.unit.before }}
                  components={{
                    unit: (
                      <code className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-sm text-red-700 line-through dark:text-red-400" />
                    ),
                  }}
                />
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

        {status === "changed" && changes?.optional && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {t("diffCard.optionalChanged")}
            </span>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-red-700 line-through opacity-60 dark:text-red-400">
                {changes.optional.before
                  ? t("diffCard.optionalValue.yes")
                  : t("diffCard.optionalValue.no")}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-green-700 dark:text-green-400">
                {changes.optional.after
                  ? t("diffCard.optionalValue.yes")
                  : t("diffCard.optionalValue.no")}
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

        {status === "changed" && changes?.deprecated && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {t("diffCard.deprecatedChanged")}
            </span>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-red-700 line-through opacity-60 dark:text-red-400">
                {changes.deprecated.before
                  ? (changes.deprecated.before.note ?? t("diffCard.deprecatedValue.deprecated"))
                  : t("diffCard.deprecatedValue.notDeprecated")}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-green-700 dark:text-green-400">
                {changes.deprecated.after
                  ? (changes.deprecated.after.note ?? t("diffCard.deprecatedValue.deprecated"))
                  : t("diffCard.deprecatedValue.notDeprecated")}
              </span>
            </div>
          </div>
        )}

        {status === "changed" && changes?.warnings && (
          <div className="space-y-2">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {t("diffCard.warningsChanged")}
            </span>
            <div className="space-y-2">
              {(() => {
                // Render every key actually present in the diff, not just the three fields
                // this frontend currently models -- telemetry-diff.ts's warningsEqual()
                // compares the full union of keys, so an upstream warning field this type
                // doesn't declare yet must still be visible here, not just "Warnings changed".
                const before = (changes.warnings?.before ?? {}) as Record<
                  string,
                  string | undefined
                >;
                const after = (changes.warnings?.after ?? {}) as Record<string, string | undefined>;
                const fields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
                return fields.map((field) => {
                  const beforeValue = before[field];
                  const afterValue = after[field];
                  if (beforeValue === afterValue) return null;
                  const labelKey = (KNOWN_WARNING_LABEL_KEYS as Record<string, string | undefined>)[
                    field
                  ];
                  const label = labelKey
                    ? t(`diffCard.warningsFields.${labelKey}`)
                    : formatUnknownWarningKey(field);
                  return (
                    <div key={field} className="space-y-1">
                      <span className="text-muted-foreground text-xs">{label}:</span>
                      <div className="border-border/30 space-y-1 rounded-lg border bg-black/[0.02] p-3 dark:bg-white/[0.03]">
                        <p className="text-sm text-red-700 line-through opacity-60 dark:text-red-400">
                          {beforeValue ?? "—"}
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-400">
                          {afterValue ?? "—"}
                        </p>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {status === "changed" && changes?.prefix && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {t("diffCard.prefixChanged")}
            </span>
            <div className="flex items-center gap-2">
              <code className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-sm text-red-700 line-through dark:text-red-400">
                {changes.prefix.before ?? "—"}
              </code>
              <span className="text-muted-foreground">→</span>
              <code className="rounded border border-green-500/30 bg-green-500/10 px-2 py-1 text-sm text-green-700 dark:text-green-400">
                {changes.prefix.after ?? "—"}
              </code>
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

        {status === "changed" && changes?.descriptor && (
          <div className="space-y-2">
            <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              {t("diffCard.descriptorChanged")}
            </span>
            <div className="space-y-2">
              {(
                [
                  ["value_type", "valueType"],
                  ["monotonic", "monotonic"],
                  ["aggregation_temporality", "aggregationTemporality"],
                  ["async", "async"],
                  ["bucket_boundaries", "bucketBoundaries"],
                ] as const
              ).map(([field, labelKey]) => {
                const fieldChange = changes.descriptor?.[field];
                if (!fieldChange) return null;
                const format = (value: unknown) =>
                  value === undefined
                    ? "—"
                    : Array.isArray(value)
                      ? `[${value.join(", ")}]`
                      : String(value);
                return (
                  <div key={field} className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {t(`diffCard.descriptorFields.${labelKey}`)}:
                    </span>
                    <code className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-sm text-red-700 line-through dark:text-red-400">
                      {format(fieldChange.before)}
                    </code>
                    <span className="text-muted-foreground">→</span>
                    <code className="rounded border border-green-500/30 bg-green-500/10 px-2 py-1 text-sm text-green-700 dark:text-green-400">
                      {format(fieldChange.after)}
                    </code>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {status === "changed" &&
          changes?.attributes &&
          (changes.attributes.added.length > 0 ||
            changes.attributes.removed.length > 0 ||
            changes.attributes.changed.length > 0) && (
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
