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
import { Tabs, TabsContent } from "./tabs";
import { SegmentedTabList } from "./segmented-tabs";

describe("Tabs", () => {
  it("renders tab content with correct role", () => {
    render(
      <Tabs defaultValue="tab1">
        <SegmentedTabList
          value="tab1"
          tabs={[
            { value: "tab1", label: "Tab 1" },
            { value: "tab2", label: "Tab 2" },
          ]}
        />
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("Content 1");
    expect(panel).toHaveAttribute("data-state", "active");
  });

  it("applies custom className to TabsContent", () => {
    render(
      <Tabs defaultValue="tab1">
        <SegmentedTabList
          value="tab1"
          tabs={[{ value: "tab1", label: "Tab 1" }]}
        />
        <TabsContent value="tab1" className="custom-content">
          Content 1
        </TabsContent>
      </Tabs>
    );

    expect(screen.getByText("Content 1")).toHaveClass("custom-content");
  });
});
