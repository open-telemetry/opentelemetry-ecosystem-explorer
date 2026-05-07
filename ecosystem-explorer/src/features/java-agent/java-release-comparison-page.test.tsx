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
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { JavaReleaseComparisonPage } from "./java-release-comparison-page";
import { useVersions } from "@/hooks/use-javaagent-data";
import { useReleaseComparison } from "./hooks/use-release-comparison";

vi.mock("@/hooks/use-javaagent-data", () => ({
  useVersions: vi.fn(),
}));

vi.mock("./hooks/use-release-comparison", () => ({
  useReleaseComparison: vi.fn(),
}));

vi.mock("@/components/ui/back-button", () => ({
  BackButton: () => <button>Back</button>,
}));

// Mock the Tabs components to avoid Radix UI complexities in tests
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid="tabs" data-value={value}>
      {children}
    </div>
  ),
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
}));

vi.mock("@/components/ui/segmented-tabs", () => ({
  SegmentedTabList: ({
    tabs,
    value,
  }: {
    tabs: { value: string; label: string }[];
    value: string;
  }) => (
    <div data-testid="tab-list">
      {tabs.map((t) => (
        <button key={t.value} data-active={t.value === value}>
          {t.label}
        </button>
      ))}
    </div>
  ),
}));

function renderPage(initialPath = "/java-agent/releases?from=1.9.0&to=2.0.0") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/java-agent/releases" element={<JavaReleaseComparisonPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("JavaReleaseComparisonPage", () => {
  const mockVersions = [
    { version: "2.0.0", is_latest: true },
    { version: "1.9.0", is_latest: false },
    { version: "1.8.0", is_latest: false },
  ];

  const mockDiff = {
    fromVersion: "1.9.0",
    toVersion: "2.0.0",
    instrumentations: [
      {
        id: "http-client",
        displayName: "HTTP Client",
        status: "changed" as const,
        telemetryDiff: {
          metrics: [
            {
              status: "changed" as const,
              metric: {
                name: "http.client.duration",
                description: "Duration",
                instrument: "histogram" as const,
                data_type: "HISTOGRAM" as const,
                unit: "ms",
              },
            },
          ],
          spans: [],
        },
        configDiff: {
          added: ["otel.http.client.timeout"],
          removed: [],
          changed: [],
        },
      },
    ],
    aggregateMetrics: [
      {
        name: "http.client.duration",
        description: "Duration",
        emittedBy: ["HTTP Client"],
      },
    ],
    totals: { added: 1, removed: 0, changed: 1 },
  };

  beforeEach(() => {
    vi.mocked(useVersions).mockReturnValue({
      data: { versions: mockVersions },
      loading: false,
      error: null,
    });

    vi.mocked(useReleaseComparison).mockReturnValue({
      diff: mockDiff,
      loading: false,
      error: null,
    });
  });

  it("renders page title", async () => {
    renderPage();
    expect(screen.getByText("Release Comparison")).toBeInTheDocument();
  });

  it("displays summary totals when diff is available", async () => {
    renderPage();

    await waitFor(() => {
      // The count and label are in separate <p> elements.
      // With added=1 and changed=1 (singular), the labels are:
      expect(screen.getByText("Instrumentation Added")).toBeInTheDocument();
      expect(screen.getByText("Instrumentation Changed")).toBeInTheDocument();
    });
  });

  it("shows error message on failure", async () => {
    vi.mocked(useReleaseComparison).mockReturnValue({
      diff: null,
      loading: false,
      error: new Error("Fetch failed"),
    });

    renderPage();
    expect(screen.getByText(/Fetch failed/i)).toBeInTheDocument();
  });

  it("shows invalid comparison message for same versions", async () => {
    renderPage("/java-agent/releases?from=2.0.0&to=2.0.0");
    expect(screen.getByText(/Select two different versions/i)).toBeInTheDocument();
  });
});
