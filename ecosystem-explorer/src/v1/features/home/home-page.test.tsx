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
import { HomeV1 } from "./home-page";

describe("HomeV1 (composition)", () => {
  it("renders exactly one CoverBlock with title containing 'OpenTelemetry' and 'Ecosystem Explorer'", () => {
    const { container } = render(<HomeV1 />);

    const covers = container.querySelectorAll(".td-cover-block");
    expect(covers).toHaveLength(1);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("OpenTelemetry");
    expect(heading.textContent).toContain("Ecosystem Explorer");
  });

  it("renders the primary CTA with the locked text and href", () => {
    render(<HomeV1 />);

    const primary = screen.getByRole("link", { name: "Browse components" });
    expect(primary).toHaveAttribute("href", "/collector");
  });

  it("renders the secondary CTA with the locked text, href, target, and rel", () => {
    render(<HomeV1 />);

    const secondary = screen.getByRole("link", { name: "Read the overview" });
    expect(secondary).toHaveAttribute(
      "href",
      "https://opentelemetry.io/docs/what-is-opentelemetry/"
    );
    expect(secondary).toHaveAttribute("target", "_blank");
    expect(secondary).toHaveAttribute("rel", "noopener");
  });

  it("renders the four placeholder sections in the locked order", () => {
    const { container } = render(<HomeV1 />);

    const sections = Array.from(container.querySelectorAll("section[aria-label]")).map((el) =>
      el.getAttribute("aria-label")
    );

    // CoverBlock itself renders a <section> (aria-labelledby, no aria-label),
    // so it isn't picked up here — these are the four PR 2-6 placeholder slots.
    expect(sections).toEqual(["stats", "ecosystems", "signals", "recent-activity"]);
  });

  it("renders exactly one skeleton element inside each of the four placeholder sections", () => {
    const { container } = render(<HomeV1 />);

    for (const label of ["stats", "ecosystems", "signals", "recent-activity"]) {
      const section = container.querySelector(`section[aria-label="${label}"]`);
      expect(section, `section[aria-label="${label}"] should exist`).not.toBeNull();
      const skeletons = section!.querySelectorAll(".td-home__skeleton");
      expect(skeletons, `section[aria-label="${label}"] skeleton count`).toHaveLength(1);
    }
  });

  it("renders the GlobalSearch skeleton inside the CoverBlock with aria-hidden", () => {
    const { container } = render(<HomeV1 />);

    const cover = container.querySelector(".td-cover-block");
    expect(cover).not.toBeNull();

    const searchSkeleton = cover!.querySelector(".td-home__skeleton--search");
    expect(searchSkeleton).not.toBeNull();
    expect(searchSkeleton).toHaveAttribute("aria-hidden", "true");
  });
});
