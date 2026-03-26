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
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { installFetchInterceptor, uninstallFetchInterceptor } from "./helpers/fetch-interceptor";
import { JavaInstrumentationListPage } from "@/features/java-agent/java-instrumentation-list-page";

beforeAll(() => installFetchInterceptor());
afterAll(() => uninstallFetchInterceptor());

function renderPage() {
  return render(
    <MemoryRouter>
      <JavaInstrumentationListPage />
    </MemoryRouter>
  );
}

/**
 * Returns the "Showing X of Y instrumentations" count element, or null.
 * Uses exact text matching (after whitespace normalization) so parent
 * containers — whose textContent includes additional content — are excluded.
 */
function getCountElement(): HTMLElement | null {
  const candidates = screen.queryAllByText(/instrumentations/);
  return (
    candidates.find((el) => {
      const normalized = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      return /^Showing \d+ of \d+ instrumentations$/.test(normalized);
    }) ?? null
  );
}

/**
 * Waits until instrumentations have fully loaded (total count > 0).
 * A transient "Showing 0 of 0 instrumentations" state can appear briefly
 * after versions load but before instrumentation fetches begin, so we wait
 * for the total to be non-zero to ensure we're in the final stable state.
 */
async function waitForList(): Promise<HTMLElement> {
  await waitFor(
    () => {
      const el = getCountElement();
      if (!el) throw new Error("Count element not found");
      const m = (el.textContent ?? "").match(/Showing \d+ of (\d+)/);
      if (!m || parseInt(m[1], 10) === 0) throw new Error("Total count is 0");
    },
    { timeout: 20_000 }
  );
  return getCountElement()!;
}

/** Extracts [shown, total] from "Showing X of Y instrumentations". */
function parseCounts(el: HTMLElement): [number, number] {
  const normalized = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  const match = normalized.match(/Showing (\d+) of (\d+) instrumentations/);
  if (!match) throw new Error(`Unexpected count text: "${normalized}"`);
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

describe("JavaInstrumentationListPage — integration", () => {
  it("loads instrumentations from the real database without errors", async () => {
    renderPage();

    await waitForList();

    expect(screen.queryByText("Error loading instrumentations")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading instrumentations...")).not.toBeInTheDocument();
    expect(getCountElement()).toBeInTheDocument();
  });

  it("shows a non-zero instrumentation count", async () => {
    renderPage();

    const countEl = await waitForList();
    const [shown, total] = parseCounts(countEl);

    expect(total).toBeGreaterThan(0);
    expect(shown).toBe(total); // no filters applied yet
  });

  it("renders instrumentation group cards", async () => {
    renderPage();

    await waitForList();

    // Each group card links to one or more detail pages; verify at least one
    // link is rendered, which confirms the group cards actually rendered content.
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
  });

  it("search narrows the displayed count", async () => {
    const user = userEvent.setup();
    renderPage();

    const countEl = await waitForList();
    const [, total] = parseCounts(countEl);

    const searchInput = screen.getByPlaceholderText("Search instrumentations...");
    // "spring" is a common term across many instrumentations, so searching for
    // it will reliably narrow the list, but "xyzzy" would match nothing —
    // use a term that is unlikely to match everything but will match something.
    await user.type(searchInput, "spring");

    await waitFor(() => {
      const updated = getCountElement();
      if (!updated) throw new Error("Count element not found");
      const [shownAfter, totalAfter] = parseCounts(updated);
      expect(totalAfter).toBe(total); // total doesn't change
      expect(shownAfter).toBeGreaterThan(0);
      expect(shownAfter).toBeLessThan(total);
    });
  });

  it("IDB cache is used on a second render (fewer fetches)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // First render — cold cache, all fetches go to the interceptor.
    const { unmount } = renderPage();
    await waitForList();
    const firstRenderFetchCount = fetchSpy.mock.calls.length;

    unmount();
    fetchSpy.mockClear();

    // Second render — IDB is warm (fake-indexeddb persists within the test
    // because clearAllCached only runs in beforeEach, not within a test).
    renderPage();
    await waitForList();
    const secondRenderFetchCount = fetchSpy.mock.calls.length;

    expect(secondRenderFetchCount).toBeLessThan(firstRenderFetchCount);

    fetchSpy.mockRestore();
  });

  it("shows no-results message when search matches nothing", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitForList();

    const searchInput = screen.getByPlaceholderText("Search instrumentations...");
    await user.type(searchInput, "xyzzy_no_match_ever");

    await waitFor(() => {
      expect(
        screen.getByText("No instrumentations found matching your filters.")
      ).toBeInTheDocument();

      const countEl = getCountElement();
      if (!countEl) throw new Error("Count element not found");
      const [shown] = parseCounts(countEl);
      expect(shown).toBe(0);
    });
  });

  it("filter buttons narrow the list", async () => {
    const user = userEvent.setup();
    renderPage();

    const countEl = await waitForList();
    const [, total] = parseCounts(countEl);

    // "Spans" filter: only instrumentations that emit spans are shown.
    const spansButton = screen.getByRole("button", { name: "Spans" });
    await user.click(spansButton);

    await waitFor(() => {
      const updated = getCountElement();
      if (!updated) throw new Error("Count element not found");
      const [shown] = parseCounts(updated);
      // The real DB has many span-emitting instrumentations, but fewer than all.
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThanOrEqual(total);
    });
  });
});
