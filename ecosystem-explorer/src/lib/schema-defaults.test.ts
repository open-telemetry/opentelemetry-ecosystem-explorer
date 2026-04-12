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
import { buildDefaults, findNodeByPath } from "./schema-defaults";
import type {
  GroupNode,
  NumberInputNode,
  ToggleNode,
  CircularRefNode,
} from "@/types/configuration";

const attributeLimitsSchema: GroupNode = {
  controlType: "group",
  key: "attribute_limits",
  label: "Attribute Limits",
  path: "attribute_limits",
  children: [
    {
      controlType: "number_input",
      key: "attribute_value_length_limit",
      label: "Attribute Value Length Limit",
      path: "attribute_limits.attribute_value_length_limit",
      nullable: true,
      constraints: { minimum: 0 },
    } as NumberInputNode,
    {
      controlType: "number_input",
      key: "attribute_count_limit",
      label: "Attribute Count Limit",
      path: "attribute_limits.attribute_count_limit",
      nullable: true,
      constraints: { minimum: 0 },
    } as NumberInputNode,
  ],
};

describe("buildDefaults", () => {
  it("should return empty object for group with nullable children", () => {
    expect(buildDefaults(attributeLimitsSchema)).toEqual({});
  });

  it("should handle toggle nodes", () => {
    const toggle: ToggleNode = {
      controlType: "toggle",
      key: "disabled",
      label: "Disabled",
      path: "disabled",
      nullable: true,
    };
    expect(buildDefaults(toggle)).toBeNull();
  });

  it("should skip circular_ref nodes", () => {
    const circularRef: CircularRefNode = {
      controlType: "circular_ref",
      key: "root",
      label: "Root",
      path: "some.path.root",
      refType: "ExperimentalComposableSampler",
      required: true,
    };
    expect(buildDefaults(circularRef)).toBeNull();
  });
});

describe("findNodeByPath", () => {
  const rootSchema: GroupNode = {
    controlType: "group",
    key: "root",
    label: "Root",
    path: "",
    children: [attributeLimitsSchema],
  };

  it("should find node by path segments", () => {
    const node = findNodeByPath(rootSchema, ["attribute_limits", "attribute_count_limit"]);
    expect(node?.key).toBe("attribute_count_limit");
  });

  it("should return undefined for missing path", () => {
    expect(findNodeByPath(rootSchema, ["nonexistent"])).toBeUndefined();
  });
});
