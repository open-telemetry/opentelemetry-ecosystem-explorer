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
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFetchInterceptor, uninstallFetchInterceptor } from "./helpers/fetch-interceptor";
import { renderBuilderPage as renderPage } from "./helpers/render-builder-page";
import { openInstrumentationTab } from "./helpers/open-instrumentation-tab";

beforeAll(() => installFetchInterceptor());
afterAll(() => uninstallFetchInterceptor());
beforeEach(() => localStorage.clear());

async function clickTab(name: RegExp) {
  const user = userEvent.setup();
  const sidebar = screen.getByRole("complementary");
  await user.click(within(sidebar).getByRole("tab", { name }));
}

describe("ConfigurationBuilderPage tab state preservation", () => {
  /*
   * Regression test for the fix that hoisted ConfigurationBuilderProvider above
   * <Tabs>. Radix unmounts the inactive TabsContent, so a provider nested
   * per-tab would be torn down on every switch, discarding unsaved edits. With
   * a single hoisted provider, edits made on one tab must survive switching
   * away and back.
   */
  it("preserves an unsaved edit when switching tabs and back", async () => {
    renderPage();
    const user = userEvent.setup();

    // Resource is enabled by the starter; toggle it OFF on the SDK tab.
    const resourceToggle = await screen.findByRole(
      "switch",
      { name: /Enable Resource/i },
      { timeout: 10_000 }
    );
    expect(resourceToggle).toHaveAttribute("aria-checked", "true");
    await user.click(resourceToggle);
    await waitFor(() => {
      expect(resourceToggle).toHaveAttribute("aria-checked", "false");
    });

    // Switch to the Instrumentation tab (unmounts the SDK TabsContent)...
    await openInstrumentationTab(user);
    await screen.findByTestId("instrumentation-row-reactor", {}, { timeout: 10_000 });

    // ...and back to the SDK tab. The toggle must still reflect the edit.
    await clickTab(/SDK/i);
    const resourceToggleAgain = await screen.findByRole(
      "switch",
      { name: /Enable Resource/i },
      { timeout: 10_000 }
    );
    expect(resourceToggleAgain).toHaveAttribute("aria-checked", "false");
  });

  it("keeps the toggled-off section out of the YAML preview after a tab round-trip", async () => {
    renderPage();
    const user = userEvent.setup();

    const resourceToggle = await screen.findByRole(
      "switch",
      { name: /Enable Resource/i },
      { timeout: 10_000 }
    );
    await user.click(resourceToggle);
    await waitFor(() => {
      expect(resourceToggle).toHaveAttribute("aria-checked", "false");
    });

    await openInstrumentationTab(user);
    await screen.findByTestId("instrumentation-row-reactor", {}, { timeout: 10_000 });
    await clickTab(/SDK/i);

    await screen.findByRole("switch", { name: /Enable Resource/i }, { timeout: 10_000 });
    const pre = screen.getByText(/OpenTelemetry SDK Configuration/).closest("pre");
    expect(pre?.textContent).not.toMatch(/^resource:/m);
  });
});
