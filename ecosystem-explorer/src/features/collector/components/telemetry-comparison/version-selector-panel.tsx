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
import { Info, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { VersionInfo } from "@/types/collector";

interface VersionSelectorPanelProps {
  versions: VersionInfo[];
  fromVersion: string;
  toVersion: string;
  onFromVersionChange: (version: string) => void;
  onToVersionChange: (version: string) => void;
}

/**
 * From/To version pickers for comparing a component's internal telemetry.
 * Unlike the Java Agent version of this panel, there is no configuration/
 * when-condition selector: Collector metadata has no equivalent axis.
 */
export function VersionSelectorPanel({
  versions,
  fromVersion,
  toVersion,
  onFromVersionChange,
  onToVersionChange,
}: VersionSelectorPanelProps) {
  const { t } = useTranslation("collector");
  return (
    <div className="mx-auto max-w-4xl">
      <div className="border-border/30 bg-card/40 flex flex-col gap-6 rounded-xl border p-6 shadow-sm backdrop-blur-sm">
        <div className="bg-secondary/10 border-secondary/20 flex w-fit items-center gap-2 rounded-lg border px-3 py-2">
          <Info className="text-secondary h-4 w-4" aria-hidden="true" />
          <span className="text-foreground/90 text-xs font-medium">
            {t("telemetryComparison.versionSelectorPanel.banner")}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <label
              htmlFor="collector-from-version-select"
              className="bg-muted/50 text-foreground/70 block w-fit rounded-md px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase"
            >
              {t("telemetryComparison.versionSelectorPanel.from")}
            </label>
            <div className="relative">
              <select
                id="collector-from-version-select"
                value={fromVersion}
                onChange={(e) => onFromVersionChange(e.target.value)}
                className="border-border/60 bg-background/80 text-foreground hover:border-primary/40 focus:border-primary/50 focus:ring-primary/20 w-full cursor-pointer appearance-none rounded-lg border-2 px-4 py-2.5 text-sm font-medium [color-scheme:dark] backdrop-blur-sm transition-all duration-200 focus:ring-2 focus:outline-none"
              >
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    {v.version} {v.is_latest ? "(latest)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label
              htmlFor="collector-to-version-select"
              className="bg-muted/50 text-foreground/70 block w-fit rounded-md px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase"
            >
              {t("telemetryComparison.versionSelectorPanel.to")}
            </label>
            <div className="relative">
              <select
                id="collector-to-version-select"
                value={toVersion}
                onChange={(e) => onToVersionChange(e.target.value)}
                className="border-border/60 bg-background/80 text-foreground hover:border-primary/40 focus:border-primary/50 focus:ring-primary/20 w-full cursor-pointer appearance-none rounded-lg border-2 px-4 py-2.5 text-sm font-medium [color-scheme:dark] backdrop-blur-sm transition-all duration-200 focus:ring-2 focus:outline-none"
              >
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    {v.version} {v.is_latest ? "(latest)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
