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
      active: "bg-blue-500/30 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm",
      inactive: "bg-blue-500/10 border-transparent text-blue-600 dark:text-blue-400",
      hover: "hover:border-blue-500/50 hover:bg-blue-500/5",
    },
    metrics: {
      active: "bg-green-500/30 border-green-500 text-green-700 dark:text-green-300 shadow-sm",
      inactive: "bg-green-500/10 border-transparent text-green-600 dark:text-green-400",
      hover: "hover:border-green-500/50 hover:bg-green-500/5",
    },
  },
  target: {
    javaagent: {
      active: "bg-orange-500/30 border-orange-500 text-orange-700 dark:text-orange-300 shadow-sm",
      inactive: "bg-orange-500/10 border-transparent text-orange-600 dark:text-orange-400",
      hover: "hover:border-orange-500/50 hover:bg-orange-500/5",
    },
    library: {
      active: "bg-purple-500/30 border-purple-500 text-purple-700 dark:text-purple-300 shadow-sm",
      inactive: "bg-purple-500/10 border-transparent text-purple-600 dark:text-purple-400",
      hover: "hover:border-purple-500/50 hover:bg-purple-500/5",
    },
  },
} as const;

export function getTelemetryFilterClasses(type: "spans" | "metrics", isActive: boolean): string {
  const styles = FILTER_STYLES.telemetry[type];
  return isActive ? styles.active : `${styles.inactive} ${styles.hover}`;
}

export function getTargetFilterClasses(type: "javaagent" | "library", isActive: boolean): string {
  const styles = FILTER_STYLES.target[type];
  return isActive ? styles.active : `${styles.inactive} ${styles.hover}`;
}
