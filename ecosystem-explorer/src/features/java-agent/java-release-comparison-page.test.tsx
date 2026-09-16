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
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { JavaReleaseComparisonPage } from "./java-release-comparison-page";
import type { InstrumentationDiff, ReleaseDiff } from "./utils/release-diff";

vi.mock("@/hooks/use-javaagent-data", () => ({
  useVersions: vi.fn(),
}));

vi.mock("./hooks/use-release-comparison", () => ({
  useReleaseComparison: vi.fn(),
}));

vi.mock("@/components/ui/back-button", () => ({
  BackButton: () => <button>Back</button>,
}));

import { useVersions } from "@/hooks/use-javaagent-data";
import { useReleaseComparison } from "./hooks/use-release-comparison";

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

async function selectStatus(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("button", { name: "Status" }));
  await user.click(await screen.findByRole("menuitem", { name: label }));
}

function renderPage(initialPath = "/java-agent/releases?from=1.0.0&to=2.0.0") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/java-agent/releases" element={<JavaReleaseComparisonPage />} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>
  );
}

const mockVersions = {
  data: {
    versions: [
      { version: "2.0.0", is_latest: true },
      { version: "1.0.0", is_latest: false },
    ],
  },
  loading: false,
  error: null,
};

function makeInstrumentation(
  id: string,
  status: InstrumentationDiff["status"],
  telemetry: { spans?: number; metrics?: number } = {}
): InstrumentationDiff {
  const { spans = 0, metrics = 0 } = telemetry;
  return {
    id,
    displayName: `${id} Display`,
    status,
    telemetryDiff: {
      spans: Array.from({ length: spans }, () => ({
        status: "changed" as const,
        span: { span_kind: "CLIENT" as const },
      })),
      metrics: Array.from({ length: metrics }, (_, i) => ({
        status: "changed" as const,
        metric: {
          name: `metric-${i}`,
          description: "",
          instrument: "counter" as const,
          data_type: "COUNTER" as const,
          unit: "1",
        },
      })),
    },
  };
}

function makeDiff(): ReleaseDiff {
  return {
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    instrumentations: [
      makeInstrumentation("added-1", "added"),
      makeInstrumentation("changed-1", "changed"),
      makeInstrumentation("removed-1", "removed"),
      makeInstrumentation("unchanged-1", "unchanged"),
    ],
    aggregateMetrics: [],
    totals: { added: 1, changed: 1, removed: 1 },
  };
}

