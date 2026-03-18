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
import type { InstrumentationConfig, CommonConfig, Configuration } from "@/types/javaagent";

export function detectCommonConfigs(
  instrumentations: Map<string, InstrumentationConfig>
): CommonConfig[] {
  const usage = new Map<string, { config: Configuration; usedBy: string[] }>();

  for (const [name, instr] of instrumentations) {
    if (!instr.data.configurations) continue;

    for (const config of instr.data.configurations) {
      if (!instr.enabledConfigs.has(config.name)) continue;

      const existing = usage.get(config.name);
      if (existing) {
        existing.usedBy.push(name);
      } else {
        usage.set(config.name, { config, usedBy: [name] });
      }
    }
  }

  return Array.from(usage.entries())
    .filter(([_, info]) => info.usedBy.length >= 2)
    .map(([name, info]) => ({
      name,
      config: info.config,
      usedBy: info.usedBy,
    }))
    .sort((a, b) => b.usedBy.length - a.usedBy.length);
}
