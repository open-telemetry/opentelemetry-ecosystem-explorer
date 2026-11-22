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
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { clickPackage, flaskPackage, packagesByName, pythonIndex } from "@/test/python-fixtures";
import { PythonDetailPage } from "./python-detail-page";

vi.mock("@/hooks/use-python-data", () => ({
  usePythonIndex: vi.fn(),
  usePythonPackage: vi.fn(),
}));

vi.mock("@/components/ui/back-button", () => ({
  BackButton: ({ label }: { label?: string }) => <button>{label ?? "Back"}</button>,
}));

import { usePythonIndex, usePythonPackage } from "@/hooks/use-python-data";

const mockIndex = usePythonIndex as ReturnType<typeof vi.fn>;
const mockPackage = usePythonPackage as ReturnType<typeof vi.fn>;

const FLASK = "opentelemetry-instrumentation-flask";
const CLICK = "opentelemetry-instrumentation-click";

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/python/instrumentation/:name" element={<PythonDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockIndex.mockReturnValue({ data: pythonIndex, loading: false, error: null });
  // Mirrors the real hook: an empty name means "skip", otherwise the package file for the name.
  mockPackage.mockImplementation((name: string) => ({
    data: name ? (packagesByName[name] ?? null) : null,
    loading: false,
    error: null,
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PythonDetailPage", () => {
  it("shows the package name, description, version and Python requirement", () => {
    renderPage(`/python/instrumentation/${FLASK}`);

    expect(screen.getByRole("heading", { level: 1, name: FLASK })).toBeInTheDocument();
    expect(screen.getByText("Flask instrumentation for OpenTelemetry")).toBeInTheDocument();
    const overview = screen.getByRole("region", { name: "Overview" });
    expect(within(overview).getByText(/0\.66b2/)).toBeInTheDocument();
    expect(within(overview).getByText(">=3.10")).toBeInTheDocument();
  });

  it("requests the latest release by default and the chosen one with ?version=", () => {
    renderPage(`/python/instrumentation/${FLASK}`);
    expect(mockPackage).toHaveBeenLastCalledWith(FLASK, "0.66b2");

    cleanup();
    renderPage(`/python/instrumentation/${FLASK}?version=0.66b0`);
    expect(mockPackage).toHaveBeenLastCalledWith(FLASK, "0.66b0");
  });

  it("falls back to the latest release for an unknown version and says so", () => {
    renderPage(`/python/instrumentation/${FLASK}?version=9.9`);

    expect(mockPackage).toHaveBeenLastCalledWith(FLASK, "0.66b2");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Version 9.9 was not found for this package. Showing 0.66b2."
    );
  });

  it("does not warn for a valid version or for latest", () => {
    renderPage(`/python/instrumentation/${FLASK}?version=latest`);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("groups instrumented libraries by how upstream expects them", () => {
    renderPage(`/python/instrumentation/${FLASK}`);

    const section = screen.getByRole("region", { name: "Instrumented libraries" });
    expect(within(section).getByText("All of these are expected")).toBeInTheDocument();
    expect(within(section).getByText("Any one of these is expected")).toBeInTheDocument();
    expect(within(section).getByText("flask")).toBeInTheDocument();
    expect(within(section).getByText(">= 1.0")).toBeInTheDocument();
    expect(within(section).getByText("werkzeug")).toBeInTheDocument();
  });

  it("lists entry points", () => {
    renderPage(`/python/instrumentation/${FLASK}`);

    const section = screen.getByRole("region", { name: "Entry points" });
    expect(
      within(section).getByText("opentelemetry.instrumentation.flask:FlaskInstrumentor")
    ).toBeInTheDocument();
  });

  it("links to the source built from repository and source_path", () => {
    renderPage(`/python/instrumentation/${FLASK}`);

    expect(screen.getByRole("link", { name: /View source on GitHub/ })).toHaveAttribute(
      "href",
      `https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation/${FLASK}`
    );
  });

  it("lists releases newest first, marking the latest and the ones sharing its metadata", () => {
    renderPage(`/python/instrumentation/${FLASK}?version=0.66b1`);

    const section = screen.getByRole("region", { name: "Releases" });
    const links = within(section)
      .getAllByRole("link")
      .map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["0.66b2", `/python/instrumentation/${FLASK}`],
      ["0.66b1", `/python/instrumentation/${FLASK}?version=0.66b1`],
      ["0.66b0", `/python/instrumentation/${FLASK}?version=0.66b0`],
    ]);
    expect(within(section).getByText("Latest")).toBeInTheDocument();
    // Only 0.66b1 shares a file with the latest release; 0.66b0 has different metadata.
    expect(within(section).getAllByText("Same metadata as the latest release")).toHaveLength(1);
    expect(within(section).getByRole("link", { name: "View 0.66b1" })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  describe("a package with no optional metadata", () => {
    it("renders without errors, with unknown shown as Not specified", () => {
      renderPage(`/python/instrumentation/${CLICK}`);

      expect(screen.getByRole("heading", { level: 1, name: CLICK })).toBeInTheDocument();
      // The package file has no description, so the index one is used.
      expect(screen.getByText("Click instrumentation for OpenTelemetry")).toBeInTheDocument();
      const overview = screen.getByRole("region", { name: "Overview" });
      expect(within(overview).getAllByText("Not specified")).toHaveLength(2);
      expect(within(overview).queryByText("No metrics")).not.toBeInTheDocument();
    });

    it("shows empty states for libraries and entry points", () => {
      renderPage(`/python/instrumentation/${CLICK}`);

      expect(
        screen.getByText("No instrumented libraries are listed for this package.")
      ).toBeInTheDocument();
      expect(screen.getByText("No entry points are listed for this package.")).toBeInTheDocument();
    });

    it("never links to the malformed upstream homepage", () => {
      const { container } = renderPage(`/python/instrumentation/${CLICK}`);

      const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
      expect(hrefs).not.toContain(clickPackage.homepage);
      expect(hrefs.join(" ")).not.toContain("python-contrib/instrumentation/");
      expect(hrefs).toContain(
        `https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation/${CLICK}`
      );
    });

    it("omits the source link when repository or source_path is missing", () => {
      mockPackage.mockReturnValue({
        data: { ...flaskPackage, source_path: undefined },
        loading: false,
        error: null,
      });
      renderPage(`/python/instrumentation/${FLASK}`);

      expect(screen.queryByRole("link", { name: /View source/ })).not.toBeInTheDocument();
    });

    it("tolerates a package file with no instruments, entry points or requirement at all", () => {
      mockPackage.mockReturnValue({ data: { name: FLASK }, loading: false, error: null });
      renderPage(`/python/instrumentation/${FLASK}`);

      expect(screen.getByRole("heading", { level: 1, name: FLASK })).toBeInTheDocument();
      expect(screen.getByText("No entry points are listed for this package.")).toBeInTheDocument();
    });
  });

  it("shows not found for a package that is not in the index, without loading a file", () => {
    renderPage("/python/instrumentation/opentelemetry-instrumentation-nope");

    expect(screen.getByRole("alert")).toHaveTextContent("Package not found");
    expect(screen.getByRole("alert")).toHaveTextContent("opentelemetry-instrumentation-nope");
    expect(mockPackage).toHaveBeenLastCalledWith("", undefined);
  });

  it("shows loading while the index loads", () => {
    mockIndex.mockReturnValue({ data: null, loading: true, error: null });
    renderPage(`/python/instrumentation/${FLASK}`);

    expect(screen.getByText("Loading package…")).toBeInTheDocument();
  });

  it("shows loading while the package file loads", () => {
    mockPackage.mockReturnValue({ data: null, loading: true, error: null });
    renderPage(`/python/instrumentation/${FLASK}`);

    expect(screen.getByText("Loading package…")).toBeInTheDocument();
  });

  it("shows an error when the index fails to load", () => {
    mockIndex.mockReturnValue({ data: null, loading: false, error: new Error("index down") });
    renderPage(`/python/instrumentation/${FLASK}`);

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load this package");
    expect(screen.getByRole("alert")).toHaveTextContent("index down");
  });

  it("shows an error when the package file fails to load", () => {
    mockPackage.mockReturnValue({ data: null, loading: false, error: new Error("file missing") });
    renderPage(`/python/instrumentation/${FLASK}`);

    expect(screen.getByRole("alert")).toHaveTextContent("file missing");
  });
});
