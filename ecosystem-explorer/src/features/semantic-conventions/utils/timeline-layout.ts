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
const FIRST_ROW_TOP = 16;
export const MARKER_SIZE = 16;
const LABEL_OFFSET = MARKER_SIZE / 2 + MARKER_PAD;

/** Reserve room after the date axis for the final marker's right-hand label. */
export function timelineDateWidth(trackWidthPx: number): number {
  return Math.max(0, trackWidthPx - LABEL_OFFSET - MARKER_LABEL_WIDTH);
}

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

/**
 * Pack each date marker and its right-hand label as one interval. The date axis reserves
 * a label-width gutter so even a marker at the end of the range has room for its label.
 * `events` must already be sorted by date.
 */
export function layoutLaneMarkers(
  events: TimelineEvent[],
  trackWidthPx: number,
  range: TimelineRange
): LaneLayoutResult {
  const dateWidth = timelineDateWidth(trackWidthPx);
  const rows: { left: number; right: number }[][] = [];
  const markers: LaidOutMarker[] = events.map((event) => {
    const x = positionFraction(event.date, range) * dateWidth;
    const left = x + LABEL_OFFSET;
    const bounds = {
      left: Math.min(left, x - MARKER_SIZE / 2),
      right: Math.max(left + MARKER_LABEL_WIDTH, x + MARKER_SIZE / 2),
    };
    let row = rows.findIndex((intervals) =>
      intervals.every(
        (interval) =>
          bounds.right + MARKER_PAD <= interval.left || interval.right + MARKER_PAD <= bounds.left
      )
    );
    if (row < 0) {
      row = rows.length;
      rows.push([]);
    }
    rows[row].push(bounds);
    return { event, x, left, top: FIRST_ROW_TOP + row * ROW_HEIGHT, row };
  });

  const rowCount = Math.max(1, rows.length);
  return { markers, rowCount, trackHeight: FIRST_ROW_TOP + rowCount * ROW_HEIGHT };
}
