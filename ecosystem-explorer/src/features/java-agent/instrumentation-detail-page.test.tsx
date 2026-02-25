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
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { InstrumentationDetailPage } from "./instrumentation-detail-page";
import type { InstrumentationData } from "@/types/javaagent";

vi.mock("@/hooks/use-javaagent-data", () => ({
  useVersions: vi.fn(),
  useInstrumentation: vi.fn(),
}));

vi.mock("@/components/ui/back-button", () => ({
  BackButton: () => <button>Back</button>,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

import { useVersions, useInstrumentation } from "@/hooks/use-javaagent-data";

const mockVersionsData = {
  versions: [
    { version: "2.0.0", is_latest: true },
    { version: "1.9.0", is_latest: false },
  ],
};

const mockInstrumentation: InstrumentationData = {
  name: "jdbc",
  display_name: "JDBC",
  description: "Instrumentation for JDBC database connections",
  scope: { name: "jdbc" },
  library_link: "https://example.com/jdbc",
  source_path: "https://github.com/example/jdbc",
  javaagent_target_versions: ["1.0.0", "2.0.0"],
  has_standalone_library: true,
};

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/java-agent/instrumentation/:version/:name"
          element={<InstrumentationDetailPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("InstrumentationDetailPage", () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useVersions).mockReturnValue({
      data: mockVersionsData,
      loading: false,
      error: null,
    });
  });

  it("shows loading state while fetching data", () => {
    vi.mocked(useInstrumentation).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

    expect(screen.getByText("Loading instrumentation...")).toBeInTheDocument();
  });

  it("shows error message when instrumentation fails to load", () => {
    vi.mocked(useInstrumentation).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed to fetch instrumentation data"),
    });

    renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

    expect(screen.getByText("Error loading instrumentation")).toBeInTheDocument();
    expect(screen.getByText("Failed to fetch instrumentation data")).toBeInTheDocument();
  });

  it("shows error message when instrumentation is null without error", () => {
    vi.mocked(useInstrumentation).mockReturnValue({
      data: null,
      loading: false,
      error: null,
    });

    renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

    expect(screen.getByText("Error loading instrumentation")).toBeInTheDocument();
    expect(screen.getByText("Instrumentation not found")).toBeInTheDocument();
  });

  it("renders instrumentation details successfully", () => {
    vi.mocked(useInstrumentation).mockReturnValue({
      data: mockInstrumentation,
      loading: false,
      error: null,
    });

    renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

    expect(screen.getByRole("heading", { name: "JDBC", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Instrumentation for JDBC database connections")).toBeInTheDocument();
    expect(screen.getByText("Instrumentation Name:")).toBeInTheDocument();
    expect(screen.getByText("jdbc")).toBeInTheDocument();
    expect(screen.getByText("Version:")).toBeInTheDocument();
    expect(screen.getByText("2.0.0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("does not fetch instrumentation when version is 'latest'", () => {
    vi.mocked(useInstrumentation).mockReturnValue({
      data: null,
      loading: false,
      error: null,
    });

    renderWithRouter("/java-agent/instrumentation/latest/jdbc");

    expect(useInstrumentation).toHaveBeenCalledWith("", "");
  });

  it("redirects from 'latest' to resolved version", () => {
    vi.mocked(useInstrumentation).mockReturnValue({
      data: null,
      loading: false,
      error: null,
    });

    renderWithRouter("/java-agent/instrumentation/latest/jdbc");

    expect(mockNavigate).toHaveBeenCalledWith("/java-agent/instrumentation/2.0.0/jdbc", {
      replace: true,
    });
  });
});
