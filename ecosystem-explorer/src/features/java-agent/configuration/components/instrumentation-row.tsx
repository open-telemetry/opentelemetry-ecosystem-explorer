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
import type { JSX } from "react";
import { ChevronRight, Plus, X } from "lucide-react";
import type { InstrumentationModule } from "@/types/javaagent";
import type { OverrideStatus } from "@/hooks/use-override-status";

export interface InstrumentationRowProps {
  module: InstrumentationModule;
  status: OverrideStatus;
  onAddOverride: () => void;
  onSetEnabled: (enabled: boolean) => void;
  onRemoveOverride: () => void;
}

export function InstrumentationRow({
  module,
  status,
  onAddOverride,
  onSetEnabled,
  onRemoveOverride,
}: InstrumentationRowProps): JSX.Element {
  const isOverridden = status !== "none";
  const overrideEnabled = status === "enabled";
  const enabledByDefault = !module.defaultDisabled;

  const description =
    module.coveredEntries[module.coveredEntries.length - 1]?.description ?? undefined;
  const dashedName = module.name.replace(/_/g, "-");
  const versionsCovered = module.coveredEntries
    .map((e) => e.name.replace(`${dashedName}-`, "").replace(dashedName, ""))
    .filter((s) => s !== "")
    .join(", ");

  const containerClass = isOverridden
    ? overrideEnabled
      ? "border-primary/40 bg-primary/5"
      : "border-red-500/40 bg-red-500/5"
    : "border-border/60 bg-background/30 hover:bg-background/50";

  return (
    <div
      data-testid={`instrumentation-row-${module.name}`}
      className={`flex flex-col gap-2 rounded-md border px-3 py-2 transition-colors sm:flex-row sm:items-center sm:gap-3 ${containerClass}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-foreground font-mono text-sm font-medium">{module.name}</span>
          {module.coveredEntries.length > 1 ? (
            <span className="border-border/60 text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] leading-none">
              {module.coveredEntries.length} versions
            </span>
          ) : null}
          {module.coveredEntries.some((e) => e._is_custom === true) ? (
            <span className="border-border/60 text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] leading-none">
              custom
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{description}</p>
        ) : null}
        {versionsCovered ? (
          <p className="text-muted-foreground/70 mt-0.5 truncate text-[11px]">
            covers {versionsCovered}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 sm:contents">
        {isOverridden ? (
          <OverrideToggle enabled={overrideEnabled} onChange={onSetEnabled} />
        ) : (
          <DefaultPill enabledByDefault={enabledByDefault} />
        )}

        {isOverridden ? (
          <button
            type="button"
            aria-label={`Remove override for ${module.name}`}
            onClick={onRemoveOverride}
            className="text-muted-foreground hover:text-foreground rounded-md p-1"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onAddOverride}
            aria-label={`Override ${module.name}`}
            className="border-border/60 text-foreground hover:bg-card/80 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Override
          </button>
        )}

        <span
          aria-hidden="true"
          className="text-muted-foreground/60 hidden h-5 w-5 items-center justify-center sm:inline-flex"
        >
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function DefaultPill({ enabledByDefault }: { enabledByDefault: boolean }) {
  if (enabledByDefault) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] leading-none text-emerald-300">
        enabled by default
      </span>
    );
  }
  return (
    <span className="border-border/60 text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] leading-none">
      disabled by default
    </span>
  );
}

function OverrideToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
}) {
  const onClass = "bg-emerald-500/20 text-emerald-300";
  const offClass = "bg-red-500/20 text-red-300";
  const baseClass = "px-2 py-1 text-[11px] leading-none";
  return (
    <div
      role="group"
      aria-label="Override state"
      className="border-border/60 inline-flex overflow-hidden rounded-md border"
    >
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={enabled}
        className={`${baseClass} ${enabled ? onClass : "text-muted-foreground"}`}
      >
        Enabled
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={!enabled}
        className={`${baseClass} ${!enabled ? offClass : "text-muted-foreground"}`}
      >
        Disabled
      </button>
    </div>
  );
}
