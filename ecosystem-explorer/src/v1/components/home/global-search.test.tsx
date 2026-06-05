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
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/search", () => ({
  search: vi.fn(),
}));

import { search, type SearchResult } from "@/lib/search";
import { INTEGRATIONS_STAT_VALUE } from "@/v1/lib/home-stats";
import { GlobalSearch } from "./global-search";

const mockedSearch = vi.mocked(search);

function renderSearch(props: Parameters<typeof GlobalSearch>[0] = {}) {
  return render(
    <MemoryRouter>
      <GlobalSearch {...props} />
    </MemoryRouter>
  );
}

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    title: "Kafka Receiver",
    description: "Receives messages from Apache Kafka",
    path: "/collector/components/contrib/kafka?version=v0.150.0",
    type: "item",
    ecosystem: "collector",
    facets: ["receiver"],
    stability: "beta",
    version: "v0.150.0",
    ...overrides,
  };
}

beforeEach(() => {
  mockedSearch.mockResolvedValue([]);
});

afterEach(() => {
  window.sessionStorage.clear();
  mockedSearch.mockReset();
});

describe("GlobalSearch", () => {
  it("renders an accessible combobox with the canonical placeholder", () => {
    renderSearch();
    const input = screen.getByRole("combobox", { name: /search the ecosystem/i });
    expect(input).toBeInTheDocument();
    // Guard the source first: an empty value would degrade the placeholder to
    // "Search  components" yet still satisfy the stringContaining check below,
    // so assert independently that the stat actually carries a number.
    expect(INTEGRATIONS_STAT_VALUE).toMatch(/^\d[\d,]*\+?$/);
    // Then assert the placeholder is wired to that canonical value rather than a
    // hardcoded number, so the test tracks home-stats.ts when the count moves.
    expect(input).toHaveAttribute(
      "placeholder",
      expect.stringContaining(`Search ${INTEGRATIONS_STAT_VALUE} components`)
    );
  });

  it("renders suggestion chips below the input", () => {
    renderSearch();
    expect(screen.getByRole("button", { name: /otlp exporter/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /redis instrumentation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /kafka receiver/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /trace sampling/i })).toBeInTheDocument();
  });

  it("focuses the input when ⌘K / Ctrl+K is pressed", () => {
    renderSearch();
    const input = screen.getByRole("combobox") as HTMLInputElement;
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true })
      );
    });
    expect(document.activeElement).toBe(input);
  });

  it("populates the input when a suggestion chip is clicked", () => {
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: /otlp exporter/i }));
    expect(screen.getByRole("combobox")).toHaveValue("otlp exporter");
  });

  it("renders engine results with ecosystem + stability pills, description, and meta line", async () => {
    mockedSearch.mockResolvedValueOnce([makeResult()]);
    renderSearch();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "kafka" } });

    const option = await screen.findByRole(
      "option",
      { name: /Kafka Receiver/i },
      { timeout: 2000 }
    );
    expect(option).toHaveAttribute("href", "/collector/components/contrib/kafka?version=v0.150.0");
    expect(within(option).getByText("collector")).toBeInTheDocument(); // lead pill
    expect(within(option).getByText("Beta")).toBeInTheDocument(); // StatusPill renders capitalized label
    expect(within(option).getByText("Receives messages from Apache Kafka")).toBeInTheDocument();
    expect(within(option).getByText("collector · receiver · v0.150.0")).toBeInTheDocument();
  });

  it("omits the stability pill when a result has no stability (Java Agent items)", async () => {
    mockedSearch.mockResolvedValueOnce([
      makeResult({
        title: "Apache Kafka Client",
        description: "Messaging instrumentation for Kafka",
        path: "/java-agent/instrumentation/2.28.0/kafka-client",
        ecosystem: "java-agent",
        facets: [],
        stability: undefined,
        version: "2.28.0",
      }),
    ]);
    renderSearch();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "kafka" } });

    const option = await screen.findByRole("option", { name: /Apache Kafka Client/i });
    expect(within(option).getByText("java-agent")).toBeInTheDocument();
    expect(within(option).queryByText(/^Beta$|^Stable$|^Alpha$/)).not.toBeInTheDocument();
    expect(within(option).getByText("java-agent · 2.28.0")).toBeInTheDocument();
  });

  it("renders a standalone-library facet in the meta line for Java Agent items that ship as one", async () => {
    mockedSearch.mockResolvedValueOnce([
      makeResult({
        title: "JDBC Instrumentation",
        description: "Database instrumentation",
        path: "/java-agent/instrumentation/2.28.0/jdbc",
        ecosystem: "java-agent",
        facets: ["standalone library"],
        stability: undefined,
        version: "2.28.0",
      }),
    ]);
    renderSearch();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "jdbc" } });

    const option = await screen.findByRole("option", { name: /JDBC Instrumentation/i });
    expect(
      within(option).getByText("java-agent · standalone library · 2.28.0")
    ).toBeInTheDocument();
  });

  it("caps the visible results to 10 and shows an overflow footer", async () => {
    const many = Array.from({ length: 23 }, (_, i) =>
      makeResult({
        title: `Result ${i + 1}`,
        path: `/r/${i + 1}`,
      })
    );
    mockedSearch.mockResolvedValueOnce(many);
    renderSearch();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "anything" } });

    await screen.findByRole("option", { name: /\bResult 1\b/i });
    expect(screen.getAllByRole("option")).toHaveLength(10);
    expect(screen.getByText(/Showing 10 of 23 matches/i)).toBeInTheDocument();
  });

  it("steps through results with arrow keys and activates with Enter", async () => {
    const onSelect = vi.fn();
    mockedSearch.mockResolvedValueOnce([
      makeResult({ title: "First", path: "/r/1" }),
      makeResult({ title: "Second", path: "/r/2" }),
      makeResult({ title: "Third", path: "/r/3" }),
    ]);
    renderSearch({ onSelect });

    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "any" } });
    await screen.findByRole("option", { name: /First/i });

    // Move highlight: 0 → 1 → 2, then press Enter to navigate to the third
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("/r/3");
  });

  it("shows an empty-state message when the engine returns no matches", async () => {
    renderSearch();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz_nothing_matches" } });
    await waitFor(() =>
      expect(screen.getByText(/No matches for "zzz_nothing_matches"/i)).toBeInTheDocument()
    );
  });

  it("shows an error state when the engine throws", async () => {
    mockedSearch.mockRejectedValueOnce(new Error("index unavailable"));
    renderSearch();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "anything" } });
    await waitFor(() =>
      expect(screen.getByText(/Couldn't reach the search index/i)).toBeInTheDocument()
    );
  });
});
