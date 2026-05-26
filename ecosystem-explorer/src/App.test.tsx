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
import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import App from "./App";
import { ThemeProvider } from "./theme-context";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the legacy app when V1_REDESIGN is disabled", () => {
    vi.stubEnv("VITE_FEATURE_FLAG_V1_REDESIGN", "");

    const { container } = render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    // V1App adds .v1-app to scope its token overrides; absence confirms legacy rendering.
    expect(container.querySelector(".v1-app")).toBeNull();
    // LegacyApp's Header renders "OTel Explorer" synchronously — no lazy load needed.
    expect(screen.getByText("OTel Explorer")).toBeInTheDocument();
  });

  it("renders the v1 app when V1_REDESIGN is enabled", async () => {
    vi.stubEnv("VITE_FEATURE_FLAG_V1_REDESIGN", "true");

    const { container } = render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    expect(await screen.findByLabelText("OpenTelemetry")).toBeInTheDocument();
    expect(container.querySelector(".v1-app")).not.toBeNull();
  });
});
