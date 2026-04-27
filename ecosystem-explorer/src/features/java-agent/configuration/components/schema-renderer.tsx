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
import type { JSX } from "react";
import type { ConfigNode, StringListNode, NumberListNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { parsePath, getByPath } from "@/lib/config-path";
import type { ConfigValue } from "@/types/configuration-builder";
import { TextInputControl } from "./controls/text-input-control";
import { ToggleControl } from "./controls/toggle-control";
import { NumberInputControl } from "./controls/number-input-control";
import { SelectControl } from "./controls/select-control";
import { StringListControl } from "./controls/string-list-control";
import { NumberListControl } from "./controls/number-list-control";
import { KeyValueMapControl } from "./controls/key-value-map-control";
import { FlagControl } from "./controls/flag-control";
import { GroupRenderer } from "./group-renderer";
import { ListRenderer } from "./list-renderer";
import { PluginSelectRenderer } from "./plugin-select-renderer";
import { UnionRenderer } from "./union-renderer";
import { CircularRefPlaceholder } from "./circular-ref-placeholder";

export interface SchemaRendererProps {
  node: ConfigNode;
  depth: number;
  path: string;
  /** Forwarded to GroupRenderer when the node is a group. See GroupRenderer.headless. */
  headless?: boolean;
}

export function SchemaRenderer({
  node,
  depth,
  path,
  headless = false,
}: SchemaRendererProps): JSX.Element | null {
  const { state, setValue } = useConfigurationBuilder();
  const value = getByPath(state.values, parsePath(path));

  switch (node.controlType) {
    case "group":
      return <GroupRenderer node={node} depth={depth} path={path} headless={headless} />;
    case "list": {
      const itemType = node.itemSchema.controlType;
      if (itemType === "group" || itemType === "plugin_select") {
        return <ListRenderer node={node} depth={depth} path={path} />;
      }
      if (itemType === "text_input") {
        return (
          <StringListControl
            node={{ ...node, controlType: "string_list" } as unknown as StringListNode}
            path={path}
            value={Array.isArray(value) ? (value as string[]) : null}
            onChange={(p, v) => setValue(p, v as ConfigValue)}
          />
        );
      }
      if (itemType === "number_input") {
        return (
          <NumberListControl
            node={{ ...node, controlType: "number_list" } as unknown as NumberListNode}
            path={path}
            value={Array.isArray(value) ? (value as number[]) : null}
            onChange={(p, v) => setValue(p, v as ConfigValue)}
          />
        );
      }
      return <p className="text-xs text-yellow-400">Unsupported list item type: {itemType}</p>;
    }
    case "plugin_select":
      return <PluginSelectRenderer node={node} depth={depth} path={path} />;
    case "union":
      return <UnionRenderer node={node} depth={depth} path={path} />;
    case "circular_ref":
      return <CircularRefPlaceholder node={node} />;
    case "text_input":
      return (
        <TextInputControl
          node={node}
          path={path}
          value={typeof value === "string" ? value : null}
          onChange={(p, v) => setValue(p, v)}
        />
      );
    case "toggle":
      return (
        <ToggleControl
          node={node}
          path={path}
          value={typeof value === "boolean" ? value : null}
          onChange={(p, v) => setValue(p, v)}
        />
      );
    case "number_input":
      return (
        <NumberInputControl
          node={node}
          path={path}
          value={typeof value === "number" ? value : null}
          onChange={(p, v) => setValue(p, v)}
        />
      );
    case "select":
      return (
        <SelectControl
          node={node}
          path={path}
          value={typeof value === "string" ? value : null}
          onChange={(p, v) => setValue(p, v)}
        />
      );
    case "string_list":
      return (
        <StringListControl
          node={node}
          path={path}
          value={Array.isArray(value) ? (value as string[]) : null}
          onChange={(p, v) => setValue(p, v as ConfigValue)}
        />
      );
    case "number_list":
      return (
        <NumberListControl
          node={node}
          path={path}
          value={Array.isArray(value) ? (value as number[]) : null}
          onChange={(p, v) => setValue(p, v as ConfigValue)}
        />
      );
    case "key_value_map":
      return (
        <KeyValueMapControl
          node={node}
          path={path}
          value={
            value && typeof value === "object" && !Array.isArray(value)
              ? (value as Record<string, string>)
              : null
          }
          onChange={(p, v) => setValue(p, v as ConfigValue)}
        />
      );
    case "flag":
      return (
        <FlagControl
          node={node}
          path={path}
          value={value === null || value === undefined ? null : {}}
          onChange={(p, v) => setValue(p, v)}
        />
      );
    default:
      return null;
  }
}
