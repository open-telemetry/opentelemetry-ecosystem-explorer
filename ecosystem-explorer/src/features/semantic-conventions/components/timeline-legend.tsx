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
import { Tooltip } from "@/components/ui/tooltip";
import type { TimelineEventType } from "@/features/semantic-conventions/types";
import { TimelineMarkerShape } from "@/features/semantic-conventions/components/timeline-marker-shape";

interface TimelineLegendProps {
  types: TimelineEventType[];
}

export function TimelineLegend({ types }: TimelineLegendProps) {
  const { t } = useTranslation("semantic-conventions");

  if (types.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={t("timeline.legend.heading")}
      className="border-border/60 text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 border-b px-4 py-3 text-xs"
    >
      {types.map((type) => (
        <Tooltip
          key={type}
          content={t(`timeline.legend.descriptions.${type}`)}
          className="max-w-xs text-left leading-relaxed"
        >
          <button
            type="button"
            className="hover:text-foreground focus-visible:ring-primary flex cursor-help items-center gap-1.5 rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <TimelineMarkerShape type={type} />
            <span className="decoration-muted-foreground/50 underline decoration-dotted underline-offset-4">
              {t(`timeline.filters.type.${type}`)}
            </span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
