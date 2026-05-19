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
import { SubNav } from "./sub-nav";

function renderSubNav(props: Parameters<typeof SubNav>[0]) {
  return render(
    <MemoryRouter>
      <SubNav {...props} />
    </MemoryRouter>
  );
}

describe("SubNav", () => {
  it("renders nothing when both crumbs and actions are empty", () => {
    const { container } = renderSubNav({ crumbs: [] });
    expect(container.firstChild).toBeNull();
  });

  it("renders breadcrumb landmark with each crumb in order", () => {
    renderSubNav({
      crumbs: [
        { label: "Collector", href: "/collector" },
        { label: "Components", href: "/collector/components" },
        { label: "otlp" },
      ],
    });

    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(nav).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Collector" })).toHaveAttribute("href", "/collector");
    expect(screen.getByRole("link", { name: "Components" })).toHaveAttribute(
      "href",
      "/collector/components"
    );
    expect(screen.getByText("otlp")).toHaveAttribute("aria-current", "page");
  });

  it("renders the last crumb as a non-link with aria-current=page", () => {
    renderSubNav({
      crumbs: [{ label: "Home", href: "/" }, { label: "Detail" }],
    });

    expect(screen.queryByRole("link", { name: "Detail" })).toBeNull();
    expect(screen.getByText("Detail")).toHaveAttribute("aria-current", "page");
  });

  it("renders actions in the right-aligned slot", () => {
    renderSubNav({
      crumbs: [{ label: "Home", href: "/" }],
      actions: <button type="button">Filter</button>,
    });

    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();
  });

  it("renders actions even when there are no crumbs", () => {
    renderSubNav({
      crumbs: [],
      actions: <button type="button">Edit</button>,
    });

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});
