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

import { Info } from "lucide-react";
import type { VersionInfo } from "@/types/javaagent";

interface ReleaseVersionSelectorProps {
  versions: VersionInfo[];
  fromVersion: string;
  toVersion: string;
  onFromVersionChange: (version: string) => void;
  onToVersionChange: (version: string) => void;
}

/**
 * ReleaseVersionSelector renders two dropdowns to allow the user to select the
 * "from" and "to" Java Agent versions for a release comparison.
 */
export function ReleaseVersionSelector({
  versions,
  fromVersion,
  toVersion,
  onFromVersionChange,
  onToVersionChange,
}: ReleaseVersionSelectorProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="border-border/30 bg-card/40 flex flex-col gap-6 rounded-xl border p-6 shadow-sm backdrop-blur-sm">
        <div className="bg-secondary/10 border-secondary/20 flex w-fit items-center gap-2 rounded-lg border px-3 py-2">
          <Info className="text-secondary h-4 w-4" aria-hidden="true" />
          <span className="text-foreground/90 text-xs font-medium">
            Compare telemetry and configuration changes between two releases
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <label
              htmlFor="from-version-select"
              className="bg-muted/50 text-foreground/70 block w-fit rounded-md px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase"
            >
              From
            </label>
            <select
              id="from-version-select"
              value={fromVersion}
              onChange={(e) => onFromVersionChange(e.target.value)}
              className="border-primary/20 bg-primary/5 text-foreground hover:border-primary/40 hover:bg-primary/10 focus:ring-primary/50 focus:border-primary/50 w-full cursor-pointer rounded-lg border-2 px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:ring-2 focus:outline-none"
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {v.version} {v.is_latest ? "(latest)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label
              htmlFor="to-version-select"
              className="bg-muted/50 text-foreground/70 block w-fit rounded-md px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase"
            >
              To
            </label>
            <select
              id="to-version-select"
              value={toVersion}
              onChange={(e) => onToVersionChange(e.target.value)}
              className="border-primary/20 bg-primary/5 text-foreground hover:border-primary/40 hover:bg-primary/10 focus:ring-primary/50 focus:border-primary/50 w-full cursor-pointer rounded-lg border-2 px-4 py-2.5 text-sm font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:ring-2 focus:outline-none"
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {v.version} {v.is_latest ? "(latest)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
