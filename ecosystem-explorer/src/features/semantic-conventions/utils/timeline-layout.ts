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

import type { TimelineEvent } from "../types";

export function parseUtcDate(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export interface TimelineRange {
  startMs: number;
  endMs: number;
  startYear: number;
  /** Last year rendered on the axis (inclusive). */
  endYear: number;
}

/*
 * Unlike the reference file's hardcoded Jan 2019-Dec 2026 axis, the range is derived from the
 * data: floor the earliest event's year to Jan 1, and leave one full calendar year of headroom
 * past the year containing the newest event. This way the axis keeps making sense as a future
 * watcher appends new events, with no code change required.
 */
export function computeTimelineRange(events: TimelineEvent[]): TimelineRange {
  if (events.length === 0) {
    const year = new Date().getUTCFullYear();
    return {
      startMs: Date.UTC(year, 0, 1),
      endMs: Date.UTC(year + 2, 0, 1),
      startYear: year,
      endYear: year + 1,
    };
  }

  let minYear = Infinity;
  let maxYear = -Infinity;
  for (const event of events) {
    const year = new Date(parseUtcDate(event.date)).getUTCFullYear();
    if (year < minYear) minYear = year;
    if (year > maxYear) maxYear = year;
  }

  const startYear = minYear;
  const endYear = maxYear + 1;
  return {
    startMs: Date.UTC(startYear, 0, 1),
    endMs: Date.UTC(endYear + 1, 0, 1),
    startYear,
    endYear,
  };
}

export function positionFraction(iso: string, range: TimelineRange): number {
  return (parseUtcDate(iso) - range.startMs) / (range.endMs - range.startMs);
}

export function formatDate(iso: string, locale: string): string {
  return new Date(parseUtcDate(iso)).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonthYear(iso: string, locale: string): string {
  return new Date(parseUtcDate(iso)).toLocaleDateString(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function eventReference(event: TimelineEvent): string {
  return event.release ? `v${event.release}` : `spec PR #${event.pullRequest}`;
}

/** UTC year/month difference formatted like "1y 4m", or "<1m" for anything under a month. */
export function durationLabel(fromIso: string, toIso: string): string {
  const from = new Date(parseUtcDate(fromIso));
  const to = new Date(parseUtcDate(toIso));
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months--;

  const years = Math.floor(months / 12);
  const remainderMonths = months % 12;
  const parts: string[] = [];
  if (years >= 1) parts.push(`${years}y`);
  if (remainderMonths) parts.push(`${remainderMonths}m`);
  return parts.join(" ") || "<1m";
}

const MARKER_PAD = 8;
export const MARKER_LABEL_WIDTH = 200;
const ROW_HEIGHT = 53;
const FIRST_ROW_TOP = 43;

export interface LaidOutMarker {
  event: TimelineEvent;
  x: number;
  left: number;
  top: number;
  row: number;
}

export interface LaneLayoutResult {
  markers: LaidOutMarker[];
  rowCount: number;
  trackHeight: number;
}

/*
 * Greedy row-packing so event label cards never overlap: each event's label sits at its date's
 * x position (clamped so it doesn't run past either edge of the track), and drops into the first
 * row whose previous label has already cleared. Ported from the reference file's vanilla-JS
 * `layout()` function, which is small, well understood, and is the chart's core visual identity.
 * `events` must already be sorted by date.
 */
export function layoutLaneMarkers(
  events: TimelineEvent[],
  trackWidthPx: number,
  range: TimelineRange
): LaneLayoutResult {
  const rowRightEdges: number[] = [];
  const markers: LaidOutMarker[] = events.map((event) => {
    const x = positionFraction(event.date, range) * trackWidthPx;
    const left = Math.max(
      MARKER_PAD,
      Math.min(x - MARKER_PAD, trackWidthPx - MARKER_LABEL_WIDTH - MARKER_PAD)
    );
    let row = rowRightEdges.findIndex((rightEdge) => rightEdge + MARKER_PAD <= left);
    if (row < 0) row = rowRightEdges.length;
    rowRightEdges[row] = left + MARKER_LABEL_WIDTH;
    return { event, x, left, top: FIRST_ROW_TOP + row * ROW_HEIGHT, row };
  });

  const rowCount = Math.max(1, rowRightEdges.length);
  return { markers, rowCount, trackHeight: 51 + rowCount * ROW_HEIGHT };
}

/** The horizontal line connecting the first and last visible marker in a lane, if there are >1. */
export function railBounds(
  events: TimelineEvent[],
  trackWidthPx: number,
  range: TimelineRange
): { left: number; width: number } | null {
  if (events.length < 2) return null;
  const left = positionFraction(events[0].date, range) * trackWidthPx;
  const right = positionFraction(events[events.length - 1].date, range) * trackWidthPx;
  return { left, width: right - left };
}
