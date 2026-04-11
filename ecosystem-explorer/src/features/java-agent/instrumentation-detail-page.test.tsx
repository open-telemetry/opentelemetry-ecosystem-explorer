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
import { render, screen, within } from "@testing-library/react";
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

const mockInstrumentationWithSemconv: InstrumentationData = {
  ...mockInstrumentation,
  semantic_conventions: ["HTTP_CLIENT_SPANS", "DATABASE_CLIENT_SPANS", "UNKNOWN_CONVENTION"],
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

    const header = screen.getByRole("banner");

    expect(screen.getByRole("heading", { name: "JDBC", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Instrumentation for JDBC database connections")).toBeInTheDocument();

    const scopeNameCode = within(header).getByText("jdbc");
    expect(scopeNameCode.tagName).toBe("CODE");

    expect(within(header).getByText("v2.0.0")).toBeInTheDocument();

    expect(within(header).getByText("Enabled by Default")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Details/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Telemetry/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Configuration/i })).toBeInTheDocument();
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

  it("renders semantic conventions as linked badges for known values", () => {
    vi.mocked(useInstrumentation).mockReturnValue({
      data: mockInstrumentationWithSemconv,
      loading: false,
      error: null,
    });

    renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

    expect(screen.getByRole("heading", { name: "Semantic Conventions" })).toBeInTheDocument();

    const httpLink = screen.getByRole("link", { name: "HTTP Client Spans" });
    expect(httpLink).toBeInTheDocument();
    expect(httpLink).toHaveAttribute(
      "href",
      "https://opentelemetry.io/docs/specs/semconv/http/http-spans/#http-client-span"
    );
    expect(httpLink).toHaveAttribute("target", "_blank");

    const dbLink = screen.getByRole("link", { name: "Database Client Spans" });
    expect(dbLink).toBeInTheDocument();
    expect(dbLink).toHaveAttribute(
      "href",
      "https://opentelemetry.io/docs/specs/semconv/database/database-spans/"
    );
  });

  it("renders unknown semantic conventions as plain text", () => {
    vi.mocked(useInstrumentation).mockReturnValue({
      data: mockInstrumentationWithSemconv,
      loading: false,
      error: null,
    });

    renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

    expect(screen.getByText("UNKNOWN_CONVENTION")).toBeInTheDocument();
  });

  it("does not render semantic conventions section when none are present", () => {
    vi.mocked(useInstrumentation).mockReturnValue({
      data: mockInstrumentation,
      loading: false,
      error: null,
    });

    renderWithRouter("/java-agent/instrumentation/2.0.0/jdbc");

    expect(screen.queryByRole("heading", { name: "Semantic Conventions" })).not.toBeInTheDocument();
  });
});
