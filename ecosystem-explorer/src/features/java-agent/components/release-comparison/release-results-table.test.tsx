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

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ReleaseResultsTable } from "./release-results-table";
import type { InstrumentationReleaseDiff } from "@/features/java-agent/hooks/use-release-diff";

function makeRow(
  name: string,
  status: InstrumentationReleaseDiff["status"],
  displayName = name,
  partial: Partial<InstrumentationReleaseDiff> = {}
): InstrumentationReleaseDiff {
  return {
    name,
    displayName,
    status,
    metricsAdded: 0,
    metricsRemoved: 0,
    metricsChanged: 0,
    spansAdded: 0,
    spansRemoved: 0,
    spansChanged: 0,
    ...partial,
  };
}

function renderTable(diffs: InstrumentationReleaseDiff[]) {
  return render(
    <BrowserRouter>
      <ReleaseResultsTable diffs={diffs} fromVersion="2.26.1" toVersion="2.27.0" />
    </BrowserRouter>
  );
}

describe("ReleaseResultsTable", () => {
  it("renders non-unchanged rows by default", () => {
    renderTable([
      makeRow("added-lib", "added"),
      makeRow("changed-lib", "changed"),
      makeRow("unchanged-lib", "unchanged"),
    ]);
    expect(screen.getByText("added-lib")).toBeInTheDocument();
    expect(screen.getByText("changed-lib")).toBeInTheDocument();
    expect(screen.queryByText("unchanged-lib")).not.toBeInTheDocument();
  });

  it("shows unchanged rows when the toggle is clicked", () => {
    renderTable([makeRow("changed-lib", "changed"), makeRow("unchanged-lib", "unchanged")]);
    fireEvent.click(screen.getByRole("button", { name: /show .* unchanged/i }));
    expect(screen.getByText("unchanged-lib")).toBeInTheDocument();
  });

  it("hides unchanged rows again when the toggle is clicked a second time", () => {
    renderTable([makeRow("changed-lib", "changed"), makeRow("unchanged-lib", "unchanged")]);
    const toggle = screen.getByRole("button", { name: /show .* unchanged/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.queryByText("unchanged-lib")).not.toBeInTheDocument();
  });

  it("does not render the unchanged toggle when no unchanged rows exist", () => {
    renderTable([makeRow("added-lib", "added")]);
    expect(screen.queryByRole("button", { name: /unchanged/i })).not.toBeInTheDocument();
  });

  it("filters rows by instrumentation name", () => {
    renderTable([makeRow("akka-actor", "added"), makeRow("spring-webmvc", "added")]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "akka" } });
    expect(screen.getByText("akka-actor")).toBeInTheDocument();
    expect(screen.queryByText("spring-webmvc")).not.toBeInTheDocument();
  });

  it("filters rows by display name", () => {
    renderTable([makeRow("akka-actor-2.3", "added", "Akka Actor")]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "akka" } });
    expect(screen.getByText("Akka Actor")).toBeInTheDocument();
  });

  it("shows the empty-state message when no rows match the filter", () => {
    renderTable([makeRow("spring-webmvc", "added")]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByText(/no instrumentations match/i)).toBeInTheDocument();
  });

  it("links added rows to the toVersion detail page", () => {
    renderTable([makeRow("akka-actor", "added")]);
    const link = screen.getByRole("link", { name: /view akka-actor/i });
    expect(link).toHaveAttribute("href", "/java-agent/instrumentation/2.27.0/akka-actor");
  });

  it("links changed rows to the toVersion detail page", () => {
    renderTable([makeRow("spring-webmvc", "changed")]);
    const link = screen.getByRole("link", { name: /view spring-webmvc/i });
    expect(link).toHaveAttribute("href", "/java-agent/instrumentation/2.27.0/spring-webmvc");
  });

  it("links removed rows to the fromVersion detail page", () => {
    renderTable([makeRow("old-lib", "removed")]);
    const link = screen.getByRole("link", { name: /view old-lib/i });
    expect(link).toHaveAttribute("href", "/java-agent/instrumentation/2.26.1/old-lib");
  });

  it("renders the row count summary", () => {
    renderTable([makeRow("a", "added"), makeRow("b", "changed"), makeRow("c", "unchanged")]);
    // unchanged hidden by default → showing 2 of 3
    expect(screen.getByText(/showing 2 of 3/i)).toBeInTheDocument();
  });

  it("renders the display name and raw name when they differ", () => {
    renderTable([makeRow("akka-actor-2.3", "added", "Akka Actor")]);
    expect(screen.getByText("Akka Actor")).toBeInTheDocument();
    expect(screen.getByText("akka-actor-2.3")).toBeInTheDocument();
  });

  it("does not render the raw name when it equals the display name", () => {
    renderTable([makeRow("akka-actor", "added", "akka-actor")]);
    // Only one element with this text — the display name cell; raw-name code block absent
    expect(screen.getAllByText("akka-actor")).toHaveLength(1);
  });

  it("renders status badges", () => {
    renderTable([
      makeRow("a", "added"),
      makeRow("b", "removed"),
      makeRow("c", "changed"),
    ]);
    expect(screen.getByText("added")).toBeInTheDocument();
    expect(screen.getByText("removed")).toBeInTheDocument();
    expect(screen.getByText("changed")).toBeInTheDocument();
  });
});
