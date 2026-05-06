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
