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
import type { BadgeInfo } from "../utils/badge-info";
import type { FilterState } from "./instrumentation-filter-bar";
import { FILTER_STYLES } from "../styles/filter-styles";

type BadgeSize = "default" | "compact";

interface InstrumentationBadgesProps {
  badges: BadgeInfo;
  activeFilters?: FilterState;
  size?: BadgeSize;
}

const sizeClasses: Record<BadgeSize, string> = {
  default: "text-xs px-2 py-1 rounded border-2",
  compact: "text-xs px-1.5 py-0.5 rounded border",
};

export function TargetBadges({
  badges,
  activeFilters,
  size = "default",
}: InstrumentationBadgesProps) {
  const cls = sizeClasses[size];
  const isJavaAgentFilterActive = activeFilters?.target.has("javaagent");
  const isLibraryFilterActive = activeFilters?.target.has("library");

  return (
    <>
      {badges.hasJavaAgentTarget && (
        <span
          className={`${cls} transition-all ${
            isJavaAgentFilterActive
              ? FILTER_STYLES.target.javaagent.active
              : FILTER_STYLES.target.javaagent.inactive
          }`}
          title="Java Agent"
          aria-label="Has Java Agent target"
        >
          Agent
        </span>
      )}
      {badges.hasLibraryTarget && (
        <span
          className={`${cls} transition-all ${
            isLibraryFilterActive
              ? FILTER_STYLES.target.library.active
              : FILTER_STYLES.target.library.inactive
          }`}
          title="Standalone Library"
          aria-label="Has standalone library target"
        >
          Library
        </span>
      )}
    </>
  );
}

export function TelemetryBadges({
  badges,
  activeFilters,
  size = "default",
}: InstrumentationBadgesProps) {
  const cls = sizeClasses[size];
  const isSpansFilterActive = activeFilters?.telemetry.has("spans");
  const isMetricsFilterActive = activeFilters?.telemetry.has("metrics");

  return (
    <>
      {badges.hasSpans && (
        <span
          className={`${cls} transition-all ${
            isSpansFilterActive
              ? FILTER_STYLES.telemetry.spans.active
              : FILTER_STYLES.telemetry.spans.inactive
          }`}
          title="Span telemetry"
          aria-label="Has span telemetry"
        >
          Spans
        </span>
      )}
      {badges.hasMetrics && (
        <span
          className={`${cls} transition-all ${
            isMetricsFilterActive
              ? FILTER_STYLES.telemetry.metrics.active
              : FILTER_STYLES.telemetry.metrics.inactive
          }`}
          title="Metric telemetry"
          aria-label="Has metric telemetry"
        >
          Metrics
        </span>
      )}
    </>
  );
}
