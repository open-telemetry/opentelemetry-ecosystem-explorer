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
import { ChevronDown } from "lucide-react";
import type { VersionInfo } from "@/types/javaagent";

interface VersionSelectorProps {
  versions: VersionInfo[];
  currentVersion: string;
  onVersionChange: (version: string) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
}

export function VersionSelector({
  versions,
  currentVersion,
  onVersionChange,
  disabled = false,
  label = "Version",
  id = "version-select",
}: VersionSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-muted-foreground text-sm font-medium whitespace-nowrap">
        {label}
      </label>

      <div className="relative min-w-[160px]">
        <select
          id={id}
          value={currentVersion}
          onChange={(e) => onVersionChange(e.target.value)}
          disabled={disabled}
          className="border-border/60 bg-card text-foreground hover:border-primary/40 focus:border-primary/50 focus:ring-primary/20 cursor-pointer appearance-none rounded-md border px-3 py-2 pr-9 text-sm font-medium shadow-sm transition-all duration-200 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {versions.map((v) => (
            <option key={v.version} value={v.version}>
              {v.version}
              {v.is_latest ? " (latest)" : ""}
            </option>
          ))}
        </select>

        <ChevronDown
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
