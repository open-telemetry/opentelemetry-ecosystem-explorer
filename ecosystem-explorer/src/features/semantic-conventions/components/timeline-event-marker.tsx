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
      <div
        aria-hidden="true"
        className="bg-border absolute w-px"
        style={{ left: x, top: 24, height: Math.max(0, top - 24) }}
      />
      <span aria-hidden="true" className="absolute -translate-x-1/2" style={{ left: x, top: 17 }}>
        <TimelineMarkerShape type={event.type} className="h-4 w-4" />
      </span>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(event.id)}
        title={`${typeLabel} · ${formatDate(event.date, locale)}`}
        aria-label={`${event.title}, ${formatDate(event.date, locale)}, ${eventReference(event)}`}
        style={{ left, top, width: MARKER_LABEL_WIDTH }}
        className={`bg-card/90 hover:bg-card focus-visible:ring-primary absolute rounded-r-md border border-l-2 px-2 py-1 text-left text-[10px] leading-tight shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${style.accentBorderClass} ${
          selected ? "border-primary/50 bg-primary/10 ring-primary/40 ring-1" : "border-border/60"
        }`}
      >
        <span className="text-foreground block truncate font-semibold">{event.short}</span>
        <span className="text-muted-foreground block truncate">
          {formatMonthYear(event.date, locale)} · {eventReference(event)}
        </span>
      </button>
    </>
  );
}
