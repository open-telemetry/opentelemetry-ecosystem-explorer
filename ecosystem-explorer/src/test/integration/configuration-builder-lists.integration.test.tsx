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
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFetchInterceptor, uninstallFetchInterceptor } from "./helpers/fetch-interceptor";
import { renderBuilderPage as renderPage } from "./helpers/render-builder-page";

beforeAll(() => installFetchInterceptor());
afterAll(() => uninstallFetchInterceptor());

describe("ConfigurationBuilderPage — lists + plugin select", () => {
  it("adds a processor item to logger_provider.processors", async () => {
    renderPage();
    const user = userEvent.setup();

    // Wait for top-level cards to render.
    await screen.findByRole("switch", { name: /Enable Logger Provider/i }, { timeout: 10_000 });

    // The Processors list lives inside the Logger Provider card and starts
    // collapsed at depth >= 1. Click the chevron to reveal its items.
    const expandProcessors = await screen.findAllByRole("button", {
      name: /Expand Processors/i,
    });
    await user.click(expandProcessors[0]);

    // Locate its Add button by accessible name.
    const addButtons = await screen.findAllByRole("button", {
      name: /Add item to Processors/i,
    });
    expect(addButtons.length).toBeGreaterThan(0);

    // Each list item renders as a <li>; count those rather than relying on a
    // specific derived label (existing items may render "Batch" / "Simple"
    // via Tier 1, new items "Processor N" via Tier 3).
    const before = screen.getAllByRole("listitem").length;
    await user.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(before);
    });
  });
});
