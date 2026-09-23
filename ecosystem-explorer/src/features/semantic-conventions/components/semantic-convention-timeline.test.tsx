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

import { StrictMode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SemanticConventionTimeline } from "./semantic-convention-timeline";
import type { TimelineData } from "../types";

function domainOptionLabels() {
  return within(screen.getByLabelText("Domain"))
    .getAllByRole("option")
    .map((option) => option.textContent);
}

function typeOptionLabels() {
  return within(screen.getByLabelText("Event type"))
    .getAllByRole("option")
    .map((option) => option.textContent);
}

const SAMPLE_DATA: TimelineData = {
  lanes: [
    { id: "http", title: "HTTP", subtitle: "Core conventions" },
    { id: "db", title: "Database", subtitle: "Core conventions" },
    // Defined in the dataset but with zero events below - must never appear as a domain
    // dropdown option, since selecting it could only ever produce an empty timeline.
    { id: "rpc", title: "RPC", subtitle: "Core conventions" },
  ],
  events: [
    {
      id: "http-origin",
      lane: "http",
      release: null,
      pullRequest: 82,
      type: "domain",
      short: "HTTP enters the spec",
      title: "HTTP client and server conventions enter the specification",
      detail: "HTTP detail.",
      source: "https://example.com/http-origin",
      major: true,
      date: "2019-06-13",
    },
    {
      id: "http-stable",
      lane: "http",
      release: "1.23.0",
      type: "stability",
      short: "Core stable",
      title: "Core HTTP semantic conventions stabilize",
      detail: "HTTP stable detail.",
      source: "https://example.com/http-stable",
      major: true,
      date: "2023-11-03",
    },
    {
      id: "db-origin",
      lane: "db",
      release: null,
      pullRequest: 19,
      type: "domain",
      short: "DB enters the spec",
      title: "Database client conventions enter the specification",
      detail: "DB detail.",
      source: "https://example.com/db-origin",
      major: true,
      date: "2019-05-23",
    },
    {
      id: "db-minor-change",
      lane: "db",
      release: "1.25.0",
      type: "change",
      short: "Minor db change",
      title: "A minor database change",
      detail: "DB minor detail.",
      source: "https://example.com/db-minor",
      major: false,
      date: "2024-01-01",
    },
  ],
  dates: {},
};

