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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import type { InstrumentationData } from "@/types/javaagent";
import { JavaInstrumentationListPage } from "./java-instrumentation-list-page";

vi.mock("@/hooks/use-javaagent-data", () => ({
  useVersions: vi.fn(),
  useInstrumentations: vi.fn(),
}));

vi.mock("@/components/ui/back-button", () => ({
  BackButton: () => <button>Back</button>,
}));

import { useInstrumentations, useVersions } from "@/hooks/use-javaagent-data";

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderPage(initialPath = "/java-agent/instrumentation") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/java-agent/instrumentation" element={<JavaInstrumentationListPage />} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>
  );
}

const mockVersions = {
  data: {
    versions: [
      { version: "2.0.0", is_latest: true },
      { version: "1.9.0", is_latest: false },
    ],
  },
  loading: false,
  error: null,
};

const mockInstrumentations: InstrumentationData[] = [
  {
    name: "http-client",
    display_name: "HTTP Client",
    description: "Instrumentation for HTTP clients",
    scope: { name: "http" },
    has_javaagent: true,
    javaagent_target_versions: ["1.0.0"],
    telemetry: [{ when: "always", spans: [{ span_kind: "CLIENT" }] }],
    semantic_conventions: ["http"],
    features: ["stable"],
  },
  {
    name: "jdbc",
    display_name: "JDBC",
    description: "Database instrumentation for JDBC",
    scope: { name: "jdbc" },
    has_standalone_library: true,
    telemetry: [
      {
        when: "always",
        metrics: [
          {
            name: "db.connections",
            description: "DB connections",
            instrument: "counter",
            data_type: "LONG_SUM",
            unit: "1",
          },
        ],
      },
    ],
    semantic_conventions: ["db"],
  },
  {
    name: "kafka-client",
    display_name: "Kafka Client",
    description: "Messaging instrumentation for Kafka",
    scope: { name: "kafka" },
    has_javaagent: true,
    javaagent_target_versions: ["1.0.0"],
    has_standalone_library: true,
    telemetry: [
      {
        when: "always",
        spans: [{ span_kind: "PRODUCER" }],
        metrics: [
          {
            name: "kafka.messages",
            description: "Messages sent",
            data_type: "COUNTER",
            instrument: "counter",
            unit: "1",
          },
        ],
      },
    ],
    semantic_conventions: ["messaging"],
    features: ["stable"],
  },
  {
    name: "spring-web",
    display_name: "Spring Web",
    description: "Instrumentation for Spring Web applications",
    scope: { name: "spring" },
    has_javaagent: true,
    javaagent_target_versions: ["1.0.0"],
    features: ["experimental"],
  },
];

describe("JavaInstrumentationListPage - URL Persistence", () => {
  beforeEach(() => {
    vi.mocked(useVersions).mockReturnValue(mockVersions);
    vi.mocked(useInstrumentations).mockReturnValue({
      data: mockInstrumentations,
      loading: false,
      error: null,
    });
  });

  it("reads search query from URL on mount", async () => {
    renderPage("/java-agent/instrumentation?search=kafka");

    await waitFor(() => {
      expect(screen.getByText("Kafka Client")).toBeInTheDocument();
      expect(screen.queryByText("HTTP Client")).not.toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search instrumentations...");
    expect(searchInput).toHaveValue("kafka");
  });

  it("writes search query to URL when user types", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "http");

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toContain("search=http");
    });
  });

  it("reads telemetry filter from URL on mount", async () => {
    renderPage("/java-agent/instrumentation?telemetry=spans");

    await waitFor(() => {
      expect(screen.getByText("HTTP Client")).toBeInTheDocument();
      expect(screen.getByText("Kafka Client")).toBeInTheDocument();
      expect(screen.queryByText("JDBC")).not.toBeInTheDocument();
    });
  });

  it("writes telemetry filter to URL when toggled", async () => {
    const user = userEvent.setup();
    renderPage();

    const spansButton = await screen.findByRole("button", { name: "Spans" });
    await user.click(spansButton);

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toContain("telemetry=spans");
    });
  });

  it("reads type filter from URL on mount", async () => {
    renderPage("/java-agent/instrumentation?type=javaagent");

    await waitFor(() => {
      expect(screen.getByText("HTTP Client")).toBeInTheDocument();
      expect(screen.queryByText("JDBC")).not.toBeInTheDocument();
    });
  });

  it("writes type filter to URL when toggled", async () => {
    const user = userEvent.setup();
    renderPage();

    const javaAgentButton = await screen.findByRole("button", { name: "Java Agent" });
    await user.click(javaAgentButton);

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toContain("type=javaagent");
    });
  });

  it("preserves existing search params when redirecting no-version to latest", async () => {
    renderPage("/java-agent/instrumentation?version=latest&search=kafka&telemetry=spans");

    await waitFor(() => {
      const loc = screen.getByTestId("location").textContent ?? "";
      expect(loc).not.toContain("2.0.0");
      expect(loc).toContain("search=kafka");
      expect(loc).toContain("telemetry=spans");
    });
  });
});