describe("JavaReleaseComparisonPage status filter", () => {
  beforeEach(() => {
    vi.mocked(useVersions).mockReturnValue(mockVersions);
    vi.mocked(useReleaseComparison).mockReturnValue({
      diff: makeDiff(),
      loading: false,
      error: null,
    });
  });

  it("shows all changed modules and correct summary counts when no filter is applied", () => {
    renderPage();

    expect(screen.getByText("added-1 Display")).toBeInTheDocument();
    expect(screen.getByText("changed-1 Display")).toBeInTheDocument();
    expect(screen.getByText("removed-1 Display")).toBeInTheDocument();
    expect(screen.queryByText("unchanged-1 Display")).not.toBeInTheDocument();

    const addedTile = screen.getByText("Modules Added").previousSibling as HTMLElement;
    expect(addedTile.textContent).toBe("1");
  });

  it("narrows the module list and updates the URL when a status is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await selectStatus(user, "Added");

    expect(screen.getByText("added-1 Display")).toBeInTheDocument();
    expect(screen.queryByText("changed-1 Display")).not.toBeInTheDocument();
    expect(screen.queryByText("removed-1 Display")).not.toBeInTheDocument();

    expect(screen.getByTestId("location").textContent).toContain("status=added");
  });

  it("switching the selection replaces the previous filter rather than combining with it", async () => {
    const user = userEvent.setup();
    renderPage();

    await selectStatus(user, "Added");
    expect(screen.getByTestId("location").textContent).toContain("status=added");

    await selectStatus(user, "Removed");

    expect(screen.getByTestId("location").textContent).toContain("status=removed");
    expect(screen.getByTestId("location").textContent).not.toContain("added");
    expect(screen.queryByText("added-1 Display")).not.toBeInTheDocument();
    expect(screen.getByText("removed-1 Display")).toBeInTheDocument();
  });

  it("selecting 'All Statuses' clears the status param and restores the full list", async () => {
    const user = userEvent.setup();
    renderPage("/java-agent/releases?from=1.0.0&to=2.0.0&status=added");

    expect(screen.getByRole("button", { name: "Status" })).toHaveTextContent("Added");

    await selectStatus(user, "All Statuses");

    expect(screen.getByTestId("location").textContent).not.toContain("status=");
    expect(screen.getByText("added-1 Display")).toBeInTheDocument();
    expect(screen.getByText("changed-1 Display")).toBeInTheDocument();
    expect(screen.getByText("removed-1 Display")).toBeInTheDocument();
  });

  it("does not change the Changes Summary stat tiles when a filter is applied", async () => {
    const user = userEvent.setup();
    renderPage();

    const addedTile = screen.getByText("Modules Added").previousSibling as HTMLElement;
    const changedTile = screen.getByText("Modules Changed").previousSibling as HTMLElement;
    const removedTile = screen.getByText("Modules Removed").previousSibling as HTMLElement;
    const before = [addedTile.textContent, changedTile.textContent, removedTile.textContent];

    await selectStatus(user, "Added");

    const after = [addedTile.textContent, changedTile.textContent, removedTile.textContent];
    expect(after).toEqual(before);
  });

  it("pre-filters the list when the status param is present on initial load", () => {
    renderPage("/java-agent/releases?from=1.0.0&to=2.0.0&status=removed");

    expect(screen.queryByText("added-1 Display")).not.toBeInTheDocument();
    expect(screen.queryByText("changed-1 Display")).not.toBeInTheDocument();
    expect(screen.getByText("removed-1 Display")).toBeInTheDocument();
  });

  it("degrades gracefully to showing everything when the status param is invalid", () => {
    renderPage("/java-agent/releases?from=1.0.0&to=2.0.0&status=bogus");

    expect(screen.getByText("added-1 Display")).toBeInTheDocument();
    expect(screen.getByText("changed-1 Display")).toBeInTheDocument();
    expect(screen.getByText("removed-1 Display")).toBeInTheDocument();
  });

  it("shows the filtered-empty state when the selection matches nothing, distinct from no-changes", async () => {
    const user = userEvent.setup();
    vi.mocked(useReleaseComparison).mockReturnValue({
      diff: {
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        instrumentations: [makeInstrumentation("added-1", "added")],
        aggregateMetrics: [],
        totals: { added: 1, changed: 0, removed: 0 },
      },
      loading: false,
      error: null,
    });
    renderPage();

    await selectStatus(user, "Removed");

    expect(screen.getByText("No modules match the selected filters.")).toBeInTheDocument();
    expect(
      screen.queryByText("No changes found in telemetry or configuration.")
    ).not.toBeInTheDocument();
  });

  it("shows the no-changes empty state when there are no changes at all and no filter is active", () => {
    vi.mocked(useReleaseComparison).mockReturnValue({
      diff: {
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        instrumentations: [makeInstrumentation("unchanged-1", "unchanged")],
        aggregateMetrics: [],
        totals: { added: 0, changed: 0, removed: 0 },
      },
      loading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("No changes found in telemetry or configuration.")).toBeInTheDocument();
  });

  it("preserves status filter parameter when auto-filling missing from/to versions", () => {
    renderPage("/java-agent/releases?status=added");

    expect(screen.getByTestId("location").textContent).toContain("status=added");
    expect(screen.getByTestId("location").textContent).toContain("from=1.0.0");
    expect(screen.getByTestId("location").textContent).toContain("to=2.0.0");
  });

  it("preserves status filter parameter when changing version selection", async () => {
    const user = userEvent.setup();
    renderPage("/java-agent/releases?from=1.0.0&to=2.0.0&status=added");

    const selectors = screen.getAllByRole("combobox");
    await user.selectOptions(selectors[0], "2.0.0");

    expect(screen.getByTestId("location").textContent).toContain("status=added");
  });
});

