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
import { getByPath } from "@/lib/config-path";
import { useConfigurationBuilder } from "./use-configuration-builder";

export type CustomizationStatus = "enabled" | "disabled" | "none";

const PATH = ["distribution", "javaagent", "instrumentation"] as const;

export function useCustomizationStatusMap(): Map<string, "enabled" | "disabled"> {
  const { state } = useConfigurationBuilder();
  return useMemo(() => {
    const inst = getByPath(state.values, [...PATH]);
    const map = new Map<string, "enabled" | "disabled">();
    if (!inst || typeof inst !== "object" || Array.isArray(inst)) return map;
    for (const [moduleName, moduleConfig] of Object.entries(inst)) {
      if (moduleConfig && typeof moduleConfig === "object" && !Array.isArray(moduleConfig)) {
        const enabled = (moduleConfig as Record<string, unknown>).enabled;
        if (enabled === true) {
          map.set(moduleName, "enabled");
        } else if (enabled === false) {
          map.set(moduleName, "disabled");
        }
      }
    }
    return map;
  }, [state.values]);
}

export function useCustomizationStatus(module: string): CustomizationStatus {
  return useCustomizationStatusMap().get(module) ?? "none";
}
