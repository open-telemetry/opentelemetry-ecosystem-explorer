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
import { isPlainObject } from "./value-guards";

const ID_KEYS = [
  "name",
  "id",
  "key",
  "match",
  "pattern",
  "endpoint",
  "url",
  "host",
  "path",
] as const;

export interface DerivedLabel {
  label: string;
  /** true when label came from Tier 1 or Tier 2; false when Tier 3 fallback. */
  derived: boolean;
}

/**
 * Derive a row label for a list item. Schema-driven and key-allowlist-free:
 *
 * - Tier 1 (discriminator): if the item is a `plugin_select`, label is the
 *   chosen option's label (e.g. "Batch", "OTLP HTTP").
 * - Tier 2 (identifying child): if the item is a `group`, label is the value
 *   of the first child whose key matches a fixed-priority identifier list.
 * - Tier 3 (typed ordinal): "${singular(parent.label)} ${index+1}" — uses
 *   the parent list's label (e.g. "Loggers" → "Logger 2") because the item
 *   schema's own label is typically the generic "Item" string.
 */
export function deriveListItemLabel(parent: ListNode, value: unknown, index: number): DerivedLabel {
  const itemSchema: ConfigNode = parent.itemSchema;

  if (itemSchema.controlType === "plugin_select" && isPlainObject(value)) {
    const ps = itemSchema as PluginSelectNode;
    const chosenKey = Object.keys(value)[0];
    const opt = ps.options.find((o) => o.key === chosenKey);
    if (opt) return { label: opt.label, derived: true };
  }

  if (itemSchema.controlType === "group" && isPlainObject(value)) {
    const g = itemSchema as GroupNode;
    for (const k of ID_KEYS) {
      const child = g.children.find((c) => c.key === k);
      if (child && typeof value[k] === "string" && (value[k] as string).length > 0) {
        return { label: value[k] as string, derived: true };
      }
    }
  }

  return { label: `${singular(parent.label)} ${index + 1}`, derived: false };
}

/**
 * Strip a trailing "s" (case-preserving) from a plural noun. The OTel
 * config schema labels lists with simple plurals: "Loggers", "Processors",
 * "Views", "Headers", "Readers", "Attributes", "Filters". For irregular
 * plurals (none today) the input is returned unchanged.
 */
function singular(label: string): string {
  if (label.length < 2) return label;
  const last = label.slice(-1);
  if (last === "s" || last === "S") return label.slice(0, -1);
  return label;
}
