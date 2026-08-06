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
import { useMemo, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import type { InstrumentationModule } from "@/types/javaagent";
import type { CustomizationStatus } from "@/hooks/use-customization-status";
import { InstrumentationConfigForm } from "./instrumentation-config-form";
import { aggregateConfigurations } from "@/lib/configurations-aggregate";

export interface InstrumentationRowProps {
  module: InstrumentationModule;
  status: CustomizationStatus;
  isExpanded: boolean;
  onSetEnabled: (enabled: boolean) => void;
  onRemoveCustomization: () => void;
  onToggleExpand: () => void;
  onJumpToGeneral: (sectionKey: string) => void;
}

export function InstrumentationRow({
  module,
  status,
  isExpanded,
  onSetEnabled,
  onRemoveCustomization,
  onToggleExpand,
  onJumpToGeneral,
}: InstrumentationRowProps): JSX.Element {
  const { t } = useTranslation("java-agent");
  const isExplicitlyEnabled = status === "enabled";
  const isExplicitlyDisabled = status === "disabled";
  const enabledByDefault = !module.defaultDisabled;
  const isEnabled = isExplicitlyEnabled || (status === "none" && enabledByDefault);
  const configCount = useMemo(() => aggregateConfigurations(module).length, [module]);

  const description =
    module.coveredEntries[module.coveredEntries.length - 1]?.description ?? undefined;
  const dashedName = module.name.replace(/_/g, "-");
  const versionsCovered = module.coveredEntries
    .map((e) => e.name.replace(`${dashedName}-`, "").replace(dashedName, ""))
    .filter((s) => s !== "")
    .join(", ");

  const containerClass = isExpanded
    ? "border-primary/40 shadow-md bg-surface-card"
    : "border-border/60 shadow-sm bg-surface-card hover:border-border/80";

  const headerBgClass = isExplicitlyEnabled
    ? "bg-primary/5"
    : isExplicitlyDisabled
      ? "bg-red-500/5"
      : "bg-muted/20";

  return (
    <div
      data-testid={`instrumentation-row-${module.name}`}
      data-expanded={String(isExpanded)}
      data-yaml-section-key="distribution"
      className={`overflow-hidden rounded-xl border transition-all duration-200 ${containerClass}`}
    >
      {/* Header Region */}
      <div
        className={`border-border/40 flex cursor-pointer flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${headerBgClass}`}
        onClick={onToggleExpand}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h4 className="text-foreground font-mono text-sm font-bold">{module.name}</h4>
            {module.coveredEntries.length > 1 ? (
              <span className="border-border/60 bg-surface-card text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] leading-none shadow-sm">
                {t("builder.row.versions", { count: module.coveredEntries.length })}
              </span>
            ) : null}
            {module.coveredEntries.some((e) => e._is_custom === true) ? (
              <span className="border-border/60 bg-surface-card text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] leading-none shadow-sm">
                {t("builder.row.custom")}
              </span>
            ) : null}
          </div>
          {versionsCovered ? (
            <p className="text-muted-foreground/70 mt-1.5 truncate text-[11px]">
              {t("builder.row.covers", { versions: versionsCovered })}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          {configCount > 0 && (
            <span className="border-border/60 bg-muted/20 text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] leading-none shadow-sm">
              {t("builder.row.options", { count: configCount })}
            </span>
          )}
          <div className="flex flex-col items-end text-right">
            <span
              className={`text-sm font-bold ${isEnabled ? "text-emerald-500" : "text-muted-foreground"}`}
            >
              {isEnabled ? t("builder.row.enabled") : t("builder.row.disabled")}
            </span>
            {isEnabled !== enabledByDefault && (
              <span className="text-muted-foreground/70 text-[10px] font-medium">
                {enabledByDefault
                  ? t("builder.row.enabledByDefault")
                  : t("builder.row.disabledByDefault")}
              </span>
            )}
          </div>

          <button
            type="button"
            aria-label={t("builder.row.toggleDetailsTooltip", { name: module.name })}
            aria-expanded={isExpanded}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="text-muted-foreground/60 hover:bg-card-secondary hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          >
            <ChevronRight
              className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Description Area (collapsed) */}
      {!isExpanded && description ? (
        <div className="bg-surface-card px-4 py-3">
          <p className="text-muted-foreground truncate text-xs">{description}</p>
        </div>
      ) : null}

      {/* Expanded Body Region */}
      {isExpanded ? (
        <div
          className="bg-surface-card px-4 py-4 sm:px-5 sm:py-5"
          data-yaml-section-key="instrumentation/development"
        >
          <div className="border-border/40 mb-6 flex items-center justify-between border-b pb-4">
            <div>
              <h5 className="text-foreground text-sm font-semibold">
                {t("builder.row.statusHeader")}
              </h5>
              <p className="text-muted-foreground text-xs">{t("builder.row.statusDescription")}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <CustomizationToggle enabled={isEnabled} onChange={onSetEnabled} />
              {status !== "none" && (
                <button
                  type="button"
                  onClick={onRemoveCustomization}
                  className="text-muted-foreground text-[10px] transition-colors hover:underline"
                >
                  {t("builder.row.resetToDefault")}
                </button>
              )}
            </div>
          </div>
          {description ? (
            <p className="text-muted-foreground mb-6 text-sm leading-relaxed">{description}</p>
          ) : null}
          <InstrumentationConfigForm module={module} onJumpToGeneral={onJumpToGeneral} />
        </div>
      ) : null}
    </div>
  );
}

function CustomizationToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
}) {
  const { t } = useTranslation("java-agent");
  const onClass = "bg-emerald-500/20 text-emerald-300";
  const offClass = "bg-red-500/20 text-red-300";
  const baseClass = "px-2 py-1 text-[11px] leading-none";
  return (
    <div
      role="group"
      aria-label={t("builder.row.customizationState")}
      className="border-border/60 inline-flex overflow-hidden rounded-md border"
    >
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={enabled}
        className={`${baseClass} ${enabled ? onClass : "text-muted-foreground"}`}
      >
        {t("builder.row.enabled")}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={!enabled}
        className={`${baseClass} ${!enabled ? offClass : "text-muted-foreground"}`}
      >
        {t("builder.row.disabled")}
      </button>
    </div>
  );
}
