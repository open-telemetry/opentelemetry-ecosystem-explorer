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

  it("renders the remaining placeholder sections in the locked order", () => {
    const { container } = renderHome();

    const sections = Array.from(container.querySelectorAll("section[aria-label]")).map((el) =>
      el.getAttribute("aria-label")
    );

    // CoverBlock and StatsBand render <section>s with aria-labelledby (not
    // aria-label), so they aren't picked up here — these are the three PR 4-6
    // placeholder slots that remain.
    expect(sections).toEqual(["Featured ecosystems", "Browse by signal", "Recent activity"]);
  });

  it("renders exactly one skeleton element inside each of the remaining placeholder sections", () => {
    const { container } = renderHome();

    for (const label of ["Featured ecosystems", "Browse by signal", "Recent activity"]) {
      const section = container.querySelector(`section[aria-label="${label}"]`);
      expect(section, `section[aria-label="${label}"] should exist`).not.toBeNull();
      const skeletons = section!.querySelectorAll(".td-home__skeleton");
      expect(skeletons, `section[aria-label="${label}"] skeleton count`).toHaveLength(1);
    }
  });

  it("renders the StatsBand below the CoverBlock", () => {
    const { container } = renderHome();
    const band = container.querySelector(".td-stats-band");
    expect(band).not.toBeNull();
    expect(band).toHaveAttribute("aria-labelledby", "stats-band-title");
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
