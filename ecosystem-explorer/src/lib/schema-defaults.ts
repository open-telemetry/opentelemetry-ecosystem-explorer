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
import type { ConfigNode, GroupNode, ListNode, PluginSelectNode } from "@/types/configuration";
import type { ConfigValue, ConfigValues } from "@/types/configuration-builder";

export function buildDefaults(node: ConfigNode): ConfigValue {
  switch (node.controlType) {
    case "group": {
      const obj: ConfigValues = {};
      for (const child of node.children) {
        if (child.required) {
          const val = buildDefaults(child);
          if (val !== null) {
            obj[child.key] = val;
          }
        }
      }
      return obj;
    }

    case "list":
    case "string_list":
    case "number_list":
      return [];

    case "plugin_select": {
      const pluginNode = node as PluginSelectNode;
      if (pluginNode.options.length > 0) {
        const firstOption = pluginNode.options[0];
        return { [firstOption.key]: buildDefaults(firstOption) };
      }
      return {};
    }

    case "key_value_map":
      return {};

    case "circular_ref":
      return null;

    case "union":
      return null;

    case "text_input":
      return "";

    case "number_input":
      return null;

    case "toggle":
    case "flag":
      return null;

    case "select":
      return null;

    default:
      return null;
  }
}

export function buildPluginDefaults(
  pluginSelectNode: PluginSelectNode,
  pluginKey: string
): ConfigValues {
  const option = pluginSelectNode.options.find((o) => o.key === pluginKey);
  if (!option) return {};
  const defaults = buildDefaults(option);
  return { [pluginKey]: defaults };
}

export function buildListItemDefaults(listNode: ListNode): ConfigValue {
  return buildDefaults(listNode.itemSchema);
}

export function findNodeByPath(
  root: ConfigNode,
  segments: (string | number)[]
): ConfigNode | undefined {
  let current: ConfigNode | undefined = root;

  for (const segment of segments) {
    if (!current) return undefined;
    if (typeof segment === "number") continue;

    if (current.controlType === "group") {
      current = (current as GroupNode).children.find((c) => c.key === segment);
    } else if (current.controlType === "plugin_select") {
      current = (current as PluginSelectNode).options.find((o) => o.key === segment);
    } else if (current.controlType === "list") {
      const listNode = current as ListNode;
      if (listNode.itemSchema.controlType === "group") {
        current = (listNode.itemSchema as GroupNode).children.find((c) => c.key === segment);
      } else if (listNode.itemSchema.controlType === "plugin_select") {
        current = (listNode.itemSchema as PluginSelectNode).options.find((o) => o.key === segment);
      } else {
        current = undefined;
      }
    } else {
      current = undefined;
    }
  }

  return current;
}
