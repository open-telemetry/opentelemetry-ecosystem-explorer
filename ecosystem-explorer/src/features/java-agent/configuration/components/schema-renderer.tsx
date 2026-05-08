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
import type {
  ConfigNode,
  ConfigNodeBase,
  ListNode,
  NumberInputNode,
  TextInputNode,
} from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { parsePath, getByPath } from "@/lib/config-path";
import type { ConfigValue } from "@/types/configuration-builder";
import { TextInputControl } from "./controls/text-input-control";
import { ToggleControl } from "./controls/toggle-control";
import { NumberInputControl } from "./controls/number-input-control";
import { SelectControl } from "./controls/select-control";
import { PrimitiveListControl } from "./controls/primitive-list-control";
import { KeyValueMapControl } from "./controls/key-value-map-control";
import { FlagControl } from "./controls/flag-control";
import { GroupRenderer } from "./group-renderer";
import { ListRenderer } from "./list-renderer";
import { PluginSelectRenderer } from "./plugin-select-renderer";
import { UnionRenderer } from "./union-renderer";
import { CircularRefPlaceholder } from "./circular-ref-placeholder";
import { FieldSection } from "./field-section";
import { useStarterPaths } from "./configuration-ui-context";

export interface SchemaRendererProps {
  node: ConfigNode;
  depth: number;
  path: string;
  /** Forwarded to GroupRenderer when the node is a group. See GroupRenderer.headless. */
  headless?: boolean;
  /**
   * Render the leaf control directly without the depth >= 1 chevron-row wrap.
   * Used by UnionRenderer for variant bodies, where the union's chevron row
   * is the only header and an extra per-leaf chevron would be redundant.
   */
  inline?: boolean;
}

function withHiddenLabel<T extends ConfigNodeBase>(node: T): T {
  return { ...node, hideLabel: true };
}

export function SchemaRenderer({
  node,
  depth,
  path,
  headless = false,
  inline = false,
}: SchemaRendererProps): JSX.Element | null {
  const { state, setValue } = useConfigurationBuilder();
  const starterPaths = useStarterPaths();
  const value = getByPath(state.values, parsePath(path));
  const wrappable =
    !inline &&
    depth >= 1 &&
    (node.controlType === "text_input" ||
      node.controlType === "toggle" ||
      node.controlType === "number_input" ||
      node.controlType === "select" ||
      node.controlType === "flag");

  function wrap(control: JSX.Element): JSX.Element {
    if (!wrappable) return control;
    return (
      <FieldSection node={node} level="field" defaultExpanded={starterPaths.has(path)}>
        <FieldSection.Header>
          <FieldSection.Chevron />
          <FieldSection.Label />
          <FieldSection.Stability />
          <FieldSection.Info />
        </FieldSection.Header>
        <FieldSection.Body>{control}</FieldSection.Body>
      </FieldSection>
    );
  }

  switch (node.controlType) {
    case "group":
      return <GroupRenderer node={node} depth={depth} path={path} headless={headless} />;
    case "list": {
      const itemType = node.itemSchema.controlType;
      if (
        itemType === "text_input" ||
        itemType === "number_input" ||
        itemType === "toggle" ||
        itemType === "select" ||
        itemType === "flag"
      ) {
        return (
          <PrimitiveListControl
            node={node}
            itemSchema={node.itemSchema}
            path={path}
            value={Array.isArray(value) ? (value as ConfigValue[]) : null}
            onChange={(p, v) => setValue(p, v as ConfigValue)}
          />
        );
      }
      return <ListRenderer node={node} depth={depth} path={path} />;
    }
    case "plugin_select":
      return <PluginSelectRenderer node={node} depth={depth} path={path} />;
    case "union":
      return <UnionRenderer node={node} depth={depth} path={path} />;
    case "circular_ref":
      return <CircularRefPlaceholder node={node} />;
    case "text_input":
      return wrap(
        <TextInputControl
          node={withHiddenLabel(node)}
          path={path}
          value={typeof value === "string" ? value : null}
          onChange={(p, v) => setValue(p, v)}
        />
      );
    case "toggle":
      return wrap(
        <ToggleControl
          node={withHiddenLabel(node)}
          path={path}
          value={typeof value === "boolean" ? value : null}
          onChange={(p, v) => setValue(p, v)}
        />
      );
    case "number_input":
      return wrap(
        <NumberInputControl
          node={withHiddenLabel(node)}
          path={path}
          value={typeof value === "number" ? value : null}
          onChange={(p, v) => setValue(p, v)}
        />
      );
    case "select":
      return wrap(
        <SelectControl
          node={withHiddenLabel(node)}
          path={path}
          value={typeof value === "string" ? value : null}
          onChange={(p, v) => setValue(p, v)}
        />
      );
    case "string_list": {
      const itemSchema: TextInputNode = {
        controlType: "text_input",
        key: "item",
        label: "Item",
        path: `${path}.item`,
      };
      const synthetic: ListNode = { ...node, controlType: "list", itemSchema };
      return (
        <PrimitiveListControl
          node={synthetic}
          itemSchema={itemSchema}
          path={path}
          value={Array.isArray(value) ? (value as ConfigValue[]) : null}
          onChange={(p, v) => setValue(p, v as ConfigValue)}
        />
      );
    }
    case "number_list": {
      const itemSchema: NumberInputNode = {
        controlType: "number_input",
        key: "item",
        label: "Item",
        path: `${path}.item`,
      };
      const synthetic: ListNode = { ...node, controlType: "list", itemSchema };
      return (
        <PrimitiveListControl
          node={synthetic}
          itemSchema={itemSchema}
          path={path}
          value={Array.isArray(value) ? (value as ConfigValue[]) : null}
          onChange={(p, v) => setValue(p, v as ConfigValue)}
        />
      );
    }
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
      return wrap(
        <FlagControl
          node={withHiddenLabel(node)}
          path={path}
          value={value === null || value === undefined ? null : {}}
          onChange={(p, v) => setValue(p, v)}
        />
      );
    default:
      return null;
  }
}
