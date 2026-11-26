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
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { pythonIndex } from "@/test/python-fixtures";
import type { PythonIndex } from "@/types/python";
import { PythonListPageV1 } from "./python-list-page";

vi.mock("@/hooks/use-python-data", () => ({
  usePythonIndex: vi.fn(),
  usePythonPackage: vi.fn(),
}));

import { usePythonIndex } from "@/hooks/use-python-data";

const mockIndex = usePythonIndex as ReturnType<typeof vi.fn>;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderPage(initialPath = "/python/instrumentation") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/python/instrumentation" element={<PythonListPageV1 />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

/** Package names in display order, whichever density is showing. */
function names(): string[] {
  return Array.from(
    document.querySelectorAll(".td-row__name, .td-card__name, .td-table__name strong")
  ).map((el) => el.textContent ?? "");
}

function indexWith(count: number): PythonIndex {
  return {
    ecosystem: "python",
    packages: Array.from({ length: count }, (_, i) => ({
      name: `opentelemetry-instrumentation-pkg${String(i).padStart(3, "0")}`,
      description: "A package",
      supports_metrics: null,
      semantic_convention_status: null,
      version: "0.66b2",
      releases: [{ version: "0.66b2", hash: `hash${i}` }],
    })),
  };
}

beforeEach(() => {
  window.localStorage.clear();
  mockIndex.mockReturnValue({ data: pythonIndex, loading: false, error: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PythonListPageV1", () => {
  it("lists packages sorted by full name in the compact view, linking to their pages", () => {
    renderPage();

    expect(names()).toEqual([
      "opentelemetry-instrumentation-asyncpg",
      "opentelemetry-instrumentation-click",
      "opentelemetry-instrumentation-flask",
    ]);
    expect(screen.getByText("Showing 3 of 3 (3 total)")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /opentelemetry-instrumentation-flask/ })
    ).toHaveAttribute("href", "/python/instrumentation/opentelemetry-instrumentation-flask");
  });

  it("renders a breadcrumb that does not link to a page that does not exist", () => {
    renderPage();

    const crumbs = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(within(crumbs).getByRole("link", { name: "Explorer" })).toHaveAttribute("href", "/");
    expect(within(crumbs).getByText("Python").closest("a")).toBeNull();
    expect(within(crumbs).getByText("Instrumentation")).toHaveAttribute("aria-current", "page");
  });

  it("shows unknown metrics as Not specified, not as No metrics", () => {
    renderPage();

    const click = screen.getByRole("link", { name: /instrumentation-click/ });
    expect(click.querySelector("[data-metrics]")).toHaveAttribute("data-metrics", "unknown");
    expect(click.querySelector("[data-metrics]")).toHaveTextContent("Not specified");
    expect(
      screen.getByRole("link", { name: /instrumentation-asyncpg/ }).querySelector("[data-metrics]")
    ).toHaveTextContent("No metrics");
  });

  it.each([
    ["cards", ".td-list--cards"],
    ["compact", ".td-list--compact"],
    ["table", ".td-table"],
  ])("renders the %s view from the URL with the same packages", (density, selector) => {
    const { container } = renderPage(`/python/instrumentation?density=${density}`);

    expect(container.querySelector(selector)).not.toBeNull();
    expect(names()).toHaveLength(3);
  });

  it("labels the table columns", () => {
    renderPage("/python/instrumentation?density=table");

    for (const heading of ["Package", "Latest", "Metrics", "Semantic conventions", "Releases"]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }
  });

  it("switches density, updating the URL and remembering the choice", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Table" }));

    expect(screen.getByTestId("location")).toHaveTextContent("?density=table");
    expect(window.localStorage.getItem("explorer:listDensity")).toBe("table");
    expect(screen.getByRole("columnheader", { name: "Package" })).toBeInTheDocument();
  });

  it("uses the remembered density when the URL does not choose one", () => {
    window.localStorage.setItem("explorer:listDensity", "cards");
    const { container } = renderPage();

    expect(container.querySelector(".td-list--cards")).not.toBeNull();
  });

  it("filters on a metrics checkbox and writes it to the URL", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("checkbox", { name: /Not specified\s*1/ }));

    expect(names()).toEqual(["opentelemetry-instrumentation-click"]);
    expect(screen.getByTestId("location")).toHaveTextContent("?metrics=unknown");
  });

  it("applies URL filters, checks their boxes and shows a chip for each", () => {
    renderPage("/python/instrumentation?metrics=supported&semconv=migration&q=flask");

    expect(names()).toEqual(["opentelemetry-instrumentation-flask"]);
    expect(screen.getByRole("checkbox", { name: /Supports metrics/ })).toBeChecked();
    const chips = screen.getByLabelText("Active filters");
    expect(within(chips).getByText("Search: flask")).toBeInTheDocument();
    expect(within(chips).getByText("Metrics: Supports metrics")).toBeInTheDocument();
    expect(within(chips).getByText("Semantic conventions: Migration")).toBeInTheDocument();
  });

  it("removes a single filter from its chip and clears all of them", async () => {
    const user = userEvent.setup();
    renderPage("/python/instrumentation?metrics=supported&q=flask");

    await user.click(screen.getByRole("button", { name: /Remove filter.*Search: flask/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("?metrics=supported");

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/python\/instrumentation$/);
    expect(names()).toHaveLength(3);
  });

  it("searches name and description through the search facet", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("searchbox", { name: "Search" }), "asyncpg");

    await waitFor(() => expect(names()).toEqual(["opentelemetry-instrumentation-asyncpg"]));
    expect(screen.getByTestId("location")).toHaveTextContent("?q=asyncpg");
  });

  it("shows a filtered empty state with a way to clear it", async () => {
    const user = userEvent.setup();
    renderPage("/python/instrumentation?q=nothing-matches");

    expect(screen.getByText("No packages match")).toBeInTheDocument();
    expect(screen.queryByText(/components/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    expect(names()).toHaveLength(3);
  });

  it("shows an unfiltered empty state for an empty database", () => {
    mockIndex.mockReturnValue({
      data: { ecosystem: "python", packages: [] },
      loading: false,
      error: null,
    });
    renderPage();

    expect(screen.getByText("There are no Python packages to show.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
  });

  it("shows loading", () => {
    mockIndex.mockReturnValue({ data: null, loading: true, error: null });
    renderPage();

    expect(screen.getAllByText("Loading Python packages…").length).toBeGreaterThan(0);
    expect(names()).toEqual([]);
  });

  it("shows an error with its message", () => {
    mockIndex.mockReturnValue({ data: null, loading: false, error: new Error("network down") });
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load Python packages");
    expect(screen.getByRole("alert")).toHaveTextContent("network down");
  });

  it("keeps all 51 real-world packages on one page", () => {
    mockIndex.mockReturnValue({ data: indexWith(51), loading: false, error: null });
    renderPage();

    expect(names()).toHaveLength(51);
    expect(screen.queryByRole("navigation", { name: /pagination/i })).not.toBeInTheDocument();
  });

  it("pages at 60 packages and keeps the page in the URL", async () => {
    const user = userEvent.setup();
    mockIndex.mockReturnValue({ data: indexWith(61), loading: false, error: null });
    renderPage();

    expect(names()).toHaveLength(60);
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("?page=2");
    expect(names()).toEqual(["opentelemetry-instrumentation-pkg060"]);
  });

  it("exposes the filter drawer toggle with the active filter count", () => {
    renderPage("/python/instrumentation?metrics=supported,unknown");

    expect(screen.getByRole("button", { name: "Open filters (2 active)" })).toBeInTheDocument();
  });

  it("opens the filters as a drawer on a narrow screen and closes it with Escape", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          media: query,
          matches: false,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
        }) as unknown as MediaQueryList
    );
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open filters" }));
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("checkbox", { name: /Supports metrics/ })
    ).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
