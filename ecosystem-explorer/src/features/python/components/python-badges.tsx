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
import type { MetricsFacet } from "@/features/python/utils/catalogue";
import { metricsTone, semconvTone } from "@/features/python/styles/filter-styles";

const PILL = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";

/** Metrics support. "Not specified" is its own state: null in the data means unknown, not no. */
export function MetricsBadge({ metrics }: { metrics: MetricsFacet }) {
  const { t } = useTranslation("python");
  return (
    <span className={`${PILL} ${metricsTone(metrics).badge}`} data-metrics={metrics}>
      {t(`metrics.${metrics}`)}
    </span>
  );
}

/** Semantic-convention status; statuses the locale has no label for show as written. */
export function SemconvBadge({ semconv }: { semconv: string }) {
  const { t } = useTranslation("python");
  return (
    <span className={`${PILL} ${semconvTone(semconv).badge}`} data-semconv={semconv}>
      {t(`semconv.${semconv}`, { defaultValue: semconv })}
    </span>
  );
}
