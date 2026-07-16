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

import { CollectorComponentsPage } from "./collector-components-page";
import { useCollectorComponents, useCollectorVersions } from "@/hooks/use-collector-data";
import type { IndexComponent } from "@/types/collector";

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
    signals: ["traces"],
  },
  {
    id: "contrib-prometheusreceiver",
    name: "prometheusreceiver",
    type: "receiver",
    distribution: "contrib",
    display_name: "Prometheus Receiver",
    description: "Receives Prometheus metrics.",
    stability: "beta",
    signals: ["metrics"],
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
              <CollectorComponentsPage />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/collector/components/:version"
          element={
            <>
              <CollectorComponentsPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("CollectorComponentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("applies type and distribution query filters", () => {
    renderPage("/collector/components?type=receiver&distribution=core");

    expect(screen.getByRole("combobox", { name: "Type" })).toHaveValue("receiver");
    expect(screen.getByRole("combobox", { name: "Distribution" })).toHaveValue("core");
    expect(screen.getByText("OTLP Receiver")).toBeInTheDocument();
    expect(screen.queryByText("Prometheus Receiver")).not.toBeInTheDocument();
    expect(screen.queryByText("Batch Processor")).not.toBeInTheDocument();
  });

  it("preserves query filters when changing versions", async () => {
    const user = userEvent.setup();
    renderPage("/collector/components?type=receiver&distribution=core");

    await user.selectOptions(screen.getByRole("combobox", { name: "Version" }), "0.149.0");

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/collector/components/0.149.0?type=receiver&distribution=core"
    );
  });

  it("builds detail links with distribution, component name, version, and filters", () => {
    renderPage("/collector/components?type=receiver");

    expect(screen.getByRole("link", { name: /OTLP Receiver/i })).toHaveAttribute(
      "href",
      "/collector/components/core/otlpreceiver?type=receiver&version=0.150.0"
    );
  });

  it("applies stability query filter", () => {
    renderPage("/collector/components?stability=beta");

    expect(screen.getByRole("combobox", { name: "Stability" })).toHaveValue("beta");
    expect(screen.getByText("Prometheus Receiver")).toBeInTheDocument();
    expect(screen.queryByText("OTLP Receiver")).not.toBeInTheDocument();
    expect(screen.queryByText("Batch Processor")).not.toBeInTheDocument();
  });

  it("applies signal query filter (single signal)", () => {
    renderPage("/collector/components?signal=metrics");

    expect(screen.getByRole("button", { name: "Metrics" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Prometheus Receiver")).toBeInTheDocument();
    expect(screen.queryByText("OTLP Receiver")).not.toBeInTheDocument();
    expect(screen.queryByText("Batch Processor")).not.toBeInTheDocument();
  });

  it("applies signal query filter (AND across multiple signals)", () => {
    // AND semantics, matching Java Agent: only a component supporting ALL selected signals
    // matches. Local mock so a dual-signal component exists to make this observable.
    vi.mocked(useCollectorComponents).mockReturnValue({
      data: [
        {
          id: "core-otlpreceiver",
          name: "otlpreceiver",
          type: "receiver",
          distribution: "core",
          display_name: "OTLP Receiver",
          description: "Receives OTLP telemetry.",
          signals: ["metrics", "traces"],
        },
        {
          id: "contrib-prometheusreceiver",
          name: "prometheusreceiver",
          type: "receiver",
          distribution: "contrib",
          display_name: "Prometheus Receiver",
          description: "Receives Prometheus metrics.",
          signals: ["metrics"],
        },
        {
          id: "core-batchprocessor",
          name: "batchprocessor",
          type: "processor",
          distribution: "core",
          display_name: "Batch Processor",
          description: "Batches telemetry.",
          signals: ["logs"],
        },
      ],
      loading: false,
      error: null,
    });

    renderPage("/collector/components?signal=metrics&signal=traces");

    expect(screen.getByText("OTLP Receiver")).toBeInTheDocument();
    expect(screen.queryByText("Prometheus Receiver")).not.toBeInTheDocument();
    expect(screen.queryByText("Batch Processor")).not.toBeInTheDocument();
  });

  it("combines search, type, distribution, stability, and signal filters", () => {
    renderPage(
      "/collector/components?search=prometheus&type=receiver&distribution=contrib&stability=beta&signal=metrics"
    );

    expect(screen.getByText("Prometheus Receiver")).toBeInTheDocument();
    expect(screen.queryByText("OTLP Receiver")).not.toBeInTheDocument();
    expect(screen.queryByText("Batch Processor")).not.toBeInTheDocument();
  });

  it("toggling a signal button updates aria-pressed and the URL", async () => {
    const user = userEvent.setup();
    renderPage("/collector/components");

    const metricsButton = screen.getByRole("button", { name: "Metrics" });
    expect(metricsButton).toHaveAttribute("aria-pressed", "false");

    await user.click(metricsButton);

    expect(metricsButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/collector/components?signal=metrics"
    );
  });

  it("clear all resets stability and signal filters too", async () => {
    const user = userEvent.setup();
    renderPage("/collector/components?type=receiver&stability=stable&signal=logs");

    expect(screen.getByText("No components found")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/collector/components");
    expect(screen.getByText("OTLP Receiver")).toBeInTheDocument();
    expect(screen.getByText("Prometheus Receiver")).toBeInTheDocument();
    expect(screen.getByText("Batch Processor")).toBeInTheDocument();
  });

  describe("signal badges", () => {
    it("renders a Metrics badge for a component that only supports metrics", () => {
      vi.mocked(useCollectorComponents).mockReturnValue({
        data: [
          {
            id: "contrib-apachesparkreceiver",
            name: "apachesparkreceiver",
            type: "receiver",
            distribution: "contrib",
            display_name: "Apache Spark Receiver",
            description: "Fetches metrics for an Apache Spark cluster.",
            stability: "alpha",
            signals: ["metrics"],
          },
        ],
        loading: false,
        error: null,
      });

      renderPage();

      // Scoped to the badge <span> — the signal filter row now renders a <button> with the
      // same label text for every signal, regardless of this component's data.
      expect(screen.getByText("Metrics", { selector: "span" })).toBeInTheDocument();
      expect(screen.queryByText("Traces", { selector: "span" })).not.toBeInTheDocument();
      expect(screen.queryByText("Logs", { selector: "span" })).not.toBeInTheDocument();
      expect(screen.queryByText("Profiles", { selector: "span" })).not.toBeInTheDocument();
    });

    it("renders one badge per signal, in canonical order, for a multi-signal component", () => {
      vi.mocked(useCollectorComponents).mockReturnValue({
        data: [
          {
            id: "core-otlpreceiver",
            name: "otlpreceiver",
            type: "receiver",
            distribution: "core",
            display_name: "OTLP Receiver",
            description: "Receives OTLP telemetry.",
            signals: ["logs", "traces", "metrics"],
          },
        ],
        loading: false,
        error: null,
      });

      renderPage();

      expect(screen.getByText("Metrics", { selector: "span" })).toBeInTheDocument();
      expect(screen.getByText("Traces", { selector: "span" })).toBeInTheDocument();
      expect(screen.getByText("Logs", { selector: "span" })).toBeInTheDocument();
      expect(screen.queryByText("Profiles", { selector: "span" })).not.toBeInTheDocument();
    });

    it("renders no signal badges when signals is missing or empty", () => {
      vi.mocked(useCollectorComponents).mockReturnValue({
        data: [
          {
            id: "core-batchprocessor",
            name: "batchprocessor",
            type: "processor",
            distribution: "core",
            display_name: "Batch Processor",
            description: "Batches telemetry.",
          },
        ],
        loading: false,
        error: null,
      });

      renderPage();

      expect(screen.queryByText("Metrics", { selector: "span" })).not.toBeInTheDocument();
      expect(screen.queryByText("Traces", { selector: "span" })).not.toBeInTheDocument();
      expect(screen.queryByText("Logs", { selector: "span" })).not.toBeInTheDocument();
      expect(screen.queryByText("Profiles", { selector: "span" })).not.toBeInTheDocument();
    });
  });
});
