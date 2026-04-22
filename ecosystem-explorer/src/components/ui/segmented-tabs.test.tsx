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
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Tabs, TabsContent } from "./tabs";
import { SegmentedTabList } from "./segmented-tabs";

function ControlledTabs({ defaultValue = "tab1" }: { defaultValue?: string }) {
  return (
    <Tabs defaultValue={defaultValue}>
      <SegmentedTabList
        value={defaultValue}
        tabs={[
          { value: "tab1", label: "Tab 1" },
          { value: "tab2", label: "Tab 2" },
        ]}
      />
      <TabsContent value="tab1">Content 1</TabsContent>
      <TabsContent value="tab2">Content 2</TabsContent>
    </Tabs>
  );
}

describe("SegmentedTabList", () => {
  it("renders tabs with correct roles and labels", () => {
    render(<ControlledTabs />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tab 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tab 2" })).toBeInTheDocument();
  });

  it("displays the default tab content", () => {
    render(<ControlledTabs />);

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("Content 1");
  });

  it("switches tab content when clicking a different tab", async () => {
    const user = userEvent.setup();

    render(<ControlledTabs />);

    await user.click(screen.getByRole("tab", { name: "Tab 2" }));

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("Content 2");
  });

  it("updates data-state attributes on tab triggers", async () => {
    const user = userEvent.setup();

    render(<ControlledTabs />);

    const tab1 = screen.getByRole("tab", { name: "Tab 1" });
    const tab2 = screen.getByRole("tab", { name: "Tab 2" });

    expect(tab1).toHaveAttribute("data-state", "active");
    expect(tab2).toHaveAttribute("data-state", "inactive");

    await user.click(tab2);

    expect(tab1).toHaveAttribute("data-state", "inactive");
    expect(tab2).toHaveAttribute("data-state", "active");
  });

  it("supports keyboard navigation with arrow keys", async () => {
    const user = userEvent.setup();

    render(<ControlledTabs />);

    const tab1 = screen.getByRole("tab", { name: "Tab 1" });
    tab1.focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Tab 2" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Tab 1" })).toHaveFocus();
  });

  it("renders icons when provided", () => {
    render(
      <Tabs defaultValue="tab1">
        <SegmentedTabList
          value="tab1"
          tabs={[
            {
              value: "tab1",
              label: "Details",
              icon: <svg data-testid="icon-details" aria-hidden="true" />,
            },
            { value: "tab2", label: "Settings" },
          ]}
        />
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    expect(screen.getByTestId("icon-details")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
  });
});
