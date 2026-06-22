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
import { useTranslation } from "react-i18next";
import type { BadgeInfo } from "../utils/badge-info";
import type { FilterState } from "./instrumentation-filter-bar";
import { FILTER_STYLES } from "../styles/filter-styles";
import { Tooltip } from "@/components/ui/tooltip";

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
  const { t } = useTranslation("java-agent");
  const cls = sizeClasses[size];
  const isJavaAgentFilterActive = activeFilters?.target.has("javaagent");
  const isLibraryFilterActive = activeFilters?.target.has("library");

  return (
    <>
      {badges.hasJavaAgentTarget && (
        <Tooltip content={t("badges.agent.tooltip")}>
          <span
            aria-label={t("badges.agent.ariaLabel")}
            className={`${cls} focus:ring-ring cursor-help transition-all focus:ring-2 focus:ring-offset-1 focus:outline-none ${
              isJavaAgentFilterActive
                ? FILTER_STYLES.target.javaagent.active
                : FILTER_STYLES.target.javaagent.inactive
            }`}
            tabIndex={0}
          >
            {t("badges.agent.label")}
          </span>
        </Tooltip>
      )}
      {badges.hasLibraryTarget && (
        <Tooltip content={t("badges.library.tooltip")}>
          <span
            aria-label={t("badges.library.ariaLabel")}
            className={`${cls} focus:ring-ring cursor-help transition-all focus:ring-2 focus:ring-offset-1 focus:outline-none ${
              isLibraryFilterActive
                ? FILTER_STYLES.target.library.active
                : FILTER_STYLES.target.library.inactive
            }`}
            tabIndex={0}
          >
            {t("badges.library.label")}
          </span>
        </Tooltip>
      )}
    </>
  );
}

export function TelemetryBadges({
  badges,
  activeFilters,
  size = "default",
}: InstrumentationBadgesProps) {
  const { t } = useTranslation("java-agent");
  const cls = sizeClasses[size];
  const isSpansFilterActive = activeFilters?.telemetry.has("spans");
  const isMetricsFilterActive = activeFilters?.telemetry.has("metrics");

  return (
    <>
      {badges.hasSpans && (
        <Tooltip content={t("badges.spans.tooltip")}>
          <span
            aria-label={t("badges.spans.ariaLabel")}
            className={`${cls} focus:ring-ring cursor-help transition-all focus:ring-2 focus:ring-offset-1 focus:outline-none ${
              isSpansFilterActive
                ? FILTER_STYLES.telemetry.spans.active
                : FILTER_STYLES.telemetry.spans.inactive
            }`}
            tabIndex={0}
          >
            {t("badges.spans.label")}
          </span>
        </Tooltip>
      )}
      {badges.hasMetrics && (
        <Tooltip content={t("badges.metrics.tooltip")}>
          <span
            aria-label={t("badges.metrics.ariaLabel")}
            className={`${cls} focus:ring-ring cursor-help transition-all focus:ring-2 focus:ring-offset-1 focus:outline-none ${
              isMetricsFilterActive
                ? FILTER_STYLES.telemetry.metrics.active
                : FILTER_STYLES.telemetry.metrics.inactive
            }`}
            tabIndex={0}
          >
            {t("badges.metrics.label")}
          </span>
        </Tooltip>
      )}
    </>
  );
}
