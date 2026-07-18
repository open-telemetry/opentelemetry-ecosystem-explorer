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
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AboutPage } from "./about-page";

const SAMPLE_JAVA_AGENT_STATS = { version_count: 5, library_count: 263 };
const SAMPLE_COLLECTOR_STATS = { version_count: 7, component_count: 271 };

function stubFetch(byUrl: Record<string, { ok: boolean; status?: number; body?: unknown }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const response = byUrl[url];
      if (!response) throw new Error(`Unexpected fetch to ${url}`);
      return Promise.resolve({
        ok: response.ok,
        status: response.status ?? 200,
        json: async () => response.body,
      });
    })
  );
}

describe("AboutPage", () => {
  beforeEach(() => {
    stubFetch({
      "/data/javaagent/ecosystem-stats.json": { ok: true, body: SAMPLE_JAVA_AGENT_STATS },
      "/data/collector/ecosystem-stats.json": { ok: true, body: SAMPLE_COLLECTOR_STATS },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderAboutPage() {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  }

  it("renders the page heading", async () => {
    await renderAboutPage();

    expect(screen.getByRole("heading", { name: "About", level: 1 })).toBeInTheDocument();
  });

  it("renders the Goals section", async () => {
    await renderAboutPage();

    expect(screen.getByRole("heading", { name: "Goals" })).toBeInTheDocument();
  });

  it("renders the Get Involved section with links", async () => {
    await renderAboutPage();

    expect(screen.getByRole("heading", { name: "Get Involved" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /source code/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /report a bug/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request a feature/i })).toBeInTheDocument();
  });

  it("renders the Contributing section", async () => {
    await renderAboutPage();

    expect(screen.getByRole("heading", { name: "Contributing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contributing guide/i })).toBeInTheDocument();
  });

  it("source code link points to the GitHub repo", async () => {
    await renderAboutPage();

    const link = screen.getByRole("link", { name: /source code/i });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/open-telemetry/opentelemetry-ecosystem-explorer"
    );
  });

  describe("Ecosystems section", () => {
    it("renders the loading state before data arrives", () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => new Promise(() => {}))
      );

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: "Ecosystems" })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Loading ecosystem stats");
    });

    it("renders computed Java Agent and Collector stats once loaded", async () => {
      stubFetch({
        "/data/javaagent/ecosystem-stats.json": { ok: true, body: SAMPLE_JAVA_AGENT_STATS },
        "/data/collector/ecosystem-stats.json": { ok: true, body: SAMPLE_COLLECTOR_STATS },
      });

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      await waitFor(() => expect(screen.getByText("5 Versions")).toBeInTheDocument());
      expect(screen.getByText("263 instrumentation libraries")).toBeInTheDocument();
      expect(screen.getByText("7 Versions")).toBeInTheDocument();
      expect(screen.getByText("271 Components")).toBeInTheDocument();
    });

    it("renders an error state when a stats fetch fails", async () => {
      stubFetch({
        "/data/javaagent/ecosystem-stats.json": { ok: true, body: SAMPLE_JAVA_AGENT_STATS },
        "/data/collector/ecosystem-stats.json": { ok: false, status: 500 },
      });

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("couldn't load ecosystem stats")
      );
    });
  });
});