describe("SemanticConventionTimeline", () => {
  it("defaults to major-milestone scope and selects the earliest visible event", () => {
    render(<SemanticConventionTimeline data={SAMPLE_DATA} />);

    // major scope excludes the non-major "db-minor-change" event: 3 major events, 2 domains.
    expect(screen.getByRole("status")).toHaveTextContent("3 milestones");
    expect(screen.getByRole("status")).toHaveTextContent("2 domains");

    // Earliest major event overall is db-origin (2019-05-23).
    expect(
      screen.getByText("Database client conventions enter the specification")
    ).toBeInTheDocument();
  });

  it("narrows the visible events when a domain is selected", () => {
    render(<SemanticConventionTimeline data={SAMPLE_DATA} />);

    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "http" } });

    expect(screen.getByRole("status")).toHaveTextContent("2 milestones · 1 domain");
  });

  it("updates the detail panel and marker state when a marker is clicked", () => {
    render(<SemanticConventionTimeline data={SAMPLE_DATA} />);

    const marker = screen.getByRole("button", {
      name: /Core HTTP semantic conventions stabilize/,
    });
    expect(marker).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(marker);

    expect(marker).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("HTTP stable detail.")).toBeInTheDocument();
  });

  it("brings details into view and focuses them on narrow screens", () => {
    const media = vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
    } as MediaQueryList);
    try {
      render(<SemanticConventionTimeline data={SAMPLE_DATA} />);
      const details = screen.getByRole("complementary", { name: "Milestone details" });
      const scroll = vi.spyOn(details, "scrollIntoView");
      scroll.mockClear();

      fireEvent.click(
        screen.getByRole("button", {
          name: /Core HTTP semantic conventions stabilize/,
        })
      );

      expect(details).toHaveFocus();
      expect(details).toHaveTextContent("HTTP stable detail.");
      expect(scroll).toHaveBeenCalledWith({ block: "start" });
    } finally {
      media.mockRestore();
    }
  });

  it("restores the default filters and selection on reset", () => {
    render(<SemanticConventionTimeline data={SAMPLE_DATA} />);

    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "http" } });
    expect(screen.getByRole("status")).toHaveTextContent("2 milestones · 1 domain");

    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));

    expect(screen.getByLabelText("Domain")).toHaveValue("all");
    expect(screen.getByRole("status")).toHaveTextContent("3 milestones");
    expect(screen.getByRole("status")).toHaveTextContent("2 domains");
  });

  it("only lists domains that can actually produce a result", () => {
    render(<SemanticConventionTimeline data={SAMPLE_DATA} />);

    // "RPC" has zero events in the dataset and must never be offered, since picking it
    // could only ever land on an empty timeline.
    expect(domainOptionLabels()).toEqual(["All domains", "HTTP", "Database"]);
  });

  it("only lists event types that can actually produce a result", () => {
    render(<SemanticConventionTimeline data={SAMPLE_DATA} />);

    // No event in the sample data is type "removed", so it must never be offered.
    expect(typeOptionLabels()).not.toContain("Removed");
    expect(typeOptionLabels()).toEqual(
      expect.arrayContaining(["All event types", "Introduced", "Stability"])
    );
  });

  it("narrows the domain options further once an event type is selected", () => {
    render(<SemanticConventionTimeline data={SAMPLE_DATA} />);

    // Include the non-major "db-minor-change" event so "change" has a match at all.
    fireEvent.change(screen.getByLabelText("Milestones"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "change" } });

    // Only the database lane has a "change" event; HTTP is no longer offered.
    expect(domainOptionLabels()).toEqual(["All domains", "Database"]);
  });

  it("clears an event-type selection that a scope change makes unavailable", () => {
    render(<SemanticConventionTimeline data={SAMPLE_DATA} />);

    // "change" only exists on the non-major db-minor-change event, so it's only selectable
    // once "All curated milestones" is active.
    fireEvent.change(screen.getByLabelText("Milestones"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "change" } });
    expect(screen.getByRole("status")).toHaveTextContent("1 milestone · 1 domain");

    // Switching back to major-only milestones removes the only "change" event, so the
    // selection must fall back to "all" instead of silently showing nothing.
    fireEvent.change(screen.getByLabelText("Milestones"), { target: { value: "major" } });

    expect(screen.getByLabelText("Event type")).toHaveValue("all");
    expect(screen.getByRole("status")).toHaveTextContent("3 milestones");
    expect(screen.getByRole("status")).toHaveTextContent("2 domains");
  });

  it("does not reactivate a filter that the UI has already reset to All", () => {
    render(<SemanticConventionTimeline data={SAMPLE_DATA} />);

    fireEvent.change(screen.getByLabelText("Milestones"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "db" } });
    fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "change" } });

    // Major-only scope drops the single "change" event, so both dependent filters reset.
    fireEvent.change(screen.getByLabelText("Milestones"), { target: { value: "major" } });
    expect(screen.getByLabelText("Domain")).toHaveValue("all");
    expect(screen.getByLabelText("Event type")).toHaveValue("all");

    // "Introduced" makes the database lane selectable again; the cleared domain must stay cleared.
    fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "domain" } });

    expect(screen.getByLabelText("Domain")).toHaveValue("all");
    expect(screen.getByRole("status")).toHaveTextContent("2 milestones · 2 domains");
  });

  it("reconciles filters without render-phase state updates under StrictMode", () => {
    render(
      <StrictMode>
        <SemanticConventionTimeline data={SAMPLE_DATA} />
      </StrictMode>
    );

    fireEvent.change(screen.getByLabelText("Milestones"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "db" } });
    fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "change" } });
    expect(screen.getByRole("status")).toHaveTextContent("1 milestone · 1 domain");

    // StrictMode renders every commit twice; the filters must settle on the same reconciled
    // values either way, with no stale value left to reactivate.
    fireEvent.change(screen.getByLabelText("Milestones"), { target: { value: "major" } });
    expect(screen.getByLabelText("Domain")).toHaveValue("all");
    expect(screen.getByLabelText("Event type")).toHaveValue("all");
    expect(screen.getByRole("status")).toHaveTextContent("3 milestones · 2 domains");
  });

  it("keeps the legend aligned with scope, domain, and event-type filters", () => {
    render(<SemanticConventionTimeline data={SAMPLE_DATA} />);
    const legendLabels = () =>
      within(screen.getByRole("group", { name: "Legend" }))
        .getAllByRole("button")
        .map((button) => button.textContent);

    expect(legendLabels()).toEqual(["Introduced", "Stability"]);
    fireEvent.change(screen.getByLabelText("Milestones"), { target: { value: "all" } });
    expect(legendLabels()).toEqual(["Introduced", "Stability", "Changed"]);
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "db" } });
    expect(legendLabels()).toEqual(["Introduced", "Changed"]);
    fireEvent.change(screen.getByLabelText("Event type"), { target: { value: "change" } });
    expect(legendLabels()).toEqual(["Changed"]);

    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(legendLabels()).toEqual(["Introduced", "Stability"]);
  });

  it("shows the empty state when the dataset has no events at all", () => {
    render(<SemanticConventionTimeline data={{ ...SAMPLE_DATA, events: [] }} />);

    expect(screen.queryByRole("group", { name: "Legend" })).not.toBeInTheDocument();
    expect(screen.getByText("No milestones match these filters.")).toBeInTheDocument();
    expect(screen.getByText("Select a milestone to see its details.")).toBeInTheDocument();
  });
});
