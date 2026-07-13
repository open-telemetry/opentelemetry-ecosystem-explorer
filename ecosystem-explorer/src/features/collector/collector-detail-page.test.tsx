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
import { CollectorDetailPage } from "./collector-detail-page";

vi.mock("@/hooks/use-collector-data", () => ({
  useCollectorVersions: vi.fn(),
  useCollectorComponent: vi.fn(),
}));

import { useCollectorVersions, useCollectorComponent } from "@/hooks/use-collector-data";
import type { CollectorComponent } from "@/types/collector";

const mockComponent: CollectorComponent = {
  id: "core-otlpreceiver",
  name: "otlpreceiver",
  ecosystem: "collector",
  type: "receiver",
  distribution: "core",
  display_name: "OTLP Receiver",
  description: "Receives data via OTLP.",
  repository: "opentelemetry-collector",
  status: {
    class: "receiver",
    stability: { stable: ["traces", "metrics", "logs"] },
    distributions: ["core"],
  },
};

function renderAtRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/collector/components/:distribution/:name" element={<CollectorDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CollectorDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an error state instead of an infinite loading spinner when the versions fetch fails and no ?version= is present", () => {
    // Regression guard for the versions-fetch-failure deadlock: with no
    // ?version= in the URL, `version` can only ever be resolved from
    // useCollectorVersions()'s data. If that fetch fails, the page must
    // fall through to the error UI instead of spinning forever.
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed to load collector-versions-index: 500 Internal Server Error"),
    });
    vi.mocked(useCollectorComponent).mockReturnValue({
      data: null,
      loading: false,
      error: null,
    });

    renderAtRoute("/collector/components/core/otlpreceiver");

    expect(screen.getByRole("heading", { name: "Error loading component" })).toBeInTheDocument();
    expect(
      screen.getByText("Failed to load collector-versions-index: 500 Internal Server Error")
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading component...")).not.toBeInTheDocument();
    // The error state must still offer a way out.
    expect(screen.getByRole("button", { name: /go back/i })).toBeInTheDocument();
  });

  it("still shows the loading state while versions are genuinely in flight (no error yet)", () => {
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });
    vi.mocked(useCollectorComponent).mockReturnValue({
      data: null,
      loading: false,
      error: null,
    });

    renderAtRoute("/collector/components/core/otlpreceiver");

    expect(screen.getByText("Loading component...")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Error loading component" })
    ).not.toBeInTheDocument();
  });

  it("renders the component when the version resolves and the component loads successfully", () => {
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: { versions: [{ version: "0.150.0", is_latest: true }] },
      loading: false,
      error: null,
    });
    vi.mocked(useCollectorComponent).mockReturnValue({
      data: mockComponent,
      loading: false,
      error: null,
    });

    renderAtRoute("/collector/components/core/otlpreceiver");

    expect(screen.getByText("OTLP Receiver")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Error loading component" })
    ).not.toBeInTheDocument();
  });

  it("preserves the existing error UI when the component fetch itself fails with a valid version", () => {
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: { versions: [{ version: "0.150.0", is_latest: true }] },
      loading: false,
      error: null,
    });
    vi.mocked(useCollectorComponent).mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Collector component "core-otlpreceiver" not found in version 0.150.0'),
    });

    renderAtRoute("/collector/components/core/otlpreceiver?version=0.150.0");

    expect(screen.getByRole("heading", { name: "Error loading component" })).toBeInTheDocument();
    expect(
      screen.getByText('Collector component "core-otlpreceiver" not found in version 0.150.0')
    ).toBeInTheDocument();
  });

  it("resolves the version from the URL immediately when ?version= is present, independent of the versions fetch", () => {
    vi.mocked(useCollectorVersions).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed to load collector-versions-index"),
    });
    vi.mocked(useCollectorComponent).mockReturnValue({
      data: mockComponent,
      loading: false,
      error: null,
    });

    renderAtRoute("/collector/components/core/otlpreceiver?version=0.150.0");

    expect(useCollectorComponent).toHaveBeenCalledWith("core", "otlpreceiver", "0.150.0");
    expect(screen.getByText("OTLP Receiver")).toBeInTheDocument();
  });
});
