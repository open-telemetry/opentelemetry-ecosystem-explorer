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
import { useMemo } from "react";
import type { InstrumentationModule } from "@/types/javaagent";
import { getByPath } from "@/lib/config-path";
import { hasMeaningfulLeaf } from "@/lib/state-hydrate";
import { aggregateConfigurations } from "@/lib/configurations-aggregate";
import { useConfigurationBuilder } from "./use-configuration-builder";

const ENABLED_PATH = ["distribution", "javaagent", "instrumentation"] as const;

export function useCustomizedModules(modules: InstrumentationModule[]): Set<string> {
  const { state } = useConfigurationBuilder();
  return useMemo(() => {
    const result = new Set<string>();

    const enabledSection = getByPath(state.values, [...ENABLED_PATH]);
    if (enabledSection && typeof enabledSection === "object" && !Array.isArray(enabledSection)) {
      for (const [moduleName, moduleVal] of Object.entries(enabledSection)) {
        if (moduleVal && typeof moduleVal === "object" && !Array.isArray(moduleVal)) {
          if (typeof (moduleVal as Record<string, unknown>).enabled === "boolean") {
            result.add(moduleName);
          }
        }
      }
    }

    for (const module of modules) {
      const aggregated = aggregateConfigurations(module);
      for (const { scope, path } of aggregated) {
        if (scope !== "owned") continue;
        const v = getByPath(state.values, path);
        if (hasMeaningfulLeaf(v)) {
          result.add(module.name);
          break;
        }
      }
    }

    return result;
  }, [state.values, modules]);
}
