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
  custom_instrumentations?: Record<string, string>;
  version: string;
}

/**
 * Detailed metadata for an OpenTelemetry Java Agent instrumentation.
 */
export interface InstrumentationData {
  /** The unique name of the instrumentation (e.g., akka-actor-2.3). */
  name: string;
  /** Human-readable name of the instrumentation. */
  display_name?: string;
  /** Whether this instrumentation is disabled by default. */
  disabled_by_default?: boolean;
  /** Brief description of what is being instrumented and how. */
  description?: string;
  /** URL to the documentation or homepage of the instrumented library. */
  library_link?: string;
  /** Relative path to the instrumentation source code in the repository. */
  source_path?: string;
  /** Minimum Java version required by this instrumentation. */
  minimum_java_version?: number;
  /** List of semantic conventions followed by this instrumentation. */
  semantic_conventions?: string[];
  /** List of telemetry features provided (e.g., TRACING, METRICS). */
  features?: string[];
  /** The OpenTelemetry instrumentation scope (meter/logger/tracer name). */
  scope: InstrumentationScope;
  /** Indicates if this instrumentation is compatible with the OpenTelemetry Java Agent. */
  has_javaagent?: boolean;
  /** Indicates if this instrumentation is available as a standalone library. */
  has_standalone_library?: boolean;
  /** Maven coordinates and version ranges of libraries supported by this instrumentation. */
  javaagent_target_versions?: string[];
  /** List of configuration options available for this instrumentation. */
  configurations?: Configuration[];
  /** Telemetry emitted by this instrumentation under specific conditions. */
  telemetry?: Telemetry[];
  /** Whether this is a custom (non-upstream) instrumentation. */
  _is_custom?: boolean;
}

/**
 * The OpenTelemetry instrumentation scope (meter/logger/tracer name).
 */
export interface InstrumentationScope {
  /** The name of the instrumentation scope. */
  name: string;
  /** Optional URL for the OpenTelemetry schema used by this scope. */
  schema_url?: string;
}

/**
 * A configuration option for a Java Agent instrumentation.
 */
export interface Configuration {
  /** The system property or environment variable name. */
  name: string;
  /** A more human-readable name for declarative configuration. */
  declarative_name?: string;
  /** Description of what the configuration option does. */
  description: string;
  /** The expected data type of the configuration value. */
  type: "boolean" | "string" | "list" | "map" | "int" | "double";
  /** The default value if not specified. */
  default: string | boolean | number;
  /** Example values for this configuration option. */
  example?: string[];
}

/**
 * Telemetry emitted by an instrumentation.
 */
export interface Telemetry {
  /** When this telemetry is emitted (e.g., "on every request"). */
  when: string;
  /** Metrics emitted by this instrumentation. */
  metrics?: Metric[];
  /** Spans emitted by this instrumentation. */
  spans?: Span[];
}

/**
 * Metadata for a metric emitted by an instrumentation.
 */
export interface Metric {
  /** The name of the metric. */
  name: string;
  /** Description of what the metric measures. */
  description: string;
  /** The instrument type (e.g., counter, gauge). */
  instrument: "updowncounter" | "counter" | "gauge" | "histogram";
  /** The OpenTelemetry data type for the metric. */
  data_type:
    | "LONG_SUM"
    | "DOUBLE_SUM"
    | "LONG_GAUGE"
    | "DOUBLE_GAUGE"
    | "COUNTER"
    | "HISTOGRAM"
    | "SUMMARY";
  /** The unit of measurement (e.g., ms, bytes). */
  unit: string;
  /** Attributes associated with the metric. */
  attributes?: Attribute[];
}

/**
 * Metadata for a span emitted by an instrumentation.
 */
export interface Span {
  /** The span kind (e.g., CLIENT, SERVER). */
  span_kind: "CLIENT" | "SERVER" | "PRODUCER" | "CONSUMER" | "INTERNAL";
  /** Attributes associated with the span. */
  attributes?: Attribute[];
}

/**
 * An attribute associated with a metric or span.
 */
export interface Attribute {
  /** The name of the attribute. */
  name: string;
  /** The data type of the attribute value. */
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

// Telemetry comparison types
export type DiffStatus = "added" | "removed" | "changed" | "unchanged";

export interface AttributeChange {
  name: string;
  before: Attribute;
  after: Attribute;
}

export interface AttributeChanges {
  added: Attribute[];
  removed: Attribute[];
  changed: AttributeChange[];
}

export interface MetricChanges {
  description?: { before: string; after: string };
  data_type?: { before: string; after: string };
  unit?: { before: string; after: string };
  instrument?: { before: string; after: string };
  attributes: AttributeChanges;
}

export interface SpanChanges {
  attributes: AttributeChanges;
}

export interface MetricDiff {
  status: DiffStatus;
  metric: Metric;
  changes?: MetricChanges;
}

export interface SpanDiff {
  status: DiffStatus;
  span: Span;
  changes?: SpanChanges;
}

export interface TelemetryDiffResult {
  metrics: MetricDiff[];
  spans: SpanDiff[];
}

export interface InstrumentationModule {
  name: string;
  defaultDisabled: boolean;
  coveredEntries: InstrumentationData[];
}
