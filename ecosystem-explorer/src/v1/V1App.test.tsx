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
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { V1App } from "./V1App";
import { ThemeProvider } from "@/theme-context";

describe("V1App", () => {
  it("renders the v1 navbar", async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/"]}>
          <V1App />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(await screen.findByLabelText("OpenTelemetry")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
  });

  it("wraps content in a .v1-app scoping container", () => {
    const { container } = render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/"]}>
          <V1App />
        </MemoryRouter>
      </ThemeProvider>
    );

    expect(container.querySelector(".v1-app")).not.toBeNull();
  });
});
