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
    hasJavaAgentTarget:
      !!instrumentation.javaagent_target_versions &&
      instrumentation.javaagent_target_versions.length > 0,
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
    hasJavaAgentTarget: instrumentations.some(
      (instr) => !!instr.javaagent_target_versions && instr.javaagent_target_versions.length > 0
    ),
    hasLibraryTarget: instrumentations.some((instr) => instr.has_standalone_library === true),
  };
}
