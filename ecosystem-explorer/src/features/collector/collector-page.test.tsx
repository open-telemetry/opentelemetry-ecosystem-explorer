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
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CollectorPage } from "@/features/collector/collector-page.tsx";

vi.mock("@/hooks/use-collector-data", () => ({
  useCollectorVersions: vi.fn(),
  useCollectorComponents: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({
  isEnabled: vi.fn(() => true),
}));

import { useCollectorVersions, useCollectorComponents } from "@/hooks/use-collector-data";
import type { CollectorComponent } from "@/types/collector";

const mockVersionsData = {
  versions: [
    { version: "0.100.0", is_latest: true },
    { version: "0.99.0", is_latest: false },
  ],
};

const mockComponents: CollectorComponent[] = [
  {
    id: "receiver-otlp",
    name: "otlpreceiver",
    display_name: "OTLP Receiver",
    description: "Receives data via OTLP.",
    ecosystem: "collector",
    type: "receiver",
    distribution: "core",
    status: {
      class: "receiver",
      stability: { stable: ["traces", "metrics", "logs"] },
      distributions: ["core"],
    },
  },
  {
    id: "processor-batch",
    name: "batchprocessor",
    display_name: "Batch Processor",
    description: "Batches telemetry data.",
    ecosystem: "collector",
    type: "processor",
    distribution: "core",
    status: {
      class: "processor",
      stability: { stable: ["traces", "metrics", "logs"] },
      distributions: ["core"],
    },
  },
];

function renderAtRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/collector/components" element={<CollectorPage />} />
        <Route path="/collector/components/:version" element={<CollectorPage />} />
        <Route path="/collector/components/:version/:id" element={<CollectorPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CollectorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title", () => {
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: mockVersionsData,
      loading: false,
      error: null,
    });
    vi.mocked(useCollectorComponents).mockReturnValue({
      data: mockComponents,
      loading: false,
      error: null,
    });

    renderAtRoute("/collector/components");

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/Collector/);
    expect(heading).toHaveTextContent(/Components/);
  });

  it("shows loading state while versions are loading", () => {
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });
    vi.mocked(useCollectorComponents).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    renderAtRoute("/collector/components");

    expect(screen.getByText("Loading components...")).toBeInTheDocument();
  });

  it("shows error state when versions fail to load", () => {
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Network error"),
    });
    vi.mocked(useCollectorComponents).mockReturnValue({
      data: null,
      loading: false,
      error: null,
    });

    renderAtRoute("/collector/components");

    expect(screen.getByRole("heading", { name: "Error loading data" })).toBeInTheDocument();
    expect(screen.getByText("Please try refreshing the page.")).toBeInTheDocument();
  });

  it("shows error state when components fail to load", () => {
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: mockVersionsData,
      loading: false,
      error: null,
    });
    vi.mocked(useCollectorComponents).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed to load collector-manifest-0.100.0: 404 Not Found"),
    });

    renderAtRoute("/collector/components");

    expect(screen.getByRole("heading", { name: "Error loading data" })).toBeInTheDocument();
    expect(screen.getByText("Please try refreshing the page.")).toBeInTheDocument();
  });

  it("shows error state for an invalid version route instead of a misleading empty list", () => {
    // Regression guard: /collector/components/9.9.9 must show an error,
    // not "Showing 0 components" which implies a valid but empty filter result.
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: mockVersionsData,
      loading: false,
      error: null,
    });
    vi.mocked(useCollectorComponents).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed to load collector-manifest-9.9.9: 404 Not Found"),
    });

    renderAtRoute("/collector/components/9.9.9");

    expect(useCollectorComponents).toHaveBeenCalledWith("9.9.9");
    expect(screen.getByRole("heading", { name: "Error loading data" })).toBeInTheDocument();
    expect(
      screen.queryByText(
        (_content, element) =>
          element?.textContent?.replace(/\s+/g, " ").trim() === "Showing 0 components"
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText("No components found")).not.toBeInTheDocument();
  });

  it("renders component cards when data loads successfully", () => {
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: mockVersionsData,
      loading: false,
      error: null,
    });
    vi.mocked(useCollectorComponents).mockReturnValue({
      data: mockComponents,
      loading: false,
      error: null,
    });

    renderAtRoute("/collector/components");

    expect(screen.getByText("OTLP Receiver")).toBeInTheDocument();
    expect(screen.getByText("Batch Processor")).toBeInTheDocument();
    expect(screen.getByText(/Showing/)).toHaveTextContent("Showing 2 components");
  });

  it("renders version selector with available versions", () => {
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: mockVersionsData,
      loading: false,
      error: null,
    });
    vi.mocked(useCollectorComponents).mockReturnValue({
      data: mockComponents,
      loading: false,
      error: null,
    });

    renderAtRoute("/collector/components");

    expect(screen.getByRole("option", { name: /0\.100\.0/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /0\.99\.0/ })).toBeInTheDocument();
  });
});
