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
import { PythonDetailPageV1 } from "./python-detail-page";

vi.mock("@/hooks/use-python-data", () => ({
  usePythonIndex: vi.fn(),
  usePythonPackage: vi.fn(),
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
        <Route path="/python/instrumentation/:name" element={<PythonDetailPageV1 />} />
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

describe("PythonDetailPageV1", () => {
  it("shows the package name, description and resolved version in the header", () => {
    renderPage(`/python/instrumentation/${FLASK}`);

    expect(screen.getByRole("heading", { level: 1, name: FLASK })).toBeInTheDocument();
    expect(screen.getByText("Flask instrumentation for OpenTelemetry")).toBeInTheDocument();
    expect(screen.getByText("0.66b2", { selector: ".td-pill" })).toBeInTheDocument();
  });

  it("builds the breadcrumb with a link back to the catalogue", () => {
    renderPage(`/python/instrumentation/${FLASK}`);

    const crumbs = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(within(crumbs).getByRole("link", { name: "Instrumentation" })).toHaveAttribute(
      "href",
      "/python/instrumentation"
    );
    expect(within(crumbs).getByText(FLASK)).toHaveAttribute("aria-current", "page");
  });

  it("requests the latest release by default and the chosen one with ?version=", () => {
    renderPage(`/python/instrumentation/${FLASK}`);
    expect(mockPackage).toHaveBeenLastCalledWith(FLASK, "0.66b2");

    cleanup();
    renderPage(`/python/instrumentation/${FLASK}?version=0.66b0`);
    expect(mockPackage).toHaveBeenLastCalledWith(FLASK, "0.66b0");
    expect(screen.getByText("0.66b0", { selector: ".td-pill" })).toBeInTheDocument();
  });

  it("falls back to the latest release for an unknown version and says so", () => {
    renderPage(`/python/instrumentation/${FLASK}?version=9.9`);

    expect(mockPackage).toHaveBeenLastCalledWith(FLASK, "0.66b2");
    expect(screen.getByRole("note")).toHaveTextContent(
      "Version 9.9 was not found for this package. Showing 0.66b2."
    );
  });

  it("does not warn for a valid version or for latest", () => {
    renderPage(`/python/instrumentation/${FLASK}?version=latest`);

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("shows the Python requirement, metrics support and semantic-convention status", () => {
    renderPage(`/python/instrumentation/${FLASK}`);

    const overview = screen.getByRole("region", { name: "Overview" });
    expect(within(overview).getByText(">=3.10")).toBeInTheDocument();
    expect(within(overview).getByText("Supports metrics")).toBeInTheDocument();
    expect(within(overview).getByText("Migration")).toBeInTheDocument();
  });

  it("groups instrumented libraries by how upstream expects them", () => {
    renderPage(`/python/instrumentation/${FLASK}`);

    const section = screen.getByRole("region", { name: "Instrumented libraries" });
    expect(within(section).getByText("All of these are expected")).toBeInTheDocument();
    expect(within(section).getByText("Any one of these is expected")).toBeInTheDocument();
    expect(within(section).getByText("werkzeug")).toBeInTheDocument();
    expect(within(section).getByText(">= 2.0")).toBeInTheDocument();
  });

  it("lists entry points", () => {
    renderPage(`/python/instrumentation/${FLASK}`);

    expect(
      within(screen.getByRole("region", { name: "Entry points" })).getByText(
        "opentelemetry.instrumentation.flask:FlaskInstrumentor"
      )
    ).toBeInTheDocument();
  });

  it("links to the source built from repository and source_path", () => {
    renderPage(`/python/instrumentation/${FLASK}`);

    const link = screen.getByRole("link", { name: /View source on GitHub/ });
    expect(link).toHaveAttribute(
      "href",
      `https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation/${FLASK}`
    );
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("lists every package in the left rail with the current one active", () => {
    renderPage(`/python/instrumentation/${FLASK}`);

    const rail = screen.getByRole("complementary", { name: "Package navigation" });
    const links = within(rail).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/python/instrumentation/opentelemetry-instrumentation-asyncpg",
      "/python/instrumentation/opentelemetry-instrumentation-click",
      "/python/instrumentation/opentelemetry-instrumentation-flask",
    ]);
  });

  it("shows the release history, marking the latest and releases sharing its metadata", () => {
    renderPage(`/python/instrumentation/${FLASK}?version=0.66b1`);

    const rail = screen.getByRole("complementary", { name: "Package releases" });
    const links = within(rail)
      .getAllByRole("link")
      .map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["0.66b2", `/python/instrumentation/${FLASK}`],
      ["0.66b1", `/python/instrumentation/${FLASK}?version=0.66b1`],
      ["0.66b0", `/python/instrumentation/${FLASK}?version=0.66b0`],
    ]);
    expect(within(rail).getByText("Latest")).toBeInTheDocument();
    expect(within(rail).getAllByText("Same metadata as the latest release")).toHaveLength(1);
    expect(within(rail).getByRole("link", { name: "0.66b1" })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  describe("a package with no optional metadata", () => {
    it("renders with unknown shown as Not specified and no semantic-convention pill", () => {
      const { container } = renderPage(`/python/instrumentation/${CLICK}`);

      expect(screen.getByRole("heading", { level: 1, name: CLICK })).toBeInTheDocument();
      expect(screen.getByText("Click instrumentation for OpenTelemetry")).toBeInTheDocument();
      expect(container.querySelector("[data-metrics='unknown']")).toHaveTextContent(
        "Not specified"
      );
      expect(container.querySelector("[data-semconv]")).toBeNull();
      expect(screen.queryByText("No metrics")).not.toBeInTheDocument();
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
    });

    it("omits the source link when repository or source_path is missing", () => {
      mockPackage.mockReturnValue({
        data: { ...flaskPackage, repository: undefined },
        loading: false,
        error: null,
      });
      renderPage(`/python/instrumentation/${FLASK}`);

      expect(screen.queryByRole("link", { name: /View source/ })).not.toBeInTheDocument();
    });

    it("tolerates a package file with only a name", () => {
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

  it("shows loading while the index or the package file loads", () => {
    mockIndex.mockReturnValue({ data: null, loading: true, error: null });
    renderPage(`/python/instrumentation/${FLASK}`);
    expect(screen.getByText("Loading package…")).toBeInTheDocument();

    cleanup();
    mockIndex.mockReturnValue({ data: pythonIndex, loading: false, error: null });
    mockPackage.mockReturnValue({ data: null, loading: true, error: null });
    renderPage(`/python/instrumentation/${FLASK}`);
    expect(screen.getByText("Loading package…")).toBeInTheDocument();
  });

  it("shows an error when the index or the package file fails to load", () => {
    mockIndex.mockReturnValue({ data: null, loading: false, error: new Error("index down") });
    renderPage(`/python/instrumentation/${FLASK}`);
    expect(screen.getByRole("alert")).toHaveTextContent("index down");

    cleanup();
    mockIndex.mockReturnValue({ data: pythonIndex, loading: false, error: null });
    mockPackage.mockReturnValue({ data: null, loading: false, error: new Error("file missing") });
    renderPage(`/python/instrumentation/${FLASK}`);
    expect(screen.getByRole("alert")).toHaveTextContent("file missing");
  });
});
