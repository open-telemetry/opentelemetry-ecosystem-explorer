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
      <div className="border-border/30 bg-card/40 flex flex-col gap-4 rounded-xl border p-6 shadow-sm backdrop-blur-sm md:flex-row md:items-center md:justify-between">
        {/* Left: Info banner */}
        <div className="flex items-center gap-3">
          <div className="bg-secondary/10 border-secondary/20 flex items-center gap-2 rounded-lg border px-3 py-2">
            <Info className="text-secondary h-4 w-4" aria-hidden="true" />
            <span className="text-foreground/90 text-xs font-medium">
              Telemetry varies by configuration
            </span>
          </div>
        </div>

        {/* Right: Label + Select */}
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <label
            htmlFor="config-select"
            className="bg-muted/50 text-foreground/70 shrink-0 rounded-md px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase"
          >
            Configuration
          </label>
          <div className="relative flex-1 sm:flex-none">
            <select
              id="config-select"
              value={selectedWhen}
              onChange={(e) => onWhenChange(e.target.value)}
              className="border-border/60 bg-background/80 text-foreground hover:border-primary/40 focus:border-primary/50 focus:ring-primary/20 w-full min-w-0 cursor-pointer appearance-none rounded-lg border-2 py-2.5 pr-10 pl-4 text-sm font-medium [color-scheme:dark] backdrop-blur-sm transition-all duration-200 focus:ring-2 focus:outline-none sm:min-w-[200px]"
            >
              {telemetry.map((t) => (
                <option key={t.when} value={t.when}>
                  {getConfigLabel(t.when)}
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
  );
}
