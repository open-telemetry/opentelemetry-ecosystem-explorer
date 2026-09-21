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
import type { LaidOutMarker } from "../utils/timeline-layout";
import {
  MARKER_LABEL_WIDTH,
  eventReference,
  formatDate,
  formatMonthYear,
} from "../utils/timeline-layout";
import { getEventTypeStyle } from "../utils/timeline-colors";
import { TimelineMarkerShape } from "./timeline-marker-shape";

interface TimelineEventMarkerProps {
  marker: LaidOutMarker;
  selected: boolean;
  locale: string;
  onSelect: (id: string) => void;
}

export function TimelineEventMarker({
  marker,
  selected,
  locale,
  onSelect,
}: TimelineEventMarkerProps) {
  const { t } = useTranslation("semantic-conventions");
  const { event, x, left, top } = marker;
  const typeLabel = t(`timeline.filters.type.${event.type}`);
  const style = getEventTypeStyle(event.type);

  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -translate-x-1/2"
        style={{ left: x, top: top + 10 }}
      >
        <TimelineMarkerShape type={event.type} className="h-4 w-4" />
      </span>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(event.id)}
        title={`${typeLabel} · ${formatDate(event.date, locale)}`}
        aria-label={`${event.title}, ${formatDate(event.date, locale)}, ${eventReference(event)}`}
        style={{ left, top, width: MARKER_LABEL_WIDTH, height: 36 }}
        className={`focus-visible:ring-primary absolute cursor-pointer rounded-r-md border border-l-2 px-2 py-1 text-left text-[10px] leading-tight transition-[background-color,box-shadow] focus-visible:ring-2 focus-visible:outline-none ${style.accentBorderClass} ${
          selected
            ? "border-primary bg-primary ring-primary text-white shadow-lg ring-2"
            : "border-border/60 bg-card text-foreground hover:bg-card-secondary hover:ring-primary/40 shadow-sm hover:shadow-md hover:ring-1"
        }`}
      >
        <span className="block truncate font-semibold">{event.short}</span>
        <span className={`block truncate ${selected ? "text-white/90" : "text-muted-foreground"}`}>
          {formatMonthYear(event.date, locale)} · {eventReference(event)}
        </span>
      </button>
    </>
  );
}
