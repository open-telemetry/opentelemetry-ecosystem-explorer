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
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SemanticConventionTimeline } from "@/features/semantic-conventions/components/semantic-convention-timeline";
import type { TimelineData } from "@/features/semantic-conventions/types";

const data: TimelineData = JSON.parse(
  readFileSync("public/data/semantic-conventions/timeline.json", "utf8")
);

describe("de facto baseline milestones", () => {
  it("dates documented baselines to their releases and includes them in major stories", () => {
    const baselines = data.events.filter((event) => event.type === "baseline");
    expect(baselines.map(({ id, release, date }) => [id, release, date])).toEqual([
      ["http-baseline", "1.20.0", "2023-04-07"],
      ["db-baseline", "1.24.0", "2023-12-15"],
      ["messaging-baseline", "1.24.0", "2023-12-15"],
      ["rpc-baseline", "1.37.0", "2025-08-25"],
      ["system-baseline", "1.21.0", "2023-07-13"],
      ["process-baseline", "1.21.0", "2023-07-13"],
      ["genai-baseline", "1.36.0", "2025-07-05"],
    ]);
    for (const event of baselines) {
      expect(event.major).toBe(true);
      expect(event.date).toBe(data.dates[event.release!]);
      expect(data.lanes.some((lane) => lane.id === event.lane)).toBe(true);
      expect(event.source).toContain(
        "https://github.com/open-telemetry/semantic-conventions/blob/v"
      );
    }
    expect(new Set(data.events.map((event) => event.id)).size).toBe(data.events.length);
  });

  it("filters real baseline events and shows the release date, explanation, and evidence", () => {
    render(<SemanticConventionTimeline data={data} />);
    fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "baseline" } });
    expect(screen.getByRole("status")).toHaveTextContent("7 milestones · 6 domains");
    expect(within(screen.getByLabelText("Domain")).queryByText("JVM")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "http" } });
    expect(screen.getByRole("status")).toHaveTextContent("1 milestone · 1 domain");
    expect(
      screen.getByRole("button", { name: /HTTP de facto baseline v1.20.0 is released/ })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Release date (UTC)")).toBeInTheDocument();
    expect(screen.getByText(/not when the guidance was added/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View source" })).toHaveAttribute(
      "href",
      "https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/docs/http/README.md"
    );
    expect(
      screen.queryByRole("button", { name: /Core HTTP semantic conventions stabilize/ })
    ).not.toBeInTheDocument();
  });
});
