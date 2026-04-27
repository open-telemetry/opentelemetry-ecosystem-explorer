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

describe("ConfigurationBuilderPage — card click behavior", () => {
  it("clicking an input inside an expanded card does not steal focus or scroll", async () => {
    renderPage();
    const user = userEvent.setup();

    // Enable Logger Provider so its body renders, mirroring the user's bug
    // report path of clicking inside an expanded section card.
    const loggerSwitch = await screen.findByRole(
      "switch",
      { name: /Enable Logger Provider/i },
      { timeout: 10_000 }
    );
    if (loggerSwitch.getAttribute("aria-checked") !== "true") {
      await user.click(loggerSwitch);
    }

    // Scope all subsequent queries to the Logger Provider card.
    const loggerSection = document.querySelector<HTMLElement>(
      '[data-section-key="logger_provider"]'
    );
    expect(loggerSection).not.toBeNull();
    const logger = within(loggerSection as HTMLElement);

    // Expand the Logger Configurator group so its leaf controls render.
    await user.click(logger.getByRole("button", { name: "Expand Logger Configurator" }));

    // Wait for at least one nested expand button or input to materialize.
    await waitFor(() => {
      expect(logger.queryAllByRole("button").length).toBeGreaterThan(2);
    });

    // Expand the Loggers list inside Logger Configurator if present (the
    // schema may evolve; pick whichever expand chevron leads to a textbox).
    // Items are rendered headless after deriveListItemLabel landed, so the
    // form fields are inline as soon as Add fires — no per-item Expand step.
    const expandLoggers = logger.queryAllByRole("button", { name: "Expand Loggers" });
    if (expandLoggers.length > 0) {
      await user.click(expandLoggers[0]);
      const addLoggers = logger.queryAllByRole("button", { name: "Add item to Loggers" });
      if (addLoggers.length > 0) {
        await user.click(addLoggers[0]);
        await waitFor(() => {
          expect(logger.queryAllByRole("textbox").length).toBeGreaterThan(0);
        });
      }
    }

    // Force scrollY > 0 so a "jump to top" would be detectable.
    Object.defineProperty(window, "scrollY", { configurable: true, value: 400 });
    const scrollYBefore = window.scrollY;

    const textInputs = logger.getAllByRole("textbox");
    expect(textInputs.length).toBeGreaterThan(0);
    const target = textInputs[0];

    await user.click(target);

    // 1. The input keeps focus (was not stolen by the section element).
    expect(document.activeElement).toBe(target);
    // 2. No code path adjusted scroll position.
    expect(window.scrollY).toBe(scrollYBefore);
    // 3. Typing actually lands characters.
    await user.type(target, "my-logger");
    expect(target).toHaveValue("my-logger");
  });
});
