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
import { screen, within, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFetchInterceptor, uninstallFetchInterceptor } from "./helpers/fetch-interceptor";
import { renderBuilderPage as renderPage } from "./helpers/render-builder-page";

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

describe("ConfigurationBuilderPage card click behavior", () => {
  it("clicking an input inside an expanded card does not steal focus or scroll", async () => {
    renderPage();
    const user = userEvent.setup();

    // Wait for the page to settle. Resource is auto-enabled by the starter
    // and its attributes_list text input renders inline.
    await screen.findByRole("switch", { name: /Enable Resource/i }, { timeout: 10_000 });

    const resourceSection = document.querySelector<HTMLElement>('[data-section-key="resource"]');
    expect(resourceSection).not.toBeNull();
    const resource = within(resourceSection as HTMLElement);

    // The attributes_list text input is in the DOM as soon as Resource expands.
    await waitFor(() => {
      expect(resource.queryAllByRole("textbox").length).toBeGreaterThan(0);
    });

    // Force scrollY > 0 so a "jump to top" would be detectable.
    Object.defineProperty(window, "scrollY", { configurable: true, value: 400 });
    const scrollYBefore = window.scrollY;

    const target = resource.getAllByRole("textbox")[0];
    await user.click(target);

    // 1. The input keeps focus (was not stolen by the section element).
    expect(document.activeElement).toBe(target);
    // 2. No code path adjusted scroll position.
    expect(window.scrollY).toBe(scrollYBefore);
    // 3. Typing actually lands characters.
    await user.clear(target);
    await user.type(target, "my-service");
    expect(target).toHaveValue("my-service");
  });

  it("interacting with a section card highlights the corresponding YAML section in the preview", async () => {
    renderPage();
    const user = userEvent.setup();

    // Wait for the page to settle. Resource is auto-enabled by the starter
    await screen.findByRole("switch", { name: /Enable Resource/i }, { timeout: 10_000 });

    const resourceSection = document.querySelector<HTMLElement>('[data-section-key="resource"]');
    expect(resourceSection).not.toBeNull();

    // Interact with it (e.g. click the card itself)
    await user.click(resourceSection!);

    // Wait for the YAML preview to re-render with the active class
    await waitFor(() => {
      const resourceYamlSection = document.querySelector<HTMLElement>(
        '[data-yaml-section="resource"]'
      );
      expect(resourceYamlSection).not.toBeNull();
      expect(resourceYamlSection?.className).toContain("bg-otel-orange/10");
    });
  });

  it("interacting with a leaf field inside the General card highlights the matching YAML block", async () => {
    renderPage();
    const user = userEvent.setup();

    // Wait for the page to settle.
    await screen.findByRole("switch", { name: /Enable Resource/i }, { timeout: 10_000 });

    // Expand the General card first so its leaf wrappers are in the DOM.
    await user.click(screen.getByRole("button", { name: /Expand General/i }));

    const disabledLeaf = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-yaml-section-key="disabled"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });

    // Enable the `disabled` leaf so it shows up in the YAML output.
    await user.click(within(disabledLeaf).getByRole("button", { name: /Expand Disabled/i }));
    const disabledToggle = within(disabledLeaf).getByRole("switch", { name: /Disabled/i });
    await user.click(disabledToggle);

    // Assert the highlight tracks the leaf key, not the synthetic "general" section.
    await waitFor(() => {
      const disabledYamlBlock = document.querySelector<HTMLElement>(
        '[data-yaml-section="disabled"]'
      );
      expect(disabledYamlBlock).not.toBeNull();
      expect(disabledYamlBlock?.className).toContain("bg-otel-orange/10");
    });
  });
});
