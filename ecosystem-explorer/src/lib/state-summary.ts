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

/**
 * Counts the number of leaf primitives (non-object, non-array, non-null/undefined)
 * present in the value tree at a given state path. Used to drive "N fields set"
 * summary badges next to group / item labels in the configuration UI.
 */
export function countConfiguredLeaves(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value)) {
    return value.reduce<number>((acc, item) => acc + countConfiguredLeaves(item), 0);
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (acc, v) => acc + countConfiguredLeaves(v),
      0
    );
  }
  return 1;
}
