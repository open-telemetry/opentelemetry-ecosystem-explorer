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
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFetchInterceptor, uninstallFetchInterceptor } from "./helpers/fetch-interceptor";
import { renderBuilderPage as renderPage } from "./helpers/render-builder-page";

beforeAll(() => installFetchInterceptor());
afterAll(() => uninstallFetchInterceptor());

describe("ConfigurationBuilderPage — basic", () => {
  it("renders the SDK tab with starter-preloaded sections", async () => {
    renderPage();
    const resourceToggle = await screen.findByRole(
      "switch",
      { name: /Enable Resource/i },
      { timeout: 10_000 }
    );
    expect(resourceToggle).toHaveAttribute("aria-checked", "true");
  });

  it("YAML preview updates when a section is toggled off", async () => {
    renderPage();
    const user = userEvent.setup();
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
    const pre = screen.getByText(/OpenTelemetry SDK Configuration/).closest("pre");
    expect(pre?.textContent).not.toMatch(/^resource:/m);
  });

  it("does not render the instrumentation/development section in the SDK tab", async () => {
    renderPage();

    await screen.findByRole("switch", { name: /Enable Resource/i }, { timeout: 10_000 });

    expect(screen.queryByRole("switch", { name: /Enable Instrumentation/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^Instrumentation$/i, level: 3 })).toBeNull();
  });

  it("does not render the distribution section in the SDK tab", async () => {
    renderPage();

    await screen.findByRole("switch", { name: /Enable Resource/i }, { timeout: 10_000 });

    expect(screen.queryByText("Distribution", { exact: true })).toBeNull();
  });

  it("renders the gradient page title", async () => {
    renderPage();
    const title = await screen.findByRole(
      "heading",
      { name: /Configuration Builder/i, level: 1 },
      { timeout: 10_000 }
    );
    const span = title.querySelector("span.bg-gradient-to-r");
    expect(span).not.toBeNull();
  });

  it("renders the SDK/Instrumentation tabs inside the sidebar", async () => {
    renderPage();
    await screen.findByRole("switch", { name: /Enable Resource/i }, { timeout: 10_000 });
    const sidebar = screen.getByRole("complementary");
    const sdkTab = within(sidebar).getByRole("tab", { name: /SDK/i });
    const instrumentationTab = within(sidebar).getByRole("tab", { name: /Instrumentation/i });
    expect(sdkTab).toBeInTheDocument();
    expect(instrumentationTab).toBeInTheDocument();
  });

  it("renders the TOC nav with one button per visible section, with General first for the root leaves", async () => {
    renderPage();
    await screen.findByRole("switch", { name: /Enable Resource/i }, { timeout: 10_000 });
    const nav = screen.getByRole("navigation", { name: "Configuration sections" });
    const links = within(nav).getAllByRole("button");
    expect(links.map((l) => l.textContent)).toEqual([
      "General",
      "Attribute Limits",
      "Logger Provider",
      "Meter Provider",
      "Propagator",
      "Tracer Provider",
      "Resource",
    ]);
  });

  it("auto-promotes top-level leaf fields into the General card, collapsed by default", async () => {
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("switch", { name: /Enable Resource/i }, { timeout: 10_000 });
    const generalCard = document.querySelector<HTMLElement>('[data-section-key="general"]');
    expect(generalCard).not.toBeNull();
    const general = within(generalCard!);
    expect(general.getByText("General")).toBeInTheDocument();
    // Collapsed by default — leaf fields not in the DOM yet.
    expect(general.queryByText("Disabled")).toBeNull();
    expect(general.queryByText("Log Level")).toBeNull();
    // Click the chevron to expand and reveal the leaves.
    await user.click(general.getByRole("button", { name: /Expand General/ }));
    expect(general.getByText("Disabled")).toBeInTheDocument();
    expect(general.getByText("Log Level")).toBeInTheDocument();
  });

  it("collapses nested groups whose path the starter left empty", async () => {
    renderPage();
    await screen.findByRole("switch", { name: /Enable Tracer Provider/i }, { timeout: 10_000 });
    const tracerSection = document.querySelector<HTMLElement>(
      '[data-section-key="tracer_provider"]'
    );
    expect(tracerSection).not.toBeNull();
    const tracer = within(tracerSection!);
    // All nested groups (depth >= 1) start collapsed regardless of starter values.
    const limitsBtn = tracer.getByRole("button", { name: /Expand Limits/ });
    expect(limitsBtn).toHaveAttribute("aria-expanded", "false");
    // Its children (e.g. Attribute Value Length Limit) must not be in the DOM.
    expect(tracer.queryByText("Attribute Value Length Limit")).toBeNull();
  });
});
