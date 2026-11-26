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
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/theme-context";
import { LegacyApp } from "@/LegacyApp";
import { packagesByName, pythonIndex } from "@/test/python-fixtures";

vi.mock("@/hooks/use-python-data", () => ({
  usePythonIndex: vi.fn(),
  usePythonPackage: vi.fn(),
}));

import { usePythonIndex, usePythonPackage } from "@/hooks/use-python-data";

const FLASK = "opentelemetry-instrumentation-flask";

async function renderApp(path: string) {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <LegacyApp />
      </MemoryRouter>
    </ThemeProvider>
  );
  // A first visit imports its lazy page; flush the import and the suspended transition.
  await act(async () => {
    await vi.dynamicImportSettled();
  });
}

beforeEach(() => {
  (usePythonIndex as ReturnType<typeof vi.fn>).mockReturnValue({
    data: pythonIndex,
    loading: false,
    error: null,
  });
  (usePythonPackage as ReturnType<typeof vi.fn>).mockImplementation((name: string) => ({
    data: name ? (packagesByName[name] ?? null) : null,
    loading: false,
    error: null,
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LegacyApp Python routes", () => {
  it("serves the catalogue at /python/instrumentation", async () => {
    await renderApp("/python/instrumentation");

    expect(
      screen.getByRole("heading", { level: 1, name: "Python instrumentation" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Showing 3 of 3/)).toBeInTheDocument();
  });

  it("serves a package at /python/instrumentation/:name", async () => {
    await renderApp(`/python/instrumentation/${FLASK}`);

    expect(screen.getByRole("heading", { level: 1, name: FLASK })).toBeInTheDocument();
  });

  it("passes the route's name and ?version= to the package loader", async () => {
    await renderApp(`/python/instrumentation/${FLASK}?version=0.66b1`);

    expect(usePythonPackage).toHaveBeenLastCalledWith(FLASK, "0.66b1");
  });

  it("has no separate /python landing page: it is the not-found page", async () => {
    await renderApp("/python");

    expect(
      screen.queryByRole("heading", { name: "Python instrumentation" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing 3 of 3/)).not.toBeInTheDocument();
  });

  it("does not match deeper paths", async () => {
    await renderApp(`/python/instrumentation/${FLASK}/extra`);

    expect(screen.queryByRole("heading", { level: 1, name: FLASK })).not.toBeInTheDocument();
  });
});

describe("LegacyApp header", () => {
  it("links to the Python catalogue", async () => {
    await renderApp("/");

    expect(screen.getAllByRole("link", { name: "Python" })[0]).toHaveAttribute(
      "href",
      "/python/instrumentation"
    );
  });
});
