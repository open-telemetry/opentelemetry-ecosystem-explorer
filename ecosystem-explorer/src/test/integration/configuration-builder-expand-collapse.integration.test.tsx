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
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFetchInterceptor, uninstallFetchInterceptor } from "./helpers/fetch-interceptor";
import { renderBuilderPage as renderPage } from "./helpers/render-builder-page";
import { openInstrumentationTab } from "./helpers/open-instrumentation-tab";

beforeAll(() => {
  installFetchInterceptor();
});
afterAll(() => {
  uninstallFetchInterceptor();
});
beforeEach(() => {
  localStorage.clear();
  cleanup();
});

describe("ConfigurationBuilderPage Expand all / Collapse all", () => {
  it("drives every collapsible section chevron on the SDK tab", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("switch", { name: /Enable Resource/i }, { timeout: 10_000 });

    // Scope to the section chevrons only. The toolbar "Expand all"/"Collapse all"
    // buttons match the name regex but carry no aria-expanded, and the
    // "Expand YAML preview" dialog trigger lives in the Output Preview region —
    // both must be excluded so the assertion targets disclosure chevrons.
    const previewRegion = screen.getByRole("region", { name: /Output Preview/i });
    const sectionChevrons = () =>
      screen
        .getAllByRole("button", { name: /^(Expand|Collapse) / })
        .filter((b) => b.hasAttribute("aria-expanded") && !previewRegion.contains(b));

    await user.click(screen.getByRole("button", { name: /^Expand all$/i }));
    const opened = sectionChevrons();
    expect(opened.length).toBeGreaterThan(0);
    expect(opened.every((b) => b.getAttribute("aria-expanded") === "true")).toBe(true);

    await user.click(screen.getByRole("button", { name: /^Collapse all$/i }));
    expect(sectionChevrons().every((b) => b.getAttribute("aria-expanded") === "false")).toBe(true);
  });

  it("drives every instrumentation module row on the Instrumentation tab", async () => {
    renderPage();
    const user = userEvent.setup();
    await openInstrumentationTab(user);
    await screen.findAllByTestId(/^instrumentation-row-/, {}, { timeout: 10_000 });

    const rows = () => document.querySelectorAll('[data-testid^="instrumentation-row-"]');

    await user.click(screen.getByRole("button", { name: /^Expand all$/i }));
    const opened = Array.from(rows());
    expect(opened.length).toBeGreaterThan(0);
    expect(opened.every((el) => el.getAttribute("data-expanded") === "true")).toBe(true);

    await user.click(screen.getByRole("button", { name: /^Collapse all$/i }));
    expect(Array.from(rows()).every((el) => el.getAttribute("data-expanded") === "false")).toBe(
      true
    );
  });
});
