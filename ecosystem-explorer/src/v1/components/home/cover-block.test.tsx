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
import { describe, it, expect } from "vitest";
import { CoverBlock } from "./cover-block";

describe("CoverBlock", () => {
  it("renders the title inside an h1", () => {
    render(<CoverBlock title="OpenTelemetry Ecosystem Explorer" />);

    expect(
      screen.getByRole("heading", { level: 1, name: /OpenTelemetry Ecosystem Explorer/i })
    ).toBeInTheDocument();
  });

  it("wires aria-labelledby to the default heading id", () => {
    const { container } = render(<CoverBlock title="Explorer" />);

    const section = container.querySelector("section");
    expect(section).toHaveAttribute("aria-labelledby", "cover-block-title");

    const heading = screen.getByRole("heading", { level: 1, name: "Explorer" });
    expect(heading).toHaveAttribute("id", "cover-block-title");
  });

  it("respects a custom headingId", () => {
    const { container } = render(<CoverBlock title="Explorer" headingId="home-hero-title" />);

    const section = container.querySelector("section");
    expect(section).toHaveAttribute("aria-labelledby", "home-hero-title");
    expect(screen.getByRole("heading", { level: 1, name: "Explorer" })).toHaveAttribute(
      "id",
      "home-hero-title"
    );
  });

  it("renders each optional slot when provided", () => {
    render(
      <CoverBlock
        logo={<span data-testid="logo">[logo]</span>}
        eyebrow={<span data-testid="eyebrow">Eyebrow</span>}
        title="Title"
        lead="Lead copy"
        ctas={<button type="button">Browse components</button>}
        aside={<div data-testid="aside">[aside]</div>}
      >
        <div data-testid="children-slot">[search]</div>
      </CoverBlock>
    );

    expect(screen.getByTestId("logo")).toBeInTheDocument();
    expect(screen.getByTestId("eyebrow")).toBeInTheDocument();
    expect(screen.getByText("Lead copy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Browse components" })).toBeInTheDocument();
    expect(screen.getByTestId("aside")).toBeInTheDocument();
    expect(screen.getByTestId("children-slot")).toBeInTheDocument();
  });

  it("omits every optional slot when not provided (no empty wrappers)", () => {
    const { container } = render(<CoverBlock title="Just a title" />);

    expect(container.querySelector(".td-cover-block__logo")).toBeNull();
    expect(container.querySelector(".td-cover-block__eyebrow")).toBeNull();
    expect(container.querySelector(".td-cover-block__lead")).toBeNull();
    expect(container.querySelector(".td-cover-block__ctas")).toBeNull();
    expect(container.querySelector(".td-cover-block__aside")).toBeNull();
  });

  it("does not apply the split modifier when aside is absent", () => {
    const { container } = render(<CoverBlock title="No aside" />);

    const section = container.querySelector("section");
    expect(section).not.toBeNull();
    expect(section!.classList.contains("td-cover-block")).toBe(true);
    expect(section!.classList.contains("td-cover-block--split")).toBe(false);
  });

  it("applies the split modifier when aside is provided", () => {
    const { container } = render(
      <CoverBlock title="With aside" aside={<div data-testid="release-card">Release</div>} />
    );

    const section = container.querySelector("section");
    expect(section!.classList.contains("td-cover-block--split")).toBe(true);
    expect(screen.getByTestId("release-card")).toBeInTheDocument();
  });

  it("passes className through and concatenates with base classes", () => {
    const { container } = render(
      <CoverBlock title="With class" aside={<div>aside</div>} className="custom-extra" />
    );

    const section = container.querySelector("section");
    expect(section!.classList.contains("td-cover-block")).toBe(true);
    expect(section!.classList.contains("td-cover-block--split")).toBe(true);
    expect(section!.classList.contains("custom-extra")).toBe(true);
  });
});
