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

import { describe, expect, it } from "vitest";
import {
  computeTimelineRange,
  durationLabel,
  eventReference,
  layoutLaneMarkers,
  positionFraction,
  railBounds,
} from "./timeline-layout";
import type { TimelineEvent } from "../types";

function makeEvent(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: "evt",
    lane: "http",
    release: "1.0.0",
    type: "domain",
    short: "short",
    title: "title",
    detail: "detail",
    source: "https://example.com",
    major: true,
    date: "2020-01-01",
    ...overrides,
  };
}

describe("computeTimelineRange", () => {
  it("floors the earliest event's year and leaves a full year of headroom past the latest", () => {
    const range = computeTimelineRange([
      makeEvent({ id: "a", date: "2019-06-13" }),
      makeEvent({ id: "b", date: "2026-08-04" }),
    ]);
    expect(range.startYear).toBe(2019);
    expect(range.endYear).toBe(2027);
    expect(range.startMs).toBe(Date.UTC(2019, 0, 1));
    expect(range.endMs).toBe(Date.UTC(2028, 0, 1));
  });

  it("returns a sane default range for an empty event list", () => {
    const range = computeTimelineRange([]);
    expect(range.endMs).toBeGreaterThan(range.startMs);
  });
});

describe("positionFraction", () => {
  it("maps the range start to 0 and the range end to 1", () => {
    const range = computeTimelineRange([makeEvent({ date: "2020-01-01" })]);
    expect(positionFraction("2020-01-01", range)).toBeCloseTo(0, 5);
  });
});

describe("eventReference", () => {
  it("prefers the release version when present", () => {
    expect(eventReference(makeEvent({ release: "1.23.0" }))).toBe("v1.23.0");
  });

  it("falls back to the spec PR number", () => {
    expect(eventReference(makeEvent({ release: null, pullRequest: 82 }))).toBe("spec PR #82");
  });
});

describe("durationLabel", () => {
  it("formats years and months", () => {
    expect(durationLabel("2019-06-13", "2023-11-03")).toBe("4y 4m");
  });

  it("formats sub-year durations as months only", () => {
    expect(durationLabel("2022-02-10", "2023-12-15")).toBe("1y 10m");
  });

  it("formats sub-month durations as <1m", () => {
    expect(durationLabel("2023-01-01", "2023-01-15")).toBe("<1m");
  });
});

describe("layoutLaneMarkers", () => {
  it("packs non-overlapping events into a single row", () => {
    const range = computeTimelineRange([
      makeEvent({ id: "a", date: "2019-01-01" }),
      makeEvent({ id: "b", date: "2026-01-01" }),
    ]);
    const events = [
      makeEvent({ id: "a", date: "2019-01-01" }),
      makeEvent({ id: "b", date: "2026-01-01" }),
    ];
    const { markers, rowCount } = layoutLaneMarkers(events, 900, range);
    expect(markers).toHaveLength(2);
    expect(rowCount).toBe(1);
  });

  it("drops colliding events into a new row instead of overlapping", () => {
    const range = computeTimelineRange([
      makeEvent({ id: "a", date: "2020-01-01" }),
      makeEvent({ id: "b", date: "2020-01-02" }),
    ]);
    const events = [
      makeEvent({ id: "a", date: "2020-01-01" }),
      makeEvent({ id: "b", date: "2020-01-02" }),
    ];
    const { markers, rowCount } = layoutLaneMarkers(events, 900, range);
    expect(rowCount).toBe(2);
    expect(markers[0].row).not.toBe(markers[1].row);
  });
});

describe("railBounds", () => {
  it("returns null when fewer than two events are visible", () => {
    const range = computeTimelineRange([makeEvent({ date: "2020-01-01" })]);
    expect(railBounds([makeEvent({ date: "2020-01-01" })], 900, range)).toBeNull();
  });

  it("spans from the first to the last event when there are at least two", () => {
    const events = [
      makeEvent({ id: "a", date: "2019-01-01" }),
      makeEvent({ id: "b", date: "2026-01-01" }),
    ];
    const range = computeTimelineRange(events);
    const bounds = railBounds(events, 900, range);
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThan(0);
  });
});
