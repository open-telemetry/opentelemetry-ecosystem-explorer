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

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TimelineEvent, TimelineLaneDef } from "../types";
import { positionFraction, timelineDateWidth, type TimelineRange } from "../utils/timeline-layout";
import { LANE_LABEL_WIDTH_CLASS, TimelineLane } from "./timeline-lane";

export interface TimelineLaneGroup {
  lane: TimelineLaneDef;
  events: TimelineEvent[];
}

interface TimelineChartProps {
  laneGroups: TimelineLaneGroup[];
  range: TimelineRange;
  selectedId: string | null;
  locale: string;
  onSelect: (id: string) => void;
}

/*
 * The reference file measures every lane's track with its own ResizeObserver. All tracks share
 * the same width here (fixed label column + flexible track), so one observer on a single track
 * element is enough, and every lane is laid out from that one measurement.
 */
export function TimelineChart({
  laneGroups,
  range,
  selectedId,
  locale,
  onSelect,
}: TimelineChartProps) {
  const { t } = useTranslation("semantic-conventions");
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    setTrackWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setTrackWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const yearTicks = useMemo(() => {
    if (trackWidth === 0) return [];
    const ticks: { year: number; x: number }[] = [];
    for (let year = range.startYear; year <= range.endYear; year++) {
      ticks.push({
        year,
        x: positionFraction(`${year}-01-01`, range) * timelineDateWidth(trackWidth),
      });
    }
    return ticks;
  }, [range, trackWidth]);

  if (laneGroups.length === 0) {
    return <p className="text-muted-foreground p-8 text-center text-sm">{t("timeline.empty")}</p>;
  }

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={t("timeline.chartAriaLabel")}
      className="overflow-x-auto"
    >
      <div className="min-w-[46rem]">
        <div className="border-border flex border-b">
          <div className={LANE_LABEL_WIDTH_CLASS} />
          <div ref={trackRef} className="relative mx-3 h-11 flex-1">
            {yearTicks.map(({ year, x }) => (
              <span
                key={year}
                className="text-muted-foreground border-border absolute top-3 bottom-0 border-l pl-1 text-xs font-semibold"
                style={{ left: x }}
              >
                {year}
              </span>
            ))}
          </div>
        </div>
        {laneGroups.map(({ lane, events }) => (
          <TimelineLane
            key={lane.id}
            lane={lane}
            events={events}
            trackWidthPx={trackWidth}
            range={range}
            selectedId={selectedId}
            locale={locale}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
