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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCollectorComponents, useCollectorVersions } from "@/hooks/use-collector-data";
import type { IndexComponent } from "@/types/collector";
import { CollectorListPageV1 } from "./list-page";

vi.mock("@/hooks/use-collector-data", () => ({
  useCollectorComponents: vi.fn(),
  useCollectorVersions: vi.fn(),
}));

const mockComponents: IndexComponent[] = [
  {
    id: "core-otlpreceiver",
    name: "otlpreceiver",
    type: "receiver",
    distribution: "core",
    display_name: "OTLP Receiver",
    description: "Receives OTLP telemetry.",
    stability: "stable",
    signals: ["traces", "metrics", "logs"],
  },
  {
    id: "contrib-prometheusreceiver",
    name: "prometheusreceiver",
    type: "receiver",
    distribution: "contrib",
    display_name: "Prometheus Receiver",
    description: "Receives Prometheus metrics.",
    stability: "beta",
    signals: ["metrics", "profiles"],
  },
  {
    id: "core-batchprocessor",
    name: "batchprocessor",
    type: "processor",
    distribution: "core",
    display_name: "Batch Processor",
    description: "Batches telemetry.",
    stability: "alpha",
    signals: ["logs"],
  },
  {
    id: "core-countconnector",
    name: "countconnector",
    type: "connector",
    distribution: "core",
    display_name: "Count Connector",
    description: "Counts telemetry into metrics.",
    stability: "development",
    signals: ["traces_to_metrics", "logs_to_metrics"],
  },
];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(initialPath = "/collector/components") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/collector/components"
          element={
            <>
              <CollectorListPageV1 />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("CollectorListPageV1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: {
        versions: [
          { version: "0.150.0", is_latest: true },
          { version: "0.149.0", is_latest: false },
        ],
      },
      loading: false,
      error: null,
    });
    vi.mocked(useCollectorComponents).mockReturnValue({
      data: mockComponents,
      loading: false,
      error: null,
    });
  });

  it("renders all rows with no filters applied", () => {
    renderPage();

    expect(screen.getByText("OTLP Receiver")).toBeInTheDocument();
    expect(screen.getByText("Prometheus Receiver")).toBeInTheDocument();
    expect(screen.getByText("Batch Processor")).toBeInTheDocument();
    expect(screen.getByText("Count Connector")).toBeInTheDocument();
    expect(screen.getByText("Showing 4 of 4 (4 total)")).toBeInTheDocument();
  });

  it("filters by type via the URL", () => {
    renderPage("/collector/components?type=receiver");

    expect(screen.getByText("OTLP Receiver")).toBeInTheDocument();
    expect(screen.getByText("Prometheus Receiver")).toBeInTheDocument();
    expect(screen.queryByText("Batch Processor")).not.toBeInTheDocument();
    expect(screen.queryByText("Count Connector")).not.toBeInTheDocument();
  });

  it("only matches the four known Signal literals — profiles and connector compound tokens don't count (decision #10)", () => {
    renderPage("/collector/components?signal=metrics");

    // OTLP Receiver (traces/metrics/logs) and Prometheus Receiver (metrics/
    // profiles) both carry the literal "metrics" token — both match.
    expect(screen.getByText("OTLP Receiver")).toBeInTheDocument();
    expect(screen.getByText("Prometheus Receiver")).toBeInTheDocument();
    // Count Connector's tokens are "traces_to_metrics"/"logs_to_metrics", not
    // the literal "metrics" — must NOT match even though it conceptually
    // touches the metrics signal.
    expect(screen.queryByText("Count Connector")).not.toBeInTheDocument();
    // Batch Processor only has "logs" — doesn't match "metrics" either way.
    expect(screen.queryByText("Batch Processor")).not.toBeInTheDocument();
  });

  it("shows the empty state when a filter matches nothing, and clears filters on request", async () => {
    const user = userEvent.setup();
    renderPage("/collector/components?type=exporter");

    expect(screen.getByText("No matching components")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/collector/components");
  });

  it("shows a loading state while versions or components are in flight", () => {
    vi.mocked(useCollectorComponents).mockReturnValue({ data: null, loading: true, error: null });
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading components…");
  });

  it("shows an error state when the data layer fails", () => {
    vi.mocked(useCollectorComponents).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("network down"),
    });
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("network down");
  });

  it("opens the facet drawer as a modal from the toggle and restores focus on close", async () => {
    const user = userEvent.setup();
    renderPage();

    const toggle = screen.getByRole("button", { name: "Open filters" });
    await user.click(toggle);

    expect(screen.getByRole("dialog", { name: "Filters" })).toHaveAttribute("aria-modal", "true");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it("switches density views and persists the choice to localStorage", async () => {
    const user = userEvent.setup();
    renderPage("/collector/components?density=table");

    expect(screen.getByRole("table")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cards" }));
    expect(screen.getByTestId("location")).toHaveTextContent("density=cards");
    expect(window.localStorage.getItem("explorer:listDensity")).toBe("cards");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
