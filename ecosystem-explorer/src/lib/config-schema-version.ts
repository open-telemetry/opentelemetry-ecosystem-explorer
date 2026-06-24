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
import type { ConfigVersionInfo } from "@/types/configuration";

/**
 * Highest declarative-configuration schema version the builder UI supports.
 * The registry publishes newer versions before the UI can render their fields,
 * so the schema selector is pinned here. Bump this once the UI supports a newer
 * version.
 */
export const MAX_SUPPORTED_CONFIG_SCHEMA_VERSION = "1.0.0";

// Numeric (not lexicographic) compare so "1.9.0" < "1.10.0". Missing trailing
// segments count as 0, so "1.0" === "1.0.0".
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Keeps only versions at or below the pinned ceiling and re-marks the highest
 * survivor as `is_latest`, since upstream may flag a now-hidden version.
 */
export function filterSupportedConfigVersions(
  versions: readonly ConfigVersionInfo[]
): ConfigVersionInfo[] {
  const supported = versions.filter(
    (v) => compareVersions(v.version, MAX_SUPPORTED_CONFIG_SCHEMA_VERSION) <= 0
  );
  if (supported.length === 0) return [];
  const latest = supported.reduce((a, b) => (compareVersions(b.version, a.version) > 0 ? b : a));
  return supported.map((v) => ({ ...v, is_latest: v.version === latest.version }));
}
