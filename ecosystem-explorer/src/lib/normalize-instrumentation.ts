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
import type { InstrumentationData, InstrumentationModule } from "@/types/javaagent";

const VERSION_SUFFIX_RE = /-\d+(?:\.\d+)*$/;

export function normalizeRegistryName(name: string): string {
  return name.replace(VERSION_SUFFIX_RE, "").replace(/[-.]/g, "_");
}

export function groupByModule(entries: InstrumentationData[]): InstrumentationModule[] {
  const buckets = new Map<string, InstrumentationData[]>();
  for (const entry of entries) {
    const key = normalizeRegistryName(entry.name);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(entry);
  }

  const modules: InstrumentationModule[] = [];
  for (const [name, bucket] of buckets) {
    const coveredEntries = [...bucket].sort((a, b) => a.name.localeCompare(b.name));
    const defaultDisabled = coveredEntries.every((e) => e.disabled_by_default === true);
    modules.push({ name, defaultDisabled, coveredEntries });
  }
  modules.sort((a, b) => a.name.localeCompare(b.name));
  return modules;
}
