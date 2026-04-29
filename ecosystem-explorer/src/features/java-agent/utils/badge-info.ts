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
import type { InstrumentationData } from "@/types/javaagent";

export interface BadgeInfo {
  hasSpans: boolean;
  hasMetrics: boolean;
  hasJavaAgentTarget: boolean;
  hasLibraryTarget: boolean;
}

/**
 * Computes badge presence flags for a single instrumentation.
 */
export function getBadgeInfo(instrumentation: InstrumentationData): BadgeInfo {
  return {
    hasSpans: instrumentation.telemetry?.some((t) => t.spans && t.spans.length > 0) ?? false,
    hasMetrics: instrumentation.telemetry?.some((t) => t.metrics && t.metrics.length > 0) ?? false,
    hasJavaAgentTarget: instrumentation.has_javaagent === true,
    hasLibraryTarget: instrumentation.has_standalone_library === true,
  };
}

/**
 * Computes aggregated badge presence flags across multiple instrumentations.
 * A badge is present if any instrumentation in the list has it.
 */
export function getAggregatedBadgeInfo(instrumentations: InstrumentationData[]): BadgeInfo {
  return {
    hasSpans: instrumentations.some(
      (instr) => instr.telemetry?.some((t) => t.spans && t.spans.length > 0) ?? false
    ),
    hasMetrics: instrumentations.some(
      (instr) => instr.telemetry?.some((t) => t.metrics && t.metrics.length > 0) ?? false
    ),
    hasJavaAgentTarget: instrumentations.some((instr) => instr.has_javaagent === true),
    hasLibraryTarget: instrumentations.some((instr) => instr.has_standalone_library === true),
  };
}
