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
import { EVENT_TYPES } from "../utils/timeline-colors";
import { TimelineMarkerShape } from "./timeline-marker-shape";

export function TimelineLegend() {
  const { t } = useTranslation("semantic-conventions");

  return (
    <div
      aria-label={t("timeline.legend.heading")}
      className="border-border/60 text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 border-b px-4 py-3 text-xs"
    >
      {EVENT_TYPES.map((type) => (
        <span key={type} className="flex items-center gap-1.5">
          <TimelineMarkerShape type={type} />
          {t(`timeline.filters.type.${type}`)}
        </span>
      ))}
    </div>
  );
}
