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
import type { InstrumentationModule } from "@/types/javaagent";
import type { ConfigValue, Path } from "@/types/configuration-builder";
import { aggregateConfigurations } from "./configurations-aggregate";
import { defaultConfigValue, type DeclarativeScope } from "./declarative-name";
import { hasMeaningfulLeaf } from "./state-hydrate";

export interface DefaultEntry {
  path: Path;
  value: ConfigValue;
}

export interface BuildDefaultEntriesOptions {
  /** Scopes to include. Callers currently pass all three; see the plan §9.1. */
  includeScopes: DeclarativeScope[];
}

/**
 * Builds the merge-safe entry list for the Instrumentation tab's "Add all configs"
 * action: every instrumentation-module config option (in the requested scopes),
 * deduped by declarative name across all modules, mapped to its value path and
 * parsed default value. Options whose default is empty are omitted — they
 * would not contribute to the generated YAML.
 *
 * Reuses `aggregateConfigurations` (per-module dedupe + scope classification +
 * path) and `defaultConfigValue`, so a bulk-added leaf is byte-identical to
 * clicking Override on that field individually.
 */
export function buildInstrumentationDefaultEntries(
  modules: InstrumentationModule[],
  opts: BuildDefaultEntriesOptions
): DefaultEntry[] {
  const byPathKey = new Map<string, DefaultEntry>();
  for (const mod of modules) {
    for (const cfg of aggregateConfigurations(mod)) {
      if (!opts.includeScopes.includes(cfg.scope)) continue;
      // aggregateConfigurations already deduped per module by declarative_name;
      // dedupe again across modules so shared general.*/java.common.* configs
      // land once. Keyed by serialized path since path uniquely maps 1:1 to
      // declarative_name.
      const key = cfg.path.join(".");
      if (byPathKey.has(key)) continue;
      const value = defaultConfigValue(cfg.entry);
      // Skip empty defaults ("", [], {}): stripEmpties drops them from the
      // YAML anyway, so adding them would only mark fields as customized
      // (Reset button, inflated counts) without producing any output.
      if (!hasMeaningfulLeaf(value)) continue;
      byPathKey.set(key, { path: cfg.path, value });
    }
  }
  return [...byPathKey.values()];
}
