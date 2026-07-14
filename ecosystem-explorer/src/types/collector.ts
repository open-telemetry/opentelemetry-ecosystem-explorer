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
  /**
   * Content hash of the consolidated per-version list bundle, when available.
   * The list page fetches `bundles/{version}-{bundle_hash}.json` in one request
   * instead of fanning out per component. Optional so old cached indexes (and
   * missing bundles) degrade gracefully to the per-component fan-out.
   */
  bundle_hash?: string;
}

export interface VersionManifest {
  components: Record<string, string>;
  version: string;
}

/**
 * Represents the stability level of a Collector component or one of its signals.
 */
export type Stability = "alpha" | "beta" | "stable" | "deprecated" | "unmaintained" | "development";

/**
 * Core metadata for an OpenTelemetry Collector component.
 */
export interface CollectorComponent {
  /** Unique identifier for the component (e.g., core-receiver-otlpreceiver). */
  id: string;
  /** The short name of the component (e.g., otlpreceiver). */
  name: string;
  /** The ecosystem this component belongs to (always 'collector'). */
  ecosystem: string;
  /** The functional type of the component. */
  type: "receiver" | "processor" | "exporter" | "extension" | "connector";
  /** The distribution where this component originates. */
  distribution: "core" | "contrib" | string;
  /** Human-readable name of the component. */
  display_name?: string | null;
  /** Brief description of the component's functionality. */
  description?: string | null;
  /** Link to the component's source code or documentation. */
  repository?: string;
  /** Detailed status including codeowners and signal stability. */
  status?: ComponentStatus;
  /** Telemetry metrics emitted by this component. Keyed by metric name. */
  metrics?: { [key: string]: CollectorMetric };
  /** Attribute definitions referenced by metrics. Keyed by attribute name. */
  attributes?: { [key: string]: CollectorAttribute };
  /** Resource attributes associated with the component. Keyed by attribute name. */
  resource_attributes?: { [key: string]: CollectorAttribute };
}

/**
 * Detailed status information for a Collector component.
 */
export interface ComponentStatus {
  /** Functional types this component supports (e.g., as a receiver, processor). */
  class: string;
  /** Stability levels per telemetry signal (metrics, logs, traces). */
  stability: Partial<Record<Stability, string[]>>;
  distributions: string[];
  codeowners?: {
    active?: string[];
    emeritus?: string[];
  };
}

/**
 * A single metric emitted by a Collector component.
 * Modeled after the metadata.yaml schema used by the collector-contrib repo.
 */
export interface CollectorMetric {
  /** Description of what this metric measures. */
  description: string;
  /** Whether the metric is collected by default. */
  enabled: boolean;
  /** Metric unit as defined by https://ucum.org/ucum.html. */
  unit: string;
  /** Stability level of this specific metric. */
  stability?: Stability;
  /** Extended documentation beyond the description. */
  extended_documentation?: string;
  /** Whether this metric is optional (only initialized under certain conditions). */
  optional?: boolean;
  /** Sum metric type descriptor. Present when the metric is a sum. */
  sum?: MetricValueDescriptor & { monotonic: boolean };
  /** Gauge metric type descriptor. Present when the metric is a gauge. */
  gauge?: MetricValueDescriptor;
  /** Histogram metric type descriptor. Present when the metric is a histogram. */
  histogram?: MetricValueDescriptor & { bucket_boundaries?: number[] };
  /** Attribute keys referencing the component-level attributes map. */
  attributes?: string[];
}

/**
 * Shared fields across sum, gauge, and histogram metric type descriptors.
 */
export interface MetricValueDescriptor {
  /** The numeric type of the metric's data points. */
  value_type: string;
  /** Aggregation temporality (e.g., "cumulative", "delta"). Only present on sum metrics. */
  aggregation_temporality?: string;
  /** Whether this metric is observed asynchronously. */
  async?: boolean;
}

/**
 * Attribute definition at the component level.
 * Metrics reference these by key name in their `attributes` array.
 */
export interface CollectorAttribute {
  /** Human-readable description of the attribute. */
  description: string;
  /** Data type of the attribute (e.g., "string", "int", "double", "bool"). */
  type: string;
  /** If set, the exported attribute name differs from the map key. */
  name_override?: string;
  /** Allowed values when the attribute is an enum. */
  enum?: string[];
}

export interface CollectorIndex {
  ecosystem: string;
  taxonomy: {
    distributions: string[];
    types: string[];
  };
  components: IndexComponent[];
}

export interface IndexComponent {
  id: string;
  name: string;
  distribution: string;
  type: string;
  display_name?: string | null;
  description?: string | null;
  stability?: Stability | null;
}
