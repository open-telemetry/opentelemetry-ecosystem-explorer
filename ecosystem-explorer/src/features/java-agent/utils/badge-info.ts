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
import type { InstrumentationListEntry } from "@/types/javaagent";

export interface BadgeInfo {
  hasSpans: boolean;
  hasMetrics: boolean;
  hasJavaAgentTarget: boolean;
  hasLibraryTarget: boolean;
}

/**
 * Computes badge presence flags for a single instrumentation. Slim list entries
 * always carry the precomputed `has_spans`/`has_metrics` flags (the bundle and
 * the fan-out projection both set them), so no telemetry scan is needed.
 */
export function getBadgeInfo(instrumentation: InstrumentationListEntry): BadgeInfo {
  return {
    hasSpans: instrumentation.has_spans === true,
    hasMetrics: instrumentation.has_metrics === true,
    hasJavaAgentTarget: instrumentation.has_javaagent === true,
    hasLibraryTarget: instrumentation.has_standalone_library === true,
  };
}

/**
 * Computes aggregated badge presence flags across multiple instrumentations.
 * A badge is present if any instrumentation in the list has it.
 */
export function getAggregatedBadgeInfo(instrumentations: InstrumentationListEntry[]): BadgeInfo {
  return {
    hasSpans: instrumentations.some((i) => i.has_spans === true),
    hasMetrics: instrumentations.some((i) => i.has_metrics === true),
    hasJavaAgentTarget: instrumentations.some((i) => i.has_javaagent === true),
    hasLibraryTarget: instrumentations.some((i) => i.has_standalone_library === true),
  };
}
