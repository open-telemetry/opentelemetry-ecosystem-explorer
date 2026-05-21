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
import { HomeV1 } from "./home-page";

function renderHome() {
  return render(
    <MemoryRouter>
      <HomeV1 />
    </MemoryRouter>
  );
}

describe("HomeV1 (composition)", () => {
  it("renders exactly one CoverBlock with title containing 'OpenTelemetry' and 'Ecosystem Explorer'", () => {
    const { container } = renderHome();

    const covers = container.querySelectorAll(".td-cover-block");
    expect(covers).toHaveLength(1);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("OpenTelemetry");
    expect(heading.textContent).toContain("Ecosystem Explorer");
  });

  it("renders the primary CTA with the locked text and href", () => {
    renderHome();

    const primary = screen.getByRole("link", { name: "Browse components" });
    expect(primary).toHaveAttribute("href", "/collector");
  });

  it("renders the secondary CTA with the locked text, href, target, and rel", () => {
    renderHome();

    const secondary = screen.getByRole("link", { name: "Read the overview" });
    expect(secondary).toHaveAttribute(
      "href",
      "https://opentelemetry.io/docs/what-is-opentelemetry/"
    );
    expect(secondary).toHaveAttribute("target", "_blank");
    expect(secondary).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders only the recent-activity placeholder section", () => {
    const { container } = renderHome();

    const sections = Array.from(container.querySelectorAll("section[aria-label]")).map((el) =>
      el.getAttribute("aria-label")
    );

    // Shipped sections use aria-labelledby; only the recent-activity
    // skeleton wrapper still uses aria-label.
    expect(sections).toEqual(["Recent activity"]);
  });

  it("renders exactly one skeleton element inside the recent-activity section", () => {
    const { container } = renderHome();
    const section = container.querySelector('section[aria-label="Recent activity"]');
    expect(section).not.toBeNull();
    const skeletons = section!.querySelectorAll(".td-home__skeleton");
    expect(skeletons).toHaveLength(1);
  });

  it("renders the StatsBand below the CoverBlock", () => {
    const { container } = renderHome();
    const band = container.querySelector(".td-stats-band");
    expect(band).not.toBeNull();
    expect(band).toHaveAttribute("aria-labelledby", "stats-band-title");
  });

  it("renders the EcosystemsGrid below the StatsBand", () => {
    const { container } = renderHome();
    const grid = container.querySelector(".td-ecosystems-grid");
    expect(grid).not.toBeNull();
    expect(grid).toHaveAttribute("aria-labelledby", "ecosystems-grid-title");
  });

  it("renders the SignalsRow below the EcosystemsGrid", () => {
    const { container } = renderHome();
    const row = container.querySelector(".td-signals-row");
    expect(row).not.toBeNull();
    expect(row).toHaveAttribute("aria-labelledby", "signals-row-title");
  });

  it("renders the GlobalSearch skeleton inside the CoverBlock with aria-hidden", () => {
    const { container } = renderHome();

    const cover = container.querySelector(".td-cover-block");
    expect(cover).not.toBeNull();

    const searchSkeleton = cover!.querySelector(".td-home__skeleton--search");
    expect(searchSkeleton).not.toBeNull();
    expect(searchSkeleton).toHaveAttribute("aria-hidden", "true");
  });
});
