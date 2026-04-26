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

  it("does not render the TOC nav when Instrumentation is the active tab", () => {
    renderSidebar({ activeTab: "instrumentation" });
    expect(screen.queryByRole("navigation", { name: "Configuration sections" })).toBeNull();
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
});
