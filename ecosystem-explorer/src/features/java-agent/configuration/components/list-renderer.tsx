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
import { useState, type JSX } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import type { ListNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { SchemaRenderer } from "./schema-renderer";
import { parsePath, getByPath } from "@/lib/config-path";
import { deriveListItemLabel } from "@/lib/derive-list-item-label";
import { SummaryBadge } from "@/components/ui/summary-badge";
import { InfoTooltip } from "@/components/ui/info-tooltip";

export interface ListRendererProps {
  node: ListNode;
  depth: number;
  path: string;
}

export function ListRenderer({ node, depth, path }: ListRendererProps): JSX.Element {
  const { state, addListItem, removeListItem } = useConfigurationBuilder();
  const raw = getByPath(state.values, parsePath(path));
  const items = Array.isArray(raw) ? raw : [];
  const { constraints } = node;
  const canAdd = !constraints?.maxItems || items.length < constraints.maxItems;
  const canRemove = !constraints?.minItems || items.length > constraints.minItems;
  const storedIds = state.listItemIds?.[path];
  // Reducer-owned ids are authoritative for ADD / REMOVE / LOAD_STATE flows;
  // fall back to path+index keys when an entry is absent or out of sync (e.g.
  // arrays seeded by SET_ENABLED or SELECT_PLUGIN, which don't allocate ids).
  const itemKeys =
    storedIds && storedIds.length === items.length
      ? storedIds
      : items.map((_, i) => `${path}#${i}`);
  const [expanded, setExpanded] = useState(false);

  const body = (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-muted-foreground text-xs">No items</p>
      ) : (
        <ul className="space-y-3">
          {items.map((itemValue, i) => {
            const itemPath = `${path}[${i}]`;
            const { label, derived } = deriveListItemLabel(node, itemValue, i);
            return (
              <li
                key={itemKeys[i]}
                className="border-border/40 bg-background/30 space-y-3 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className={derived ? "text-foreground" : "text-muted-foreground italic"}>
                      {label}
                    </span>
                  </span>
                  {canRemove && (
                    <button
                      type="button"
                      aria-label={`Remove item ${i + 1}`}
                      onClick={() => removeListItem(path, i)}
                      className="border-border/60 text-muted-foreground rounded-md border p-1 hover:border-red-500/40 hover:text-red-400"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <SchemaRenderer
                  node={node.itemSchema}
                  depth={depth + 1}
                  path={itemPath}
                  headless={node.itemSchema.controlType === "group"}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
          onClick={() => setExpanded((e) => !e)}
          className="text-foreground hover:text-primary flex items-center gap-1 text-sm font-medium"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {node.label}
        </button>
        {items.length > 0 && (
          <SummaryBadge>{`${items.length} ${items.length === 1 ? "item" : "items"}`}</SummaryBadge>
        )}
        {node.description && <InfoTooltip text={node.description} />}
        {canAdd && (
          <button
            type="button"
            aria-label={`Add item to ${node.label}`}
            onClick={() => addListItem(path)}
            className="border-border/60 text-foreground hover:border-primary/40 ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
          >
            <Plus className="text-primary h-3 w-3" aria-hidden="true" />
            Add
          </button>
        )}
      </div>
      {expanded && body}
    </div>
  );
}
