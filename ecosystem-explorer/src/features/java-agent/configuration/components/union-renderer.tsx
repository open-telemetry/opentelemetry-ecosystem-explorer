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
import { useState } from "react";
import type { JSX } from "react";
import type { ConfigNode, UnionNode } from "@/types/configuration";
import type { ConfigValue } from "@/types/configuration-builder";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { SchemaRenderer } from "./schema-renderer";
import { parsePath, getByPath } from "@/lib/config-path";

export interface UnionRendererProps {
  node: UnionNode;
  depth: number;
  path: string;
}

function variantMatches(v: ConfigNode, value: unknown): boolean {
  switch (v.controlType) {
    case "text_input":
    case "select":
      return typeof value === "string";
    case "number_input":
      return typeof value === "number";
    case "toggle":
    case "flag":
      return typeof value === "boolean";
    case "string_list":
    case "number_list":
    case "list":
      return Array.isArray(value);
    case "group":
    case "plugin_select":
    case "key_value_map":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    default:
      return false;
  }
}

function inferVariantKey(value: unknown, variants: ConfigNode[]): string | null {
  const matches = variants.filter((v) => variantMatches(v, value));
  return matches.length === 1 ? matches[0].key : null;
}

function emptyValueFor(variant: ConfigNode): ConfigValue {
  switch (variant.controlType) {
    case "text_input":
    case "select":
      return "";
    case "number_input":
      return 0;
    case "toggle":
    case "flag":
      return false;
    case "string_list":
    case "number_list":
    case "list":
      return [];
    case "group":
    case "plugin_select":
    case "key_value_map":
      return {};
    default:
      return null;
  }
}

const CONTROL_TYPE_DISPLAY: Record<ConfigNode["controlType"], string> = {
  text_input: "Text",
  number_input: "Number",
  toggle: "Boolean",
  select: "Choice",
  flag: "Flag",
  string_list: "Text list",
  number_list: "Number list",
  list: "List",
  key_value_map: "Map",
  group: "Group",
  union: "Variant",
  plugin_select: "Plugin",
  circular_ref: "Reference",
};

// The schema parser names anonymous union members "Variant 1", "Variant 2", …
// when no explicit label is set. Filter those out so we fall back to the
// control-type display name instead of leaking parser-generated labels to UI.
const ANONYMOUS_VARIANT_LABEL_RE = /^Variant \d+$/;

function displayLabel(variant: ConfigNode): string {
  if (variant.label && !ANONYMOUS_VARIANT_LABEL_RE.test(variant.label)) return variant.label;
  return CONTROL_TYPE_DISPLAY[variant.controlType] ?? variant.controlType;
}

function isRenderable(variant: ConfigNode): boolean {
  if (variant.controlType === "group" && variant.children.length === 0) return false;
  return true;
}

export function UnionRenderer({ node, depth, path }: UnionRendererProps): JSX.Element {
  const { state, setValue } = useConfigurationBuilder();
  const current = getByPath(state.values, parsePath(path));

  const renderable = node.variants.filter(isRenderable);
  const effectiveVariants = renderable.length > 0 ? renderable : node.variants.slice(0, 1);

  const [manualPick, setManualPick] = useState<string | null>(null);
  const inferred = inferVariantKey(current, effectiveVariants);
  const selectedKey: string | null = inferred ?? manualPick ?? effectiveVariants[0]?.key ?? null;
  const selectedVariant =
    selectedKey === null ? undefined : effectiveVariants.find((v) => v.key === selectedKey);
  const showChooser = renderable.length > 0;

  const handleChange = (nextKey: string) => {
    if (nextKey === selectedKey) return;
    const nextVariant = effectiveVariants.find((v) => v.key === nextKey);
    if (!nextVariant) return;
    setManualPick(nextKey);
    setValue(path, emptyValueFor(nextVariant));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-foreground text-sm font-medium">{node.label}</p>
        {node.description && <InfoTooltip text={node.description} />}
      </div>
      {showChooser && (
        <fieldset>
          <legend className="sr-only">{node.label}</legend>
          <div className="flex flex-wrap gap-2">
            {effectiveVariants.map((v) => (
              <label key={v.key} className="text-muted-foreground flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  name={`${path}-variant`}
                  value={v.key}
                  checked={selectedKey === v.key}
                  onChange={() => handleChange(v.key)}
                />
                {displayLabel(v)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {selectedVariant && (
        <SchemaRenderer
          key={selectedVariant.key}
          node={{ ...selectedVariant, hideLabel: true } as ConfigNode}
          depth={depth + 1}
          path={path}
        />
      )}
    </div>
  );
}
