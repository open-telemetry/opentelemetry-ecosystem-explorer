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
import type { Telemetry } from "@/types/javaagent";

interface ConfigurationSelectorProps {
  telemetry: Telemetry[];
  selectedWhen: string;
  onWhenChange: (when: string) => void;
}

function getConfigLabel(when: string): string {
  if (when === "default") return "Default";
  return when;
}

export function ConfigurationSelector({
  telemetry,
  selectedWhen,
  onWhenChange,
}: ConfigurationSelectorProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col gap-4 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        {/* Left: Info banner */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-secondary/10 px-3 py-2 border border-secondary/20">
            <Info className="h-4 w-4 text-secondary" aria-hidden="true" />
            <span className="text-xs font-medium text-foreground/90">
              Telemetry varies by configuration
            </span>
          </div>
        </div>

        {/* Right: Label + Select */}
        <div className="flex items-center gap-3">
          <label
            htmlFor="config-select"
            className="rounded-md bg-muted/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground/70"
          >
            Configuration
          </label>
          <select
            id="config-select"
            value={selectedWhen}
            onChange={(e) => onWhenChange(e.target.value)}
            className="min-w-[200px] cursor-pointer rounded-lg border-2 border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:border-primary/40 hover:bg-primary/10 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
          >
            {telemetry.map((t) => (
              <option key={t.when} value={t.when}>
                {getConfigLabel(t.when)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
