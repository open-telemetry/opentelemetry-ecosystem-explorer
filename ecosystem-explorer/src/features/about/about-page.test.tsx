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
import { AboutPage } from "./about-page";

describe("AboutPage", () => {
  it("renders the page heading", () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "About", level: 1 })).toBeInTheDocument();
  });

  it("renders the Goals section", () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Goals" })).toBeInTheDocument();
  });

  it("renders the Get Involved section with links", () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Get Involved" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /source code/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /report a bug/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request a feature/i })).toBeInTheDocument();
  });

  it("renders the Contributing section", () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Contributing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contributing guide/i })).toBeInTheDocument();
  });

  it("source code link points to the GitHub repo", () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /source code/i });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/open-telemetry/opentelemetry-ecosystem-explorer"
    );
  });
});
