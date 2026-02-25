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
export interface VersionsIndex {
  versions: VersionInfo[];
}

export interface VersionInfo {
  version: string;
  is_latest: boolean;
}

export interface VersionManifest {
  instrumentations: Record<string, string>;
  version: string;
}

export interface InstrumentationData {
  name: string;
  display_name?: string;
  description?: string;
  library_link?: string;
  source_path?: string;
  minimum_java_version?: number;
  tags?: string[];
  semantic_conventions?: string[];
  features?: string[];
  scope: InstrumentationScope;
  has_standalone_library?: boolean;
  javaagent_target_versions?: string[];
  configurations?: Configuration[];
  telemetry?: Telemetry[];
}

export interface InstrumentationScope {
  name: string;
  schema_url?: string;
}

export interface Configuration {
  name: string;
  description: string;
  type: "boolean" | "string" | "list" | "map" | "int" | "double";
  default: string | boolean | number;
}

export interface Telemetry {
  when: string;
  metrics?: Metric[];
  spans?: Span[];
}

export interface Metric {
  name: string;
  description: string;
  type: "COUNTER" | "GAUGE" | "HISTOGRAM" | "SUMMARY";
  unit: string;
  attributes?: Attribute[];
}

export interface Span {
  span_kind: "CLIENT" | "SERVER" | "PRODUCER" | "CONSUMER" | "INTERNAL";
  attributes?: Attribute[];
}

export interface Attribute {
  name: string;
  type:
    | "STRING"
    | "LONG"
    | "DOUBLE"
    | "BOOLEAN"
    | "STRING_ARRAY"
    | "LONG_ARRAY"
    | "DOUBLE_ARRAY"
    | "BOOLEAN_ARRAY";
}
