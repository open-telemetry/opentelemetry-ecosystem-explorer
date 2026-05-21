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

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import { EcosystemsGrid } from "./ecosystems-grid";

function renderGrid() {
  return render(
    <MemoryRouter>
      <EcosystemsGrid />
    </MemoryRouter>
  );
}

describe("EcosystemsGrid", () => {
  it("labels the section via aria-labelledby pointing at the heading", () => {
    renderGrid();
    const section = screen.getByRole("region", { name: "Ecosystems" });
    expect(section).toHaveAttribute("aria-labelledby", "ecosystems-grid-title");
    expect(screen.getByRole("heading", { level: 2, name: "Ecosystems" })).toHaveAttribute(
      "id",
      "ecosystems-grid-title"
    );
  });

  it("renders the Collector card linking to /collector with stability + counts", () => {
    renderGrid();
    const card = screen.getByRole("link", { name: /OpenTelemetry Collector/i });
    expect(card).toHaveAttribute("href", "/collector");
    expect(within(card).getByText(/Stable/i)).toBeInTheDocument();
    expect(within(card).getByText("200+")).toBeInTheDocument();
    expect(within(card).getByText("v0.150.0")).toBeInTheDocument();
  });

  it("renders the Java Agent card linking to /java-agent with stability + counts", () => {
    renderGrid();
    const card = screen.getByRole("link", { name: /OpenTelemetry Java Agent/i });
    expect(card).toHaveAttribute("href", "/java-agent");
    expect(within(card).getByText("187")).toBeInTheDocument();
    expect(within(card).getByText("v2.10.0")).toBeInTheDocument();
  });

  it("renders four coming-soon placeholders that are not anchor links", () => {
    renderGrid();
    const placeholders = ["Python SDK", "Go SDK", "JS / Node", ".NET"];
    for (const name of placeholders) {
      const node = screen.getByText(name);
      expect(node).toBeInTheDocument();
      expect(node.closest("a")).toBeNull();
    }
  });

  it("links 'View all projects' to opentelemetry.io with target=_blank and rel=noopener noreferrer", () => {
    renderGrid();
    const link = screen.getByRole("link", { name: /View all projects/i });
    expect(link).toHaveAttribute("href", "https://opentelemetry.io/ecosystem/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
