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
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { screen, waitFor, fireEvent, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFetchInterceptor, uninstallFetchInterceptor } from "./helpers/fetch-interceptor";
import { renderBuilderPage as renderPage } from "./helpers/render-builder-page";

const clipboardWrite = vi.fn().mockResolvedValue(undefined);

beforeAll(() => {
  installFetchInterceptor();
  // jsdom's navigator.clipboard is either undefined or read-only; force-install
  // a mock via defineProperty (it IS configurable in jsdom-latest when defined).
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    writable: true,
    value: { writeText: clipboardWrite },
  });
});
afterAll(() => {
  uninstallFetchInterceptor();
});

beforeEach(() => {
  localStorage.clear();
  cleanup();
  clipboardWrite.mockClear();
});

describe("ConfigurationBuilderPage — actions", () => {
  it("Copy writes current YAML to clipboard", async () => {
    renderPage();

    await screen.findByText("Output Preview", undefined, { timeout: 10_000 });
    const copyBtn = screen.getByRole("button", { name: /^copy$/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(clipboardWrite).toHaveBeenCalled();
    });
    const firstCall = clipboardWrite.mock.calls[0];
    expect(firstCall[0]).toMatch(/file_format:/);
  });

  it("Add all makes every top-level section appear in the YAML preview", async () => {
    renderPage();
    const user = userEvent.setup();

    await screen.findByText("Output Preview", undefined, { timeout: 10_000 });
    await user.click(screen.getByRole("button", { name: /add all/i }));

    await waitFor(() => {
      const pre = screen.getByText(/OpenTelemetry SDK Configuration/).closest("pre");
      const text = pre?.textContent ?? "";
      expect(text).toMatch(/^resource:/m);
      expect(text).toMatch(/^attribute_limits:/m);
    });
  });

  // Merge-safe preservation of already-customized leaves is covered exhaustively
  // at the unit level (reducer MERGE_DEFAULTS + hook mergeDefaults tests); this
  // integration case verifies the end-to-end button → YAML wiring on the tab.
  it("Instrumentation 'Add all configs' merges the instrumentation section into the YAML", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    const user = userEvent.setup();

    // SDK tab is loaded; switch to the Instrumentation tab via the sidebar.
    await screen.findByRole("switch", { name: /Enable Resource/i }, { timeout: 10_000 });
    const sidebar = screen.getByRole("complementary");
    await user.click(within(sidebar).getByRole("tab", { name: /Instrumentation/i }));

    // Wait for instrumentation data to load and enable the button (it is
    // disabled while `entries.length === 0`).
    const addAllConfigs = await screen.findByRole(
      "button",
      { name: "Add all configs" },
      { timeout: 10_000 }
    );
    await waitFor(() => expect(addAllConfigs).toBeEnabled(), { timeout: 10_000 });

    const readPreview = () =>
      screen.getByText(/OpenTelemetry SDK Configuration/).closest("pre")?.textContent ?? "";

    // Before: the instrumentation section is not present in the YAML.
    expect(readPreview()).not.toMatch(/^instrumentation\/development:/m);

    await user.click(addAllConfigs);

    await waitFor(() => {
      expect(readPreview()).toMatch(/^instrumentation\/development:/m);
    });
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
