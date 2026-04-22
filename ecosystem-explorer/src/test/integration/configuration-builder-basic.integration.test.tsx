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
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { installFetchInterceptor, uninstallFetchInterceptor } from "./helpers/fetch-interceptor";
import { ConfigurationBuilderPage } from "@/features/java-agent/configuration/configuration-builder-page";

beforeAll(() => installFetchInterceptor());
afterAll(() => uninstallFetchInterceptor());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/java-agent/configuration/builder"]}>
      <Routes>
        <Route path="/java-agent/configuration/builder" element={<ConfigurationBuilderPage />} />
      </Routes>
    </MemoryRouter>
  );
}

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
});
