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
import { buildDefaults, buildPluginDefaults, findNodeByPath } from "./schema-defaults";
import type {
  ConfigNode,
  GroupNode,
  NumberInputNode,
  PluginSelectNode,
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

describe("buildPluginDefaults", () => {
  const pluginNode: PluginSelectNode = {
    controlType: "plugin_select",
    key: "propagator",
    label: "Item",
    path: "propagator.composite.item",
    allowCustom: true,
    options: [
      {
        controlType: "group",
        key: "tracecontext",
        label: "Tracecontext",
        path: "propagator.composite.item.tracecontext",
        children: [],
      },
    ],
  };

  it("emits the known plugin key with its built defaults", () => {
    expect(buildPluginDefaults(pluginNode, "tracecontext")).toEqual({ tracecontext: {} });
  });

  it("emits an empty-body entry for a custom plugin key when allowCustom is true", () => {
    expect(buildPluginDefaults(pluginNode, "xray")).toEqual({ xray: {} });
  });

  it("returns an empty object for an unknown key when allowCustom is false", () => {
    const strict: PluginSelectNode = { ...pluginNode, allowCustom: false };
    expect(buildPluginDefaults(strict, "xray")).toEqual({});
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

  it("returns the circular_ref node and stops descending", () => {
    const samplerSchema: ConfigNode = {
      controlType: "group",
      key: "root",
      label: "Root",
      path: "",
      children: [
        {
          controlType: "group",
          key: "tracer_provider",
          label: "Tracer Provider",
          path: "tracer_provider",
          children: [
            {
              controlType: "plugin_select",
              key: "sampler",
              label: "Sampler",
              path: "tracer_provider.sampler",
              allowCustom: true,
              options: [
                {
                  controlType: "group",
                  key: "parent_based",
                  label: "Parent Based",
                  path: "tracer_provider.sampler.parent_based",
                  children: [
                    {
                      controlType: "circular_ref",
                      key: "root",
                      label: "Root",
                      path: "tracer_provider.sampler.parent_based.root",
                      refType: "Sampler",
                    } as CircularRefNode,
                  ],
                },
              ],
            } as PluginSelectNode,
          ],
        },
      ],
    };
    const direct = findNodeByPath(samplerSchema, [
      "tracer_provider",
      "sampler",
      "parent_based",
      "root",
    ]);
    expect(direct?.controlType).toBe("circular_ref");
    const past = findNodeByPath(samplerSchema, [
      "tracer_provider",
      "sampler",
      "parent_based",
      "root",
      "always_on",
    ]);
    expect(past?.controlType).toBe("circular_ref");
  });

  it("descends into union variants by key", () => {
    const schema: ConfigNode = {
      controlType: "group",
      key: "root",
      label: "Root",
      path: "",
      children: [
        {
          controlType: "union",
          key: "value",
          label: "Value",
          path: "value",
          variants: [
            { controlType: "text_input", key: "string", label: "String", path: "value.string" },
            { controlType: "number_input", key: "int", label: "Int", path: "value.int" },
          ],
        },
      ],
    };
    const node = findNodeByPath(schema, ["value", "string"]);
    expect(node?.controlType).toBe("text_input");
  });
});
