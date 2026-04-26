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
import type { ListNode } from "@/types/configuration";
import { deriveListItemLabel } from "./derive-list-item-label";

const groupItem = (children: { key: string; controlType: string; label: string }[]) =>
  ({
    controlType: "group",
    key: "item",
    label: "Item",
    path: "list[]",
    children: children.map((c) => ({ ...c, path: `list[].${c.key}` })),
  }) as unknown as ListNode["itemSchema"];

const list = (label: string, itemSchema: ListNode["itemSchema"]): ListNode =>
  ({
    controlType: "list",
    key: "list",
    label,
    path: "list",
    itemSchema,
  }) as unknown as ListNode;

describe("deriveListItemLabel", () => {
  it("Tier 1: returns the chosen plugin_select option label", () => {
    const node = list("Processors", {
      controlType: "plugin_select",
      key: "item",
      label: "Item",
      path: "list[]",
      allowCustom: false,
      options: [
        { controlType: "group", key: "batch", label: "Batch", path: "list[].batch", children: [] },
        {
          controlType: "group",
          key: "simple",
          label: "Simple",
          path: "list[].simple",
          children: [],
        },
      ],
    } as unknown as ListNode["itemSchema"]);
    expect(deriveListItemLabel(node, { batch: {} }, 0)).toEqual({ label: "Batch", derived: true });
    expect(deriveListItemLabel(node, { simple: {} }, 1)).toEqual({
      label: "Simple",
      derived: true,
    });
  });

  it("Tier 1: falls through to Tier 3 when the chosen key is unknown", () => {
    const node = list("Processors", {
      controlType: "plugin_select",
      key: "item",
      label: "Item",
      path: "list[]",
      allowCustom: true,
      options: [
        { controlType: "group", key: "batch", label: "Batch", path: "list[].batch", children: [] },
      ],
    } as unknown as ListNode["itemSchema"]);
    expect(deriveListItemLabel(node, { unknown_plugin: {} }, 2)).toEqual({
      label: "Processor 3",
      derived: false,
    });
  });

  it("Tier 2: returns the value of the first identifying child with a non-empty string", () => {
    const node = list(
      "Loggers",
      groupItem([
        { key: "name", controlType: "text_input", label: "Name" },
        { key: "level", controlType: "select", label: "Level" },
      ])
    );
    expect(deriveListItemLabel(node, { name: "com.example.*", level: "DEBUG" }, 0)).toEqual({
      label: "com.example.*",
      derived: true,
    });
  });

  it("Tier 2: tries each identifier key in order (name > id > key > match > pattern > endpoint > url > host > path)", () => {
    const node = list(
      "Filters",
      groupItem([{ key: "match", controlType: "text_input", label: "Match" }])
    );
    expect(deriveListItemLabel(node, { match: "*" }, 0)).toEqual({ label: "*", derived: true });
  });

  it("Tier 2: skips empty-string values and falls through", () => {
    const node = list(
      "Loggers",
      groupItem([{ key: "name", controlType: "text_input", label: "Name" }])
    );
    expect(deriveListItemLabel(node, { name: "" }, 1)).toEqual({
      label: "Logger 2",
      derived: false,
    });
  });

  it("Tier 3: singularizes the parent label and appends the 1-based ordinal", () => {
    const node = list("Loggers", groupItem([]));
    expect(deriveListItemLabel(node, {}, 0)).toEqual({ label: "Logger 1", derived: false });
    expect(deriveListItemLabel(node, null, 4)).toEqual({ label: "Logger 5", derived: false });
  });

  it("Tier 3: leaves single-letter or non-plural labels alone", () => {
    const node = list("Data", groupItem([]));
    expect(deriveListItemLabel(node, {}, 0)).toEqual({ label: "Data 1", derived: false });
  });
});