describe("JavaInstrumentationListPage - Filtering", () => {
  beforeEach(() => {
    vi.mocked(useVersions).mockReturnValue(mockVersions);
    vi.mocked(useInstrumentations).mockReturnValue({
      data: mockInstrumentations,
      loading: false,
      error: null,
    });
  });

  it("displays all instrumentations initially", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("HTTP Client")).toBeInTheDocument();
      expect(screen.getByText("JDBC")).toBeInTheDocument();
      expect(screen.getByText("Kafka Client")).toBeInTheDocument();
      expect(screen.getByText("Spring Web")).toBeInTheDocument();
    });

    expect(screen.getByText("Showing 4 of 4 instrumentations")).toBeInTheDocument();
  });

  it("renders the version selector with available versions", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("HTTP Client")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox", { name: /version/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /2\.0\.0/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /1\.9\.0/ })).toBeInTheDocument();
  });

  it("filters instrumentations by search term in name", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "kafka");

    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.queryByText("HTTP Client")).not.toBeInTheDocument();
    expect(screen.queryByText("JDBC")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 4 instrumentations")).toBeInTheDocument();
  });

  it("filters instrumentations by search term in description", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "database");

    expect(screen.getByText("JDBC")).toBeInTheDocument();
    expect(screen.queryByText("HTTP Client")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 4 instrumentations")).toBeInTheDocument();
  });

  it("search is case insensitive", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "KAFKA");

    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 4 instrumentations")).toBeInTheDocument();
  });

  it("filters by raw instrumentation id", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "http-client");

    expect(screen.getByText("HTTP Client")).toBeInTheDocument();
    expect(screen.queryByText("Kafka Client")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 4 instrumentations")).toBeInTheDocument();
  });

  it("searches by formatted name when display_name is absent", async () => {
    const user = userEvent.setup();
    vi.mocked(useInstrumentations).mockReturnValue({
      data: [
        {
          name: "redis-client-3.2.1",
          scope: { name: "redis" },
        },
      ],
      loading: false,
      error: null,
    });

    renderPage();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "Redis Client");

    expect(screen.getByText("Redis Client")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 1 instrumentations")).toBeInTheDocument();
  });

  it("filters by spans telemetry", async () => {
    const user = userEvent.setup();
    renderPage();

    const spansButton = await screen.findByRole("button", { name: "Spans" });
    await user.click(spansButton);

    expect(screen.getByText("HTTP Client")).toBeInTheDocument();
    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.queryByText("JDBC")).not.toBeInTheDocument();
    expect(screen.queryByText("Spring Web")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 4 instrumentations")).toBeInTheDocument();
  });

  it("filters by metrics telemetry", async () => {
    const user = userEvent.setup();
    renderPage();

    const metricsButton = await screen.findByRole("button", { name: "Metrics" });
    await user.click(metricsButton);

    expect(screen.getByText("JDBC")).toBeInTheDocument();
    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.queryByText("HTTP Client")).not.toBeInTheDocument();
    expect(screen.queryByText("Spring Web")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 4 instrumentations")).toBeInTheDocument();
  });

  it("filters by both spans and metrics (AND logic)", async () => {
    const user = userEvent.setup();
    renderPage();

    const spansButton = await screen.findByRole("button", { name: "Spans" });
    const metricsButton = await screen.findByRole("button", { name: "Metrics" });

    await user.click(spansButton);
    await user.click(metricsButton);

    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.queryByText("HTTP Client")).not.toBeInTheDocument();
    expect(screen.queryByText("JDBC")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 4 instrumentations")).toBeInTheDocument();
  });

  it("filters by javaagent target type", async () => {
    const user = userEvent.setup();
    renderPage();

    const javaAgentButton = await screen.findByRole("button", { name: "Java Agent" });
    await user.click(javaAgentButton);

    expect(screen.getByText("HTTP Client")).toBeInTheDocument();
    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.getByText("Spring Web")).toBeInTheDocument();
    expect(screen.queryByText("JDBC")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 3 of 4 instrumentations")).toBeInTheDocument();
  });

  it("filters by library target type", async () => {
    const user = userEvent.setup();
    renderPage();

    const libraryButton = await screen.findByRole("button", { name: "Standalone" });
    await user.click(libraryButton);

    expect(screen.getByText("JDBC")).toBeInTheDocument();
    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.queryByText("HTTP Client")).not.toBeInTheDocument();
    expect(screen.queryByText("Spring Web")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 4 instrumentations")).toBeInTheDocument();
  });

  it("combines multiple filters (search + telemetry + target)", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "client");

    const spansButton = await screen.findByRole("button", { name: "Spans" });
    await user.click(spansButton);

    const javaAgentButton = await screen.findByRole("button", { name: "Java Agent" });
    await user.click(javaAgentButton);

    expect(screen.getByText("HTTP Client")).toBeInTheDocument();
    expect(screen.getByText("Kafka Client")).toBeInTheDocument();
    expect(screen.queryByText("JDBC")).not.toBeInTheDocument();
    expect(screen.queryByText("Spring Web")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 4 instrumentations")).toBeInTheDocument();
  });

  it("shows empty state when no instrumentations match filters", async () => {
    const user = userEvent.setup();
    renderPage();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "nonexistent");

    expect(
      screen.getByText("No instrumentations found matching your filters.")
    ).toBeInTheDocument();
    expect(screen.getByText("Showing 0 of 4 instrumentations")).toBeInTheDocument();
  });

  it("shows heading immediately while loading", () => {
    vi.mocked(useInstrumentations).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search instrumentations...")).toBeInTheDocument();
    expect(screen.getByText("Loading instrumentations...")).toBeInTheDocument();
  });

  it("shows error state when data fetch fails", () => {
    vi.mocked(useInstrumentations).mockReturnValue({
      data: null,
      loading: false,
      error: new Error("Failed to load instrumentations"),
    });

    renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search instrumentations...")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Error loading data" })).toBeInTheDocument();
    expect(screen.getByText("Failed to load instrumentations")).toBeInTheDocument();
    expect(screen.getByText("Please try refreshing the page.")).toBeInTheDocument();
  });

  it("filters by semantic conventions (OR logic)", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("HTTP Client")).toBeInTheDocument());

    const semanticButton = screen.getByRole("button", { name: /Semantic Conventions/i });
    await user.click(semanticButton);

    const httpOption = screen.getByRole("option", { name: "http" });
    await user.click(httpOption);

    expect(screen.getByText("HTTP Client")).toBeInTheDocument();
    expect(screen.queryByText("JDBC")).not.toBeInTheDocument();

    const dbOption = screen.getByRole("option", { name: "db" });
    await user.click(dbOption);

    expect(screen.getByText("HTTP Client")).toBeInTheDocument();
    expect(screen.getByText("JDBC")).toBeInTheDocument();
    expect(screen.queryByText("Kafka Client")).not.toBeInTheDocument();
  });

  it("filters by features (OR logic)", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("HTTP Client")).toBeInTheDocument());

    const featuresButton = screen.getByRole("button", { name: /Features/i });
    await user.click(featuresButton);

    const experimentalOption = screen.getByRole("option", { name: "experimental" });
    await user.click(experimentalOption);

    expect(screen.getByText("Spring Web")).toBeInTheDocument();
    expect(screen.queryByText("HTTP Client")).not.toBeInTheDocument();
  });

  it("combines filters from different categories (AND logic)", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText("HTTP Client")).toBeInTheDocument());

    const semanticButton = screen.getByRole("button", { name: /Semantic Conventions/i });
    await user.click(semanticButton);
    await user.click(screen.getByRole("option", { name: "http" }));

    const featuresButton = screen.getByRole("button", { name: /Features/i });
    await user.click(featuresButton);
    await user.click(screen.getByRole("option", { name: "stable" }));

    expect(screen.getByText("HTTP Client")).toBeInTheDocument();
    expect(screen.queryByText("Kafka Client")).not.toBeInTheDocument();
    expect(screen.queryByText("JDBC")).not.toBeInTheDocument();
  });
});

