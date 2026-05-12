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
import type { VersionInfo } from "@/types/javaagent";

interface VersionSelectorPanelProps {
  versions: VersionInfo[];
  fromVersion: string;
  toVersion: string;
  onFromVersionChange: (version: string) => void;
  onToVersionChange: (version: string) => void;
  whenCondition: string;
  onWhenConditionChange: (when: string) => void;
  availableConditions: string[];
}

export function VersionSelectorPanel({
  versions,
  fromVersion,
  toVersion,
  onFromVersionChange,
  onToVersionChange,
  whenCondition,
  onWhenConditionChange,
  availableConditions,
}: VersionSelectorPanelProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="border-border/30 bg-card/40 flex flex-col gap-6 rounded-xl border p-6 shadow-sm backdrop-blur-sm">
        {/* Info banner */}
        <div className="bg-secondary/10 border-secondary/20 flex w-fit items-center gap-2 rounded-lg border px-3 py-2">
          <Info className="text-secondary h-4 w-4" aria-hidden="true" />
          <span className="text-foreground/90 text-xs font-medium">
            Compare telemetry between two releases
          </span>
        </div>

        {/* Version selectors */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* From version selector */}
          <div className="space-y-3">
            <label
              htmlFor="from-version-select"
              className="bg-muted/50 text-foreground/70 block w-fit rounded-md px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase"
            >
              From
            </label>
            <div className="relative">
              <select
                id="from-version-select"
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

          {/* To version selector */}
          <div className="space-y-3">
            <label
              htmlFor="to-version-select"
              className="bg-muted/50 text-foreground/70 block w-fit rounded-md px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase"
            >
              To
            </label>
            <div className="relative">
              <select
                id="to-version-select"
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

        {availableConditions.length > 1 && (
          <div className="space-y-3">
            <label
              htmlFor="when-condition-select"
              className="bg-muted/50 text-foreground/70 block w-fit rounded-md px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase"
            >
              Configuration
            </label>
            <div className="relative">
              <select
                id="when-condition-select"
                value={whenCondition}
                onChange={(e) => onWhenConditionChange(e.target.value)}
                className="border-border/60 bg-background/80 text-foreground hover:border-primary/40 focus:border-primary/50 focus:ring-primary/20 w-full cursor-pointer appearance-none rounded-lg border-2 px-4 py-2.5 text-sm font-medium [color-scheme:dark] backdrop-blur-sm transition-all duration-200 focus:ring-2 focus:outline-none"
              >
                {availableConditions.map((c) => (
                  <option key={c} value={c}>
                    {c === "default" ? "Default" : c}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
