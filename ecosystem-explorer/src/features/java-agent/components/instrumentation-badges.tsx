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
import { SignalBadge, type SignalBadgeSize } from "@/components/ui/signal-badge";

interface InstrumentationBadgesProps {
  badges: BadgeInfo;
  activeFilters?: FilterState;
  size?: SignalBadgeSize;
}

export function TargetBadges({
  badges,
  activeFilters,
  size = "default",
}: InstrumentationBadgesProps) {
  const { t } = useTranslation("java-agent");
  const isJavaAgentFilterActive = activeFilters?.target.has("javaagent") ?? false;
  const isLibraryFilterActive = activeFilters?.target.has("library") ?? false;

  return (
    <>
      {badges.hasJavaAgentTarget && (
        <SignalBadge
          label={t("badges.agent.label")}
          tooltip={t("badges.agent.tooltip")}
          ariaLabel={t("badges.agent.ariaLabel")}
          active={isJavaAgentFilterActive}
          styles={FILTER_STYLES.target.javaagent}
          size={size}
        />
      )}
      {badges.hasLibraryTarget && (
        <SignalBadge
          label={t("badges.library.label")}
          tooltip={t("badges.library.tooltip")}
          ariaLabel={t("badges.library.ariaLabel")}
          active={isLibraryFilterActive}
          styles={FILTER_STYLES.target.library}
          size={size}
        />
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
  const isSpansFilterActive = activeFilters?.telemetry.has("spans") ?? false;
  const isMetricsFilterActive = activeFilters?.telemetry.has("metrics") ?? false;

  return (
    <>
      {badges.hasSpans && (
        <SignalBadge
          label={t("badges.spans.label")}
          tooltip={t("badges.spans.tooltip")}
          ariaLabel={t("badges.spans.ariaLabel")}
          active={isSpansFilterActive}
          styles={FILTER_STYLES.telemetry.spans}
          size={size}
        />
      )}
      {badges.hasMetrics && (
        <SignalBadge
          label={t("badges.metrics.label")}
          tooltip={t("badges.metrics.tooltip")}
          ariaLabel={t("badges.metrics.ariaLabel")}
          active={isMetricsFilterActive}
          styles={FILTER_STYLES.telemetry.metrics}
          size={size}
        />
      )}
    </>
  );
}
