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

export type MarkerShape = "circle" | "square" | "diamond";

interface EventTypeStyle {
  shape: MarkerShape;
  /** Border + fill classes for the marker point and the legend swatch. */
  markerClass: string;
  /** Left-border accent used on the event's label card. */
  accentBorderClass: string;
  /** Text color for the type "eyebrow" in the detail panel. */
  textClass: string;
}

/*
 * The reference file assigns each event type a literal hex color via inline CSS. This app keeps
 * all color decisions in Tailwind's token-backed color scale (see `glow-badge.tsx` for the same
 * pattern applied to categorical badges) rather than hardcoding new hex values or adding new CSS
 * custom properties for the categorical set. Shape (circle/square/diamond) is the primary
 * differentiator so color is never the only signal.
 */
const EVENT_TYPE_STYLES: Record<TimelineEventType, EventTypeStyle> = {
  domain: {
    shape: "circle",
    markerClass: "border-blue-500 bg-background dark:border-blue-400",
    accentBorderClass: "border-l-blue-500 dark:border-l-blue-400",
    textClass: "text-blue-700 dark:text-blue-400",
  },
  baseline: {
    shape: "diamond",
    markerClass: "border-blue-500 bg-blue-500 dark:border-blue-400 dark:bg-blue-400",
    accentBorderClass: "border-l-blue-500 dark:border-l-blue-400",
    textClass: "text-blue-700 dark:text-blue-400",
  },
  stability: {
    shape: "circle",
    markerClass: "border-green-600 bg-green-600 dark:border-green-400 dark:bg-green-400",
    accentBorderClass: "border-l-green-600 dark:border-l-green-400",
    textClass: "text-green-800 dark:text-green-400",
  },
  change: {
    shape: "circle",
    markerClass: "border-amber-600 bg-background dark:border-amber-400",
    accentBorderClass: "border-l-amber-600 dark:border-l-amber-400",
    textClass: "text-amber-800 dark:text-amber-400",
  },
  deprecation: {
    shape: "square",
    markerClass: "border-rose-600 bg-background dark:border-rose-400",
    accentBorderClass: "border-l-rose-600 dark:border-l-rose-400",
    textClass: "text-rose-800 dark:text-rose-400",
  },
  removed: {
    shape: "square",
    markerClass: "border-red-600 bg-red-600 dark:border-red-400 dark:bg-red-400",
    accentBorderClass: "border-l-red-600 dark:border-l-red-400",
    textClass: "text-red-700 dark:text-red-400",
  },
  moved: {
    shape: "diamond",
    markerClass: "border-purple-600 bg-background dark:border-purple-400",
    accentBorderClass: "border-l-purple-600 dark:border-l-purple-400",
    textClass: "text-purple-700 dark:text-purple-400",
  },
};

export function getEventTypeStyle(type: TimelineEventType): EventTypeStyle {
  return EVENT_TYPE_STYLES[type];
}

export const EVENT_TYPES: TimelineEventType[] = [
  "domain",
  "baseline",
  "stability",
  "change",
  "deprecation",
  "removed",
  "moved",
];