describe("JavaReleaseComparisonPage telemetry filter", () => {
  function makeTelemetryDiff(): ReleaseDiff {
    return {
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      instrumentations: [
        makeInstrumentation("spans-only", "changed", { spans: 1 }),
        makeInstrumentation("metrics-only", "added", { metrics: 1 }),
        makeInstrumentation("both", "changed", { spans: 1, metrics: 1 }),
        makeInstrumentation("neither", "removed"),
      ],
      aggregateMetrics: [],
      totals: { added: 1, changed: 2, removed: 1 },
    };
  }

  beforeEach(() => {
    vi.mocked(useVersions).mockReturnValue(mockVersions);
    vi.mocked(useReleaseComparison).mockReturnValue({
      diff: makeTelemetryDiff(),
      loading: false,
      error: null,
    });
  });

  it("shows every module when no telemetry filter is applied", () => {
    renderPage();

    expect(screen.getByText("spans-only Display")).toBeInTheDocument();
    expect(screen.getByText("metrics-only Display")).toBeInTheDocument();
    expect(screen.getByText("both Display")).toBeInTheDocument();
    expect(screen.getByText("neither Display")).toBeInTheDocument();
  });

  it("filters to modules exposing spans", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Spans" }));

    expect(screen.getByText("spans-only Display")).toBeInTheDocument();
    expect(screen.getByText("both Display")).toBeInTheDocument();
    expect(screen.queryByText("metrics-only Display")).not.toBeInTheDocument();
    expect(screen.queryByText("neither Display")).not.toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toContain("telemetry=spans");
  });

  it("filters to modules exposing metrics", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Metrics" }));

    expect(screen.getByText("metrics-only Display")).toBeInTheDocument();
    expect(screen.getByText("both Display")).toBeInTheDocument();
    expect(screen.queryByText("spans-only Display")).not.toBeInTheDocument();
    expect(screen.queryByText("neither Display")).not.toBeInTheDocument();
  });

  it("applies AND logic when both Spans and Metrics are selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Spans" }));
    await user.click(screen.getByRole("button", { name: "Metrics" }));

    expect(screen.getByText("both Display")).toBeInTheDocument();
    expect(screen.queryByText("spans-only Display")).not.toBeInTheDocument();
    expect(screen.queryByText("metrics-only Display")).not.toBeInTheDocument();
    expect(screen.queryByText("neither Display")).not.toBeInTheDocument();
    expect(screen.getByTestId("location").textContent).toContain("telemetry=spans%2Cmetrics");
  });

  it("clicking an active telemetry button deselects it", async () => {
    const user = userEvent.setup();
    renderPage();

    const spansButton = screen.getByRole("button", { name: "Spans" });
    await user.click(spansButton);
    expect(spansButton).toHaveAttribute("aria-pressed", "true");

    await user.click(spansButton);
    expect(spansButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("location").textContent).not.toContain("telemetry=");
  });

  it("combines with the Status filter (AND across both filter dimensions)", async () => {
    const user = userEvent.setup();
    renderPage();

    await selectStatus(user, "Changed");
    await user.click(screen.getByRole("button", { name: "Spans" }));

    // "both" is changed + has spans; "spans-only" is changed + has spans too.
    expect(screen.getByText("both Display")).toBeInTheDocument();
    expect(screen.getByText("spans-only Display")).toBeInTheDocument();
    // "metrics-only" is added (not changed), "neither" has no spans.
    expect(screen.queryByText("metrics-only Display")).not.toBeInTheDocument();
    expect(screen.queryByText("neither Display")).not.toBeInTheDocument();

    const location = screen.getByTestId("location").textContent;
    expect(location).toContain("status=changed");
    expect(location).toContain("telemetry=spans");
  });

  it("pre-filters the list when the telemetry param is present on initial load", () => {
    renderPage("/java-agent/releases?from=1.0.0&to=2.0.0&telemetry=metrics");

    expect(screen.getByText("metrics-only Display")).toBeInTheDocument();
    expect(screen.getByText("both Display")).toBeInTheDocument();
    expect(screen.queryByText("spans-only Display")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Metrics" })).toHaveAttribute("aria-pressed", "true");
  });

  it("degrades gracefully to showing everything when the telemetry param is invalid", () => {
    renderPage("/java-agent/releases?from=1.0.0&to=2.0.0&telemetry=logs,bogus");

    expect(screen.getByText("spans-only Display")).toBeInTheDocument();
    expect(screen.getByText("metrics-only Display")).toBeInTheDocument();
    expect(screen.getByText("both Display")).toBeInTheDocument();
    expect(screen.getByText("neither Display")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spans" })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not change the Changes Summary stat tiles when a telemetry filter is applied", async () => {
    const user = userEvent.setup();
    renderPage();

    const addedTile = screen.getByText("Modules Added").previousSibling as HTMLElement;
    const changedTile = screen.getByText("Modules Changed").previousSibling as HTMLElement;
    const removedTile = screen.getByText("Modules Removed").previousSibling as HTMLElement;
    const before = [addedTile.textContent, changedTile.textContent, removedTile.textContent];

    await user.click(screen.getByRole("button", { name: "Spans" }));

    const after = [addedTile.textContent, changedTile.textContent, removedTile.textContent];
    expect(after).toEqual(before);
  });

  it("'Clear all' resets both the status and telemetry filters", async () => {
    const user = userEvent.setup();
    renderPage();

    await selectStatus(user, "Removed");
    await user.click(screen.getByRole("button", { name: "Metrics" }));

    expect(screen.getByText("No modules match the selected filters.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(screen.getByTestId("location").textContent).not.toContain("status=");
    expect(screen.getByTestId("location").textContent).not.toContain("telemetry=");
    expect(screen.getByText("spans-only Display")).toBeInTheDocument();
    expect(screen.getByText("metrics-only Display")).toBeInTheDocument();
    expect(screen.getByText("both Display")).toBeInTheDocument();
    expect(screen.getByText("neither Display")).toBeInTheDocument();
  });

  it("excludes a module with only unchanged metrics from the Metrics filter, but includes it under Spans (JDBC regression)", async () => {
    const user = userEvent.setup();
    // Reproduces the reported bug: a module whose metrics are present in both
    // versions but never changed, alongside a real span change. Selecting
    // "Metrics" must NOT show it (no metric actually changed); selecting
    // "Spans" must show it.
    const jdbcLike: InstrumentationDiff = {
      id: "jdbc-like",
      displayName: "JDBC-like Display",
      status: "changed",
      telemetryDiff: {
        metrics: [
          {
            status: "unchanged",
            metric: {
              name: "db.client.connections.usage",
              description: "",
              instrument: "counter",
              data_type: "COUNTER",
              unit: "1",
            },
          },
        ],
        spans: [{ status: "changed", span: { span_kind: "CLIENT" } }],
      },
    };

    vi.mocked(useReleaseComparison).mockReturnValue({
      diff: {
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        instrumentations: [jdbcLike],
        aggregateMetrics: [],
        totals: { added: 0, changed: 1, removed: 0 },
      },
      loading: false,
      error: null,
    });
    renderPage();

    expect(screen.getByText("JDBC-like Display")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Metrics" }));
    expect(screen.queryByText("JDBC-like Display")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Metrics" }));
    await user.click(screen.getByRole("button", { name: "Spans" }));
    expect(screen.getByText("JDBC-like Display")).toBeInTheDocument();
  });
});
