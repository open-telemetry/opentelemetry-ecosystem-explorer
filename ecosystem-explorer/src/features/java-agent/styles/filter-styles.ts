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
export const FILTER_STYLES = {
  telemetry: {
    spans: {
      active:
        "bg-blue-500/40 border-blue-400 text-blue-100 shadow-[0_0_15px_rgba(59,130,246,0.3)] ring-1 ring-blue-400/50",
      inactive:
        "bg-blue-500/5 border-blue-500/20 text-blue-400/70 hover:border-blue-500/50 hover:bg-blue-500/10",
    },
    metrics: {
      active:
        "bg-green-500/40 border-green-400 text-green-100 shadow-[0_0_15px_rgba(34,197,94,0.3)] ring-1 ring-green-400/50",
      inactive:
        "bg-green-500/5 border-green-500/20 text-green-400/70 hover:border-green-500/50 hover:bg-green-500/10",
    },
  },
  target: {
    javaagent: {
      active:
        "bg-orange-500/40 border-orange-400 text-orange-100 shadow-[0_0_15px_rgba(249,115,22,0.3)] ring-1 ring-orange-400/50",
      inactive:
        "bg-orange-500/5 border-orange-500/20 text-orange-400/70 hover:border-orange-500/50 hover:bg-orange-500/10",
    },
    library: {
      active:
        "bg-purple-500/40 border-purple-400 text-purple-100 shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-1 ring-purple-400/50",
      inactive:
        "bg-purple-500/5 border-purple-500/20 text-purple-400/70 hover:border-purple-500/50 hover:bg-purple-500/10",
    },
  },
} as const;

export function getTelemetryFilterClasses(type: "spans" | "metrics", isActive: boolean): string {
  const styles = FILTER_STYLES.telemetry[type];
  return isActive ? styles.active : styles.inactive;
}

export function getTargetFilterClasses(type: "javaagent" | "library", isActive: boolean): string {
  const styles = FILTER_STYLES.target[type];
  return isActive ? styles.active : styles.inactive;
}
