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
import { Footer } from "./footer";

describe("Footer", () => {
  it("renders the app name", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText("OpenTelemetry Ecosystem Explorer")).toBeInTheDocument();
  });

  it("renders the About link pointing to /about", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const aboutLink = screen.getByRole("link", { name: "About" });
    expect(aboutLink).toBeInTheDocument();
    expect(aboutLink).toHaveAttribute("href", "/about");
  });

  it("renders the GitHub link", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const githubLink = screen.getByRole("link", { name: "GitHub repository" });
    expect(githubLink).toHaveAttribute(
      "href",
      "https://github.com/open-telemetry/opentelemetry-ecosystem-explorer"
    );
    expect(githubLink).toHaveAttribute("target", "_blank");
  });

  it("renders the opentelemetry.io link", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const otelLink = screen.getByRole("link", { name: "OpenTelemetry website" });
    expect(otelLink).toHaveAttribute("href", "https://opentelemetry.io");
    expect(otelLink).toHaveAttribute("target", "_blank");
  });

  it("renders the tagline", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText("Charting the observability landscape")).toBeInTheDocument();
  });

  it("renders the copyright notice", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByText("© 2026–Present OpenTelemetry Authors")).toBeInTheDocument();
  });
});
