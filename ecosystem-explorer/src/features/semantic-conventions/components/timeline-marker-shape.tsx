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

import type { TimelineEventType } from "../types";
import { getEventTypeStyle } from "../utils/timeline-colors";

interface TimelineMarkerShapeProps {
  type: TimelineEventType;
  className?: string;
}

/** A small circle/square/diamond swatch shared by the chart's markers and the legend. */
export function TimelineMarkerShape({ type, className }: TimelineMarkerShapeProps) {
  const style = getEventTypeStyle(type);
  const shapeClass =
    style.shape === "circle" ? "rounded-full" : style.shape === "diamond" ? "rotate-45" : "";

  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 shrink-0 border-2 ${style.markerClass} ${shapeClass} ${className ?? ""}`}
    />
  );
}
