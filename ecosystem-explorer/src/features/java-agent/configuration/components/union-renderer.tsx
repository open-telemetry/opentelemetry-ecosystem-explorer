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
import { SchemaRenderer } from "./schema-renderer";
import { parsePath, getByPath } from "@/lib/config-path";
import { FieldSection } from "./field-section";

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

const ANONYMOUS_VARIANT_LABEL_RE = /^Variant \d+$/;

function displayLabel(variant: ConfigNode): string {
  if (variant.label && !ANONYMOUS_VARIANT_LABEL_RE.test(variant.label)) return variant.label;
  if (variant.controlType === "list") {
    const inner =
      CONTROL_TYPE_DISPLAY[variant.itemSchema.controlType] ?? variant.itemSchema.controlType;
    return `${inner} list`;
  }
  return CONTROL_TYPE_DISPLAY[variant.controlType] ?? variant.controlType;
}

function isRenderable(variant: ConfigNode): boolean {
  if (variant.controlType === "group" && variant.children.length === 0) return false;
  return true;
}

const TAB_BASE =
  "px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors focus:outline-none focus-visible:text-foreground";
const TAB_ACTIVE = "border-primary text-primary";
const TAB_INACTIVE = "border-transparent text-muted-foreground hover:text-foreground";

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

  const tablist = showChooser ? (
    <div
      role="tablist"
      aria-label={`${node.label} variant`}
      className="border-border/60 flex flex-wrap items-center gap-x-1 border-b"
    >
      {effectiveVariants.map((v) => {
        const active = selectedKey === v.key;
        return (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => handleChange(v.key)}
            className={`${TAB_BASE} ${active ? TAB_ACTIVE : TAB_INACTIVE}`}
          >
            {displayLabel(v)}
          </button>
        );
      })}
    </div>
  ) : null;

  const variantBody = selectedVariant ? (
    <SchemaRenderer
      key={selectedVariant.key}
      node={
        {
          ...selectedVariant,
          label: displayLabel(selectedVariant),
          hideLabel: true,
        } as ConfigNode
      }
      depth={depth + 1}
      path={path}
      inline
    />
  ) : null;

  return (
    <FieldSection node={node} level="field" defaultExpanded>
      <FieldSection.Header>
        <FieldSection.Chevron />
        <FieldSection.Label />
        <FieldSection.Stability />
        <FieldSection.Info />
      </FieldSection.Header>
      <FieldSection.Body>
        <div className="space-y-2">
          {tablist}
          {variantBody}
        </div>
      </FieldSection.Body>
    </FieldSection>
  );
}
