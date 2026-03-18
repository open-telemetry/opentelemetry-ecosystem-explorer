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

export interface ConfigurationBuilderState {
  version: string;
  activeArea: "instrumentation" | "sdk";
  selectedInstrumentations: Map<string, InstrumentationConfig>;
  configOverrides: Map<string, ConfigValue>;
  outputFormat: "properties" | "env";
  isInitialized: boolean;
}

export interface InstrumentationConfig {
  name: string;
  data: InstrumentationData;
  enabledConfigs: Set<string>;
}

export interface ConfigValue {
  name: string;
  value: string | boolean | number;
  isModified: boolean;
  default: string | boolean | number;
}

export interface CommonConfig {
  name: string;
  config: Configuration;
  usedBy: string[];
}

export type ConfigurationBuilderAction =
  | { type: "SET_VERSION"; version: string }
  | { type: "SET_ACTIVE_AREA"; area: "instrumentation" | "sdk" }
  | {
      type: "ADD_INSTRUMENTATION";
      name: string;
      data: InstrumentationData;
    }
  | { type: "REMOVE_INSTRUMENTATION"; name: string }
  | {
      type: "UPDATE_CONFIG";
      configName: string;
      value: string | boolean | number;
    }
  | { type: "TOGGLE_CONFIG"; instrumentationName: string; configName: string }
  | { type: "SET_OUTPUT_FORMAT"; format: "properties" | "env" }
  | {
      type: "LOAD_STATE";
      state: Partial<ConfigurationBuilderState>;
    }
  | { type: "RESET" }
  | { type: "MARK_INITIALIZED" };

export interface Template {
  id: string;
  name: string;
  description: string;
  category: "framework" | "experimental" | "semconv" | "custom";
  instrumentations: string[];
  configOverrides?: Record<string, string | boolean | number>;
}

export interface ShareConfig {
  v: string;
  i: string[];
  c: Record<string, string | boolean | number>;
  f?: "properties" | "env";
}

export interface ImportConfig {
  v: string;
  i: string[];
}
