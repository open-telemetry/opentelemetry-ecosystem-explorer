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

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TimelineEvent, TimelineLaneDef } from "../types";
import { durationLabel, layoutLaneMarkers, type TimelineRange } from "../utils/timeline-layout";
import { TimelineEventMarker } from "./timeline-event-marker";

export const LANE_LABEL_WIDTH_CLASS = "w-40 shrink-0";

interface TimelineLaneProps {
  lane: TimelineLaneDef;
  events: TimelineEvent[];
  trackWidthPx: number;
  range: TimelineRange;
  selectedId: string | null;
  locale: string;
  onSelect: (id: string) => void;
}

export function TimelineLane({
  lane,
  events,
  trackWidthPx,
  range,
  selectedId,
  locale,
  onSelect,
}: TimelineLaneProps) {
  const { t } = useTranslation("semantic-conventions");
  const { markers, trackHeight } = useMemo(
    () => layoutLaneMarkers(events, trackWidthPx, range),
    [events, trackWidthPx, range]
  );

  return (
    <div className="border-border/60 flex border-b last:border-0">
      <div className={`${LANE_LABEL_WIDTH_CLASS} bg-background sticky left-0 z-[1] py-3 pr-4 pl-4`}>
        <strong className="text-foreground block text-sm">{lane.title}</strong>
        <small className="text-muted-foreground mt-0.5 block text-xs">{lane.subtitle}</small>
        {events.length > 1 && (
          <small className="text-primary mt-2 block text-xs font-medium">
            {t("timeline.lane.elapsed", {
              duration: durationLabel(events[0].date, events[events.length - 1].date),
            })}
          </small>
        )}
      </div>
      {/* Keep markers within the track, behind the sticky lane label when scrolling. */}
      <div className="relative isolate mx-3 flex-1" style={{ height: trackHeight }}>
        {markers.map((marker) => (
          <TimelineEventMarker
            key={marker.event.id}
            marker={marker}
            selected={marker.event.id === selectedId}
            locale={locale}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
