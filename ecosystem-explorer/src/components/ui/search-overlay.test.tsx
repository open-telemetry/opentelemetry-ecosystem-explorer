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
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SearchOverlay } from "./search-overlay";

vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}));

vi.mock("@/lib/search", async () => {
  const actual = await vi.importActual<typeof import("@/lib/search")>("@/lib/search");

  return {
    ...actual,
    search: vi.fn(),
  };
});

import { search as performSearch } from "@/lib/search";

describe("SearchOverlay", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(performSearch).mockReset();
  });

  it("navigates when a Java Agent search result is clicked", async () => {
    const user = userEvent.setup();

    vi.mocked(performSearch).mockResolvedValue([
      {
        title: "Kafka Client",
        description: "Messaging instrumentation for Kafka",
        path: "/java-agent/instrumentation/1.2.3/kafka-client",
        type: "item",
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<SearchOverlay onClose={vi.fn()} />} />
          <Route
            path="/java-agent/instrumentation/:version/:name"
            element={<div>Instrumentation detail page</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByRole("textbox", { name: "Search" }), "kafka");

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /kafka client/i })).toBeInTheDocument()
    );

    await user.click(screen.getByRole("link", { name: /kafka client/i }));

    await waitFor(() => {
      expect(screen.getByText("Instrumentation detail page")).toBeInTheDocument();
    });
  });
});
