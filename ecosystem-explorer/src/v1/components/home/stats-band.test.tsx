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

import { StatsBand } from "./stats-band";

function renderBand() {
  return render(
    <MemoryRouter>
      <StatsBand />
    </MemoryRouter>
  );
}

describe("StatsBand", () => {
  it("renders the default section title as the labelling h2", () => {
    renderBand();
    const heading = screen.getByRole("heading", {
      level: 2,
      name: /The OpenTelemetry Ecosystem/i,
    });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute("id", "stats-band-title");
  });

  it("labels the section via aria-labelledby pointing at the heading", () => {
    const { container } = renderBand();
    const section = container.querySelector(".td-stats-band");
    expect(section).toHaveAttribute("aria-labelledby", "stats-band-title");
  });

  it("renders the four canonical stat labels with the canonical numbers", () => {
    renderBand();
    const expected = [
      ["12+", "Languages"],
      ["200+", "Collector Components"],
      ["1005+", "Integrations"],
      ["102+", "Vendors"],
    ];
    for (const [number, label] of expected) {
      expect(screen.getByText(number)).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("links Collector Components internally to /collector (no target=_blank)", () => {
    renderBand();
    const link = screen.getByRole("link", { name: "Collector Components: 200+" });
    expect(link).toHaveAttribute("href", "/collector");
    expect(link).not.toHaveAttribute("target");
  });

  it("links external stats to opentelemetry.io with target=_blank and rel=noopener noreferrer", () => {
    renderBand();
    const languages = screen.getByRole("link", { name: "Languages: 12+" });
    expect(languages).toHaveAttribute("href", "https://opentelemetry.io/docs/languages/");
    expect(languages).toHaveAttribute("target", "_blank");
    expect(languages).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders a custom title and headingId when provided", () => {
    render(
      <MemoryRouter>
        <StatsBand title="Custom title" headingId="custom-id" stats={[]} />
      </MemoryRouter>
    );
    const heading = screen.getByRole("heading", { level: 2, name: "Custom title" });
    expect(heading).toHaveAttribute("id", "custom-id");
  });
});
