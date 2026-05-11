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
import { NavBar } from "./nav-bar";
import { ThemeProvider } from "@/theme-context";

function renderNavBar() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <NavBar />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("NavBar", () => {
  it("renders the OpenTelemetry brand and links the logo lockup to home", () => {
    renderNavBar();

    const homeLink = screen.getByRole("link", { name: /openTelemetry.*home/i });
    expect(homeLink).toHaveAttribute("href", "/");
    expect(screen.getByTitle("OpenTelemetry")).toBeInTheDocument();
  });

  it("renders a single Docs link pointing to opentelemetry.io", () => {
    renderNavBar();

    const docsLink = screen.getByRole("link", { name: /^docs$/i });
    expect(docsLink).toHaveAttribute("href", "https://opentelemetry.io/docs/");
    expect(docsLink).toHaveAttribute("target", "_blank");
    expect(docsLink).toHaveAttribute("rel", "noreferrer");
  });

  it("labels the primary navigation landmark", () => {
    renderNavBar();

    expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
  });

  it("renders the theme toggle", () => {
    renderNavBar();

    expect(screen.getByRole("button", { name: /toggle theme/i })).toBeInTheDocument();
  });
});
