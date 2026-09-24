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

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { TimelineData } from "@/features/semantic-conventions/types";
import { EVENT_TYPES } from "@/features/semantic-conventions/utils/timeline-colors";

const data: TimelineData = JSON.parse(
  readFileSync("public/data/semantic-conventions/timeline.json", "utf8")
);

function domainHistory(lane: string) {
  return data.events
    .filter((event) => event.lane === lane)
    .sort((a, b) => a.date.localeCompare(b.date));
}

describe("curated timeline data", () => {
  it("excludes background milestones and their lane from all curated events", () => {
    expect(data.lanes.some((lane) => lane.id === "foundation")).toBe(false);
    expect(data.events.some((event) => event.lane === "foundation")).toBe(false);
    expect(EVENT_TYPES).not.toContain("tooling");
    expect(EVENT_TYPES).not.toContain("release");
    for (const id of [
      "first-release",
      "separate-repo",
      "requirements-stable",
      "entities-and-deprecation",
      "entity-policies",
    ]) {
      expect(data.events.some((event) => event.id === id)).toBe(false);
    }
  });

  it("keeps HTTP's feature freeze before stability and excludes the later list repair", () => {
    expect(domainHistory("http").map(({ id, release }) => [id, release])).toEqual([
      ["http-origin", null],
      ["http-baseline", "1.20.0"],
      ["http-freeze", "1.21.0"],
      ["http-stable", "1.23.0"],
    ]);
    expect(domainHistory("http").filter((event) => event.type === "deprecation")).toEqual([]);
  });

  it("tells the database lifecycle without an isolated attribute migration", () => {
    expect(domainHistory("db").map((event) => event.id)).toEqual([
      "db-origin",
      "db-baseline",
      "db-rc",
      "db-stable",
    ]);
  });

  it("dates process RC independently from Kubernetes metric promotions", () => {
    expect(data.events.find((event) => event.id === "process-rc")).toMatchObject({
      lane: "runtime",
      release: "1.43.0",
      date: "2026-07-03",
      type: "stability",
    });
    expect(data.events.find((event) => event.id === "k8s-memory-rc")).toMatchObject({
      lane: "k8s",
      release: "1.44.0",
      date: "2026-08-04",
      type: "stability",
    });
    expect(data.events.find((event) => event.id === "k8s-cpu-rc")).toMatchObject({
      lane: "k8s",
      release: "1.42.0",
      type: "stability",
    });
  });

  it("uses valid chart categories, lanes, unique IDs, and consistent release dates", () => {
    expect(new Set(data.events.map((event) => event.id)).size).toBe(data.events.length);
    for (const event of data.events) {
      expect(EVENT_TYPES).toContain(event.type);
      expect(data.lanes.some((lane) => lane.id === event.lane)).toBe(true);
      expect(new Date(event.date).toISOString().slice(0, 10)).toBe(event.date);
      expect(new URL(event.source).protocol).toBe("https:");
      if (event.release) {
        expect(event.date).toBe(data.dates[event.release]);
      } else {
        expect(event.dateBasis).toBe("specification-commit");
        expect(event.source).toContain(`/commit/${event.commit}`);
      }
    }
  });

  it("uses the actual unprefixed 1.27.0 changelog heading", () => {
    expect(data.events.find((event) => event.id === "messaging-rework")?.source).toMatch(/#1270$/);
  });
});