describe("JavaInstrumentationListPage - Pagination", () => {
  type IOCallback = (entries: IntersectionObserverEntry[]) => void;
  interface IOInstance {
    observed: Element[];
    trigger: () => void;
  }
  let instances: IOInstance[] = [];
  const originalIO = globalThis.IntersectionObserver;

  function makeInstrumentations(count: number, prefix = "lib"): InstrumentationData[] {
    return Array.from({ length: count }, (_, i) => {
      const idx = String(i).padStart(3, "0");
      return {
        name: `${prefix}-${idx}`,
        display_name: `${prefix === "lib" ? "Library" : "Custom"} ${idx}`,
        description: `Auto-generated instrumentation ${idx}`,
        scope: { name: `${prefix}-${idx}` },
        has_javaagent: true,
        ...(prefix === "custom" ? { _is_custom: true } : {}),
      } as InstrumentationData;
    });
  }

  function lastInstance(): IOInstance {
    return instances[instances.length - 1];
  }

  beforeEach(() => {
    instances = [];
    class MockIO {
      private cb: IOCallback;
      observed: Element[] = [];
      constructor(cb: IOCallback) {
        this.cb = cb;
        instances.push({
          observed: this.observed,
          trigger: () => {
            this.cb(
              this.observed.map(
                (el) => ({ isIntersecting: true, target: el }) as IntersectionObserverEntry
              )
            );
          },
        });
      }
      observe(el: Element) {
        this.observed.push(el);
      }
      unobserve(el: Element) {
        this.observed = this.observed.filter((o) => o !== el);
      }
      disconnect() {
        this.observed = [];
      }
      takeRecords() {
        return [] as IntersectionObserverEntry[];
      }
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    (
      globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
    ).IntersectionObserver = MockIO as unknown as typeof IntersectionObserver;

    vi.mocked(useVersions).mockReturnValue({
      data: {
        versions: [
          { version: "2.0.0", is_latest: true },
          { version: "1.9.0", is_latest: false },
        ],
      },
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    (
      globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
    ).IntersectionObserver = originalIO;
  });

  it("renders only the first 24 library groups initially when more exist", async () => {
    vi.mocked(useInstrumentations).mockReturnValue({
      data: makeInstrumentations(30),
      loading: false,
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Library 000")).toBeInTheDocument();
    });

    expect(screen.getByText("Library 023")).toBeInTheDocument();
    expect(screen.queryByText("Library 024")).not.toBeInTheDocument();
    expect(screen.queryByText("Library 029")).not.toBeInTheDocument();
    expect(screen.getByTestId("library-sentinel")).toBeInTheDocument();
    expect(screen.getByText("Showing 30 of 30 instrumentations")).toBeInTheDocument();
  });

  it("loads the next page of library groups when the sentinel intersects", async () => {
    vi.mocked(useInstrumentations).mockReturnValue({
      data: makeInstrumentations(30),
      loading: false,
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Library 023")).toBeInTheDocument();
    });

    act(() => {
      lastInstance().trigger();
    });

    expect(screen.getByText("Library 024")).toBeInTheDocument();
    expect(screen.getByText("Library 029")).toBeInTheDocument();
    expect(screen.queryByTestId("library-sentinel")).not.toBeInTheDocument();
  });

  it("paginates the custom section independently of the library section", async () => {
    vi.mocked(useInstrumentations).mockReturnValue({
      data: [...makeInstrumentations(30, "lib"), ...makeInstrumentations(30, "custom")],
      loading: false,
      error: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Library 000")).toBeInTheDocument();
    });

    expect(screen.getByText("Custom 023")).toBeInTheDocument();
    expect(screen.queryByText("Custom 024")).not.toBeInTheDocument();
    expect(screen.getByTestId("library-sentinel")).toBeInTheDocument();
    expect(screen.getByTestId("custom-sentinel")).toBeInTheDocument();
  });

  it("does not render a sentinel when filtered results fit in one page", async () => {
    const user = userEvent.setup();
    vi.mocked(useInstrumentations).mockReturnValue({
      data: makeInstrumentations(30),
      loading: false,
      error: null,
    });

    renderPage();

    await screen.findByText("Library 000");
    expect(screen.getByTestId("library-sentinel")).toBeInTheDocument();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "Library 001");

    expect(screen.getByText("Library 001")).toBeInTheDocument();
    expect(screen.queryByTestId("library-sentinel")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 30 instrumentations")).toBeInTheDocument();
  });

  it("resets pagination when filters change", async () => {
    const user = userEvent.setup();
    vi.mocked(useInstrumentations).mockReturnValue({
      data: makeInstrumentations(30),
      loading: false,
      error: null,
    });

    renderPage();

    await screen.findByText("Library 023");
    act(() => {
      lastInstance().trigger();
    });
    expect(screen.getByText("Library 029")).toBeInTheDocument();

    const searchInput = await screen.findByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "Library");
    await user.clear(searchInput);

    expect(screen.getByText("Library 023")).toBeInTheDocument();
    expect(screen.queryByText("Library 024")).not.toBeInTheDocument();
    expect(screen.getByTestId("library-sentinel")).toBeInTheDocument();
  });
});
