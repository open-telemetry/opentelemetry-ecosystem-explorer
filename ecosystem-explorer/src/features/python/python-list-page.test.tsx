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
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { pythonIndex } from "@/test/python-fixtures";
import { PythonListPage } from "./python-list-page";

vi.mock("@/hooks/use-python-data", () => ({
  usePythonIndex: vi.fn(),
  usePythonPackage: vi.fn(),
}));

vi.mock("@/components/ui/back-button", () => ({
  BackButton: () => <button>Back</button>,
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
        <Route path="/python/instrumentation" element={<PythonListPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

const names = () =>
  screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

beforeEach(() => {
  mockIndex.mockReturnValue({ data: pythonIndex, loading: false, error: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PythonListPage", () => {
  it("lists every package by its full name, sorted, with the registry description", () => {
    renderPage();

    expect(names()).toEqual([
      "opentelemetry-instrumentation-asyncpg",
      "opentelemetry-instrumentation-click",
      "opentelemetry-instrumentation-flask",
    ]);
    expect(screen.getByText("Flask instrumentation for OpenTelemetry")).toBeInTheDocument();
    expect(screen.getByText("Showing 3 of 3 (3 total)")).toBeInTheDocument();
  });

  it("links each card to its detail page", () => {
    renderPage();

    expect(
      screen.getByRole("link", {
        name: "View details for opentelemetry-instrumentation-flask",
      })
    ).toHaveAttribute("href", "/python/instrumentation/opentelemetry-instrumentation-flask");
  });

  it("shows unknown metrics as Not specified and unsupported as No metrics", () => {
    renderPage();

    const badge = (name: RegExp) =>
      screen.getByRole("link", { name }).querySelector("[data-metrics]");
    expect(badge(/instrumentation-click/)).toHaveTextContent("Not specified");
    expect(badge(/instrumentation-click/)).toHaveAttribute("data-metrics", "unknown");
    expect(badge(/instrumentation-asyncpg/)).toHaveTextContent("No metrics");
    expect(badge(/instrumentation-flask/)).toHaveTextContent("Supports metrics");
    const flask = screen.getByRole("link", { name: /instrumentation-flask/ });
    expect(within(flask).getByText("Migration")).toBeInTheDocument();
  });

  it("shows the loading state", () => {
    mockIndex.mockReturnValue({ data: null, loading: true, error: null });
    renderPage();

    expect(screen.getByText("Loading Python packages…")).toBeInTheDocument();
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });

  it("shows an error with its message", () => {
    mockIndex.mockReturnValue({ data: null, loading: false, error: new Error("network down") });
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load Python packages");
    expect(screen.getByRole("alert")).toHaveTextContent("network down");
  });

  it("shows an empty state when the database has no packages", () => {
    mockIndex.mockReturnValue({
      data: { ecosystem: "python", packages: [] },
      loading: false,
      error: null,
    });
    renderPage();

    expect(screen.getByText("No packages match")).toBeInTheDocument();
    expect(screen.getByText("There are no Python packages to show.")).toBeInTheDocument();
  });

  it("colours each metrics filter differently and highlights the one that is on", async () => {
    const user = userEvent.setup();
    renderPage();
    const supported = screen.getByRole("button", { name: /Supports metrics/ });
    const unsupported = screen.getByRole("button", { name: /No metrics/ });
    const unknown = screen.getByRole("button", { name: /Not specified \(1\)/ });

    expect(supported.className).toContain("green");
    expect(unsupported.className).toContain("amber");
    expect(unknown.className).toContain("slate");
    const before = supported.className;

    await user.click(supported);

    expect(screen.getByRole("button", { name: /Supports metrics/ }).className).not.toBe(before);
    expect(screen.getByRole("button", { name: /Supports metrics/ }).className).toContain("ring-1");
  });

  it("applies the search from the URL", () => {
    renderPage("/python/instrumentation?q=click");

    expect(names()).toEqual(["opentelemetry-instrumentation-click"]);
    expect(screen.getByLabelText("Search")).toHaveValue("click");
    expect(screen.getByText("Showing 1 of 1 (3 total)")).toBeInTheDocument();
  });

  it("writes the search to the URL as it is typed, keeping spaces in the input", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Search"), "flask inst");

    expect(screen.getByLabelText("Search")).toHaveValue("flask inst");
    expect(screen.getByTestId("location")).toHaveTextContent("?q=flask+inst");
    expect(names()).toEqual(["opentelemetry-instrumentation-flask"]);
  });

  it("matches the description as well as the name", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Search"), "asyncpg instrumentation for");

    expect(names()).toEqual(["opentelemetry-instrumentation-asyncpg"]);
  });

  it("filters on a metrics facet with aria-pressed toggles and a URL param", async () => {
    const user = userEvent.setup();
    renderPage();
    const unknown = screen.getByRole("button", { name: "Not specified (1)", pressed: false });

    await user.click(unknown);

    expect(screen.getByRole("button", { name: "Not specified (1)", pressed: true })).toBe(unknown);
    expect(names()).toEqual(["opentelemetry-instrumentation-click"]);
    expect(screen.getByTestId("location")).toHaveTextContent("?metrics=unknown");

    await user.click(screen.getByRole("button", { name: "No metrics (1)" }));
    expect(names()).toEqual([
      "opentelemetry-instrumentation-asyncpg",
      "opentelemetry-instrumentation-click",
    ]);
    expect(screen.getByTestId("location")).toHaveTextContent("?metrics=unknown%2Cunsupported");
  });

  it("applies filters from the URL and reflects them in the toggles", () => {
    renderPage("/python/instrumentation?metrics=supported&semconv=migration");

    expect(names()).toEqual(["opentelemetry-instrumentation-flask"]);
    expect(
      screen.getByRole("button", { name: "Supports metrics (1)", pressed: true })
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Migration (1)", pressed: true })).toBeVisible();
  });

  it("filters on semantic-convention status with null counted as Not specified", async () => {
    const user = userEvent.setup();
    renderPage();

    const group = screen.getByRole("group", { name: "Semantic conventions" });
    await user.click(within(group).getByRole("button", { name: "Not specified (2)" }));

    expect(names()).toEqual([
      "opentelemetry-instrumentation-asyncpg",
      "opentelemetry-instrumentation-click",
    ]);
  });

  it("shows a filtered empty state and resets everything", async () => {
    const user = userEvent.setup();
    renderPage("/python/instrumentation?q=nothing-matches&metrics=supported");

    expect(screen.getByText("No packages match")).toBeInTheDocument();
    expect(screen.getByText("Try a different search or clear the filters.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset filters" }));

    expect(names()).toHaveLength(3);
    expect(screen.getByLabelText("Search")).toHaveValue("");
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/python\/instrumentation$/);
  });

  it("hides Reset filters until something is filtered", () => {
    renderPage();

    expect(screen.queryByRole("button", { name: "Reset filters" })).not.toBeInTheDocument();
  });

  it("omits the semantic-convention facet when no package has a status", () => {
    mockIndex.mockReturnValue({
      data: {
        ecosystem: "python",
        packages: pythonIndex.packages.map((p) => ({ ...p, semantic_convention_status: null })),
      },
      loading: false,
      error: null,
    });
    renderPage();

    expect(screen.queryByText("Semantic conventions")).not.toBeInTheDocument();
    expect(names()).toHaveLength(3);
  });
});
