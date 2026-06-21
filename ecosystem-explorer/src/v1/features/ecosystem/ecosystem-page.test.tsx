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
import { describe, expect, it } from "vitest";
import { CollectorLandingV1 } from "./collector-landing";
import { JavaAgentLandingV1 } from "./java-agent-landing";

function renderRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe("Collector ecosystem landing", () => {
  it("renders the eyebrow, title, lead, and release version", () => {
    renderRouter(<CollectorLandingV1 />);
    expect(screen.getByText(/Infrastructure · Vendor-agnostic agent/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /OpenTelemetry Collector/i })
    ).toBeInTheDocument();
    expect(screen.getByText("v0.150.0")).toBeInTheDocument();
  });

  it("renders all five collector pipeline stages with deep links into the list page", () => {
    renderRouter(<CollectorLandingV1 />);
    expect(screen.getByRole("link", { name: /^Receivers — 98 components$/ })).toHaveAttribute(
      "href",
      "/collector/components?type=receiver"
    );
    expect(screen.getByRole("link", { name: /^Processors — 28 components$/ })).toHaveAttribute(
      "href",
      "/collector/components?type=processor"
    );
    expect(screen.getByRole("link", { name: /^Exporters — 47 components$/ })).toHaveAttribute(
      "href",
      "/collector/components?type=exporter"
    );
    expect(screen.getByRole("link", { name: /^Connectors — 9 components$/ })).toHaveAttribute(
      "href",
      "/collector/components?type=connector"
    );
    expect(screen.getByRole("link", { name: /^Extensions — 18 components$/ })).toHaveAttribute(
      "href",
      "/collector/components?type=extension"
    );
  });

  it("renders the three quick-entry cards", () => {
    renderRouter(<CollectorLandingV1 />);
    expect(screen.getByRole("heading", { name: /Most-used components/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Core vs\. Contrib/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Diff across versions/i })).toBeInTheDocument();
  });

  it("renders breadcrumbs Explorer › Ecosystems › Collector", () => {
    renderRouter(<CollectorLandingV1 />);
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(nav).toHaveTextContent(/Explorer/);
    expect(nav).toHaveTextContent(/Ecosystems/);
    expect(nav).toHaveTextContent(/OpenTelemetry Collector/);
  });
});

describe("Java Agent ecosystem landing", () => {
  it("renders the categories pipeline (HTTP / Databases / Messaging / Frameworks / Runtime)", () => {
    renderRouter(<JavaAgentLandingV1 />);
    const stageNames = [
      /^HTTP — 32 components$/,
      /^Databases — 41 components$/,
      /^Messaging — 21 components$/,
      /^Frameworks — 55 components$/,
      /^Runtime — 12 components$/,
    ];
    for (const name of stageNames) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("uses Java Agent canonical release v2.10.0", () => {
    renderRouter(<JavaAgentLandingV1 />);
    expect(screen.getByText("v2.10.0")).toBeInTheDocument();
  });
});
