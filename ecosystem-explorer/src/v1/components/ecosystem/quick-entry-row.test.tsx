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

import { QuickEntryRow, type QuickEntryItem } from "./quick-entry-row";

const items: QuickEntryItem[] = [
  {
    id: "most-used",
    title: "Most-used components",
    description: "Jump to the components the ecosystem leans on most.",
    href: "/collector/components?sort=updated",
  },
  {
    id: "core-contrib",
    title: "Core vs. Contrib",
    description: "Understand the split between core and contrib distributions.",
    href: "https://opentelemetry.io/",
    external: true,
  },
];

function renderRow() {
  return render(
    <MemoryRouter>
      <QuickEntryRow items={items} />
    </MemoryRouter>
  );
}

describe("QuickEntryRow", () => {
  it("renders the default title as a heading", () => {
    renderRow();
    expect(screen.getByRole("heading", { level: 2, name: "Quick entries" })).toBeInTheDocument();
  });

  it("renders an internal item as a Link with the right href", () => {
    renderRow();
    const link = screen.getByRole("link", { name: /Most-used components/i });
    expect(link).toHaveAttribute("href", "/collector/components?sort=updated");
  });

  it("renders an external item as an anchor with target and a safe rel", () => {
    renderRow();
    const link = screen.getByRole("link", { name: /Core vs\. Contrib/i });
    expect(link).toHaveAttribute("href", "https://opentelemetry.io/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });
});
