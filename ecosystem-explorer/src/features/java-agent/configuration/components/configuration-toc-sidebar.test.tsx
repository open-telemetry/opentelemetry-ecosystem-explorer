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
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "@/components/ui/tabs";
import { ConfigurationTocSidebar } from "./configuration-toc-sidebar";

const sections = [
  { key: "resource", label: "Resource" },
  { key: "tracer_provider", label: "Tracer Provider" },
  { key: "attribute_limits", label: "Attribute Limits" },
];

const instrumentationSections = [
  { key: "general", label: "General settings" },
  { key: "instrumentations", label: "Instrumentations" },
];

function renderSidebar(
  overrides: Partial<React.ComponentProps<typeof ConfigurationTocSidebar>> = {}
) {
  const props = {
    activeTab: "sdk",
    sections,
    activeKey: "resource" as string | null,
    onSectionClick: vi.fn(),
    ...overrides,
  };
  return render(
    <Tabs value={props.activeTab} onValueChange={() => {}}>
      <ConfigurationTocSidebar {...props} />
    </Tabs>
  );
}

describe("ConfigurationTocSidebar", () => {
  it("renders a segmented control with SDK and Instrumentation triggers", () => {
    renderSidebar();
    expect(screen.getByRole("tab", { name: /SDK/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Instrumentation/i })).toBeInTheDocument();
  });

  it("renders one TOC button per section when the SDK tab is active", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Configuration sections" });
    expect(within(nav).getByRole("button", { name: "Resource" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Tracer Provider" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Attribute Limits" })).toBeInTheDocument();
  });

  it("marks the button matching activeKey with aria-current='location'", () => {
    renderSidebar({ activeKey: "tracer_provider" });
    const tracer = screen.getByRole("button", { name: "Tracer Provider" });
    expect(tracer).toHaveAttribute("aria-current", "location");
    const resource = screen.getByRole("button", { name: "Resource" });
    expect(resource).not.toHaveAttribute("aria-current", "location");
  });

  it("fires onSectionClick with the section key when a button is clicked", async () => {
    const onSectionClick = vi.fn();
    const user = userEvent.setup();
    renderSidebar({ onSectionClick });
    await user.click(screen.getByRole("button", { name: "Tracer Provider" }));
    expect(onSectionClick).toHaveBeenCalledWith("tracer_provider");
  });

  it("does not render the search input or status section on the SDK tab", () => {
    renderSidebar();
    expect(screen.queryByPlaceholderText(/Search instrumentations/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Overridden/i })).toBeNull();
  });

  describe("instrumentation tab", () => {
    it("renders search input + TOC and hides Status when overrideCount === 0", () => {
      renderSidebar({
        activeTab: "instrumentation",
        sections: instrumentationSections,
        activeKey: "general",
        overrideCount: 0,
      });
      expect(screen.getByPlaceholderText(/Search instrumentations/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Overridden/i })).toBeNull();
      const nav = screen.getByRole("navigation", { name: "Configuration sections" });
      expect(within(nav).getByRole("button", { name: "General settings" })).toBeInTheDocument();
      expect(within(nav).getByRole("button", { name: "Instrumentations" })).toBeInTheDocument();
    });

    it("renders the Overridden chip with the count when overrideCount > 0", () => {
      renderSidebar({
        activeTab: "instrumentation",
        sections: instrumentationSections,
        activeKey: "general",
        overrideCount: 1,
      });
      const chip = screen.getByRole("button", { name: /Overridden/i });
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveTextContent("1");
      expect(chip).toHaveAttribute("aria-pressed", "false");
    });

    it("fires onSearchChange when the user types in the search input", async () => {
      const onSearchChange = vi.fn();
      const user = userEvent.setup();
      renderSidebar({
        activeTab: "instrumentation",
        sections: instrumentationSections,
        activeKey: "general",
        overrideCount: 0,
        search: "",
        onSearchChange,
      });
      await user.type(screen.getByPlaceholderText(/Search instrumentations/i), "c");
      expect(onSearchChange).toHaveBeenCalledWith("c");
    });

    it("toggles statusFilter from 'all' to 'overridden' when the chip is clicked", async () => {
      const onStatusFilterChange = vi.fn();
      const user = userEvent.setup();
      renderSidebar({
        activeTab: "instrumentation",
        sections: instrumentationSections,
        activeKey: "general",
        overrideCount: 2,
        statusFilter: "all",
        onStatusFilterChange,
      });
      await user.click(screen.getByRole("button", { name: /Overridden/i }));
      expect(onStatusFilterChange).toHaveBeenCalledWith("overridden");
    });

    it("toggles statusFilter back to 'all' when the chip is clicked while active", async () => {
      const onStatusFilterChange = vi.fn();
      const user = userEvent.setup();
      renderSidebar({
        activeTab: "instrumentation",
        sections: instrumentationSections,
        activeKey: "general",
        overrideCount: 2,
        statusFilter: "overridden",
        onStatusFilterChange,
      });
      const chip = screen.getByRole("button", { name: /Overridden/i });
      expect(chip).toHaveAttribute("aria-pressed", "true");
      await user.click(chip);
      expect(onStatusFilterChange).toHaveBeenCalledWith("all");
    });
  });
});
