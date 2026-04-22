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

// Add/remove your Feature Flags to the FEATURE_FLAGS array.
// There is no need to edit anything else in this file.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FEATURE_FLAGS = [
  // Declarative Configuration Builder for Java - Still in development
  "JAVA_CONFIG_BUILDER",

  // Collector Page - Still in development
  "COLLECTOR_PAGE",
] as const;

const FEATURE_FLAG_PREFIX = "VITE_FEATURE_FLAG_";

function flagNameWithPrefix(flagName: string): string {
  return flagName.startsWith(FEATURE_FLAG_PREFIX) ? flagName : `${FEATURE_FLAG_PREFIX}${flagName}`;
}

function normalizedFlagValue(value: string): boolean {
  return ["true", "1", "yes"].includes((value ?? "").toLowerCase());
}

export function isEnabled(flagName: (typeof FEATURE_FLAGS)[number]): boolean {
  const name = flagNameWithPrefix(flagName);

  return normalizedFlagValue(import.meta.env[name]);
}
