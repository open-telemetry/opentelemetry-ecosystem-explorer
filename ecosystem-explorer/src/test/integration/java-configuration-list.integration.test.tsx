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
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { installFetchInterceptor, uninstallFetchInterceptor } from "./helpers/fetch-interceptor";
import { JavaConfigurationListPage } from "@/features/java-agent/java-configuration-list-page";

beforeAll(() => installFetchInterceptor());
afterAll(() => uninstallFetchInterceptor());

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(initialUrl = "/java-agent/configuration") {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/java-agent/configuration" element={<JavaConfigurationListPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

describe("JavaConfigurationListPage — integration", () => {
  it("loads configurations from the real database without errors", async () => {
    renderPage();

    // Wait for the loading state to finish
    await waitFor(
      () => {
        expect(screen.queryByText("Loading configurations...")).not.toBeInTheDocument();
      },
      { timeout: 10_000 }
    );

    // If the file is missing, this will fail
    expect(screen.queryByText("Unable to load configurations")).not.toBeInTheDocument();

    // Check that we found some configurations
    const countRegex = /^Found \d+ configurations$/;
    expect(screen.getByText(countRegex)).toBeInTheDocument();

    // Check for a specific known configuration description from global-configurations.json
    const descriptions = screen.getAllByText(/Enables query sanitization for database queries\./i);
    expect(descriptions.length).toBeGreaterThan(0);
  });

  it("search narrows the configuration list", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(
      () => {
        expect(screen.queryByText("Loading configurations...")).not.toBeInTheDocument();
      },
      { timeout: 10_000 }
    );

    const searchInput = screen.getByPlaceholderText(
      "Search configurations, descriptions, or instrumentations..."
    );

    // Get the initial count
    const initialCountText = screen.getByText(/^Found \d+ configurations$/).textContent;
    const initialCount = parseInt(initialCountText!.match(/\d+/)![0], 10);

    // Type a specific term that should yield fewer results
    await user.type(searchInput, "elasticsearch");

    await waitFor(() => {
      const updatedCountText = screen.getByText(/^Found \d+ configurations$/).textContent;
      const updatedCount = parseInt(updatedCountText!.match(/\d+/)![0], 10);
      expect(updatedCount).toBeGreaterThan(0);
      expect(updatedCount).toBeLessThan(initialCount);
    });
  });

  it("format tabs toggle between declarative and system properties", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(
      () => {
        expect(screen.queryByText("Loading configurations...")).not.toBeInTheDocument();
      },
      { timeout: 10_000 }
    );

    // Switch to system properties
    const systemPropsTab = screen.getByRole("tab", { name: /System Properties/i });
    await user.click(systemPropsTab);

    // Verify format changed (flatName is shown when format is system-property)
    await waitFor(() => {
      expect(
        screen.getByText("otel.instrumentation.common.db-statement-sanitizer.enabled")
      ).toBeInTheDocument();
      expect(systemPropsTab).toHaveAttribute("aria-selected", "true");
    });
  });

  it("restores search and format from the URL", async () => {
    renderPage("/java-agent/configuration?search=elasticsearch&format=system-property");

    await waitFor(
      () => {
        expect(screen.queryByText("Loading configurations...")).not.toBeInTheDocument();
      },
      { timeout: 10_000 }
    );

    expect(
      screen.getByPlaceholderText("Search configurations, descriptions, or instrumentations...")
    ).toHaveValue("elasticsearch");
    expect(screen.getByRole("tab", { name: /System Properties/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("falls back to declarative for an unrecognised format param", async () => {
    renderPage("/java-agent/configuration?format=bogus");

    await waitFor(
      () => {
        expect(screen.queryByText("Loading configurations...")).not.toBeInTheDocument();
      },
      { timeout: 10_000 }
    );

    expect(screen.getByRole("tab", { name: /Declarative Configuration/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("writes search and format changes to the URL", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(
      () => {
        expect(screen.queryByText("Loading configurations...")).not.toBeInTheDocument();
      },
      { timeout: 10_000 }
    );

    await user.type(
      screen.getByPlaceholderText("Search configurations, descriptions, or instrumentations..."),
      "kafka"
    );
    await user.click(screen.getByRole("tab", { name: /System Properties/i }));

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId("location-search").textContent ?? "");
      expect(params.get("search")).toBe("kafka");
      expect(params.get("format")).toBe("system-property");
    });

    // Switching back to the default drops the param rather than leaving format=declarative.
    await user.click(screen.getByRole("tab", { name: /Declarative Configuration/i }));
    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId("location-search").textContent ?? "");
      expect(params.has("format")).toBe(false);
      expect(params.get("search")).toBe("kafka");
    });
  });
});
