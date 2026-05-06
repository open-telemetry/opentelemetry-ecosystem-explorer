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
import { Plus, X } from "lucide-react";
import type { ListNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { SchemaRenderer } from "./schema-renderer";
import { parsePath, getByPath } from "@/lib/config-path";
import { deriveListItemLabel } from "@/lib/derive-list-item-label";
import { FieldSection } from "./field-section";
import { ListItemContext, useStarterPaths } from "./configuration-ui-context";

export interface ListRendererProps {
  node: ListNode;
  depth: number;
  path: string;
}

export function ListRenderer({ node, depth, path }: ListRendererProps): JSX.Element {
  const { state, addListItem, removeListItem } = useConfigurationBuilder();
  const starterPaths = useStarterPaths();
  const raw = getByPath(state.values, parsePath(path));
  const items = Array.isArray(raw) ? raw : [];
  const { constraints } = node;
  const canRemove = !constraints?.minItems || items.length > constraints.minItems;
  const storedIds = state.listItemIds?.[path];
  const itemKeys =
    storedIds && storedIds.length === items.length
      ? storedIds
      : items.map((_, i) => `${path}#${i}`);
  const itemHasTablist = node.itemSchema.controlType === "plugin_select";

  return (
    <FieldSection node={node} level="field" value={items} defaultExpanded={starterPaths.has(path)}>
      <FieldSection.Header>
        <FieldSection.Chevron />
        <FieldSection.Label />
        <FieldSection.Stability />
        <FieldSection.Info />
        <FieldSection.Action>
          <button
            type="button"
            aria-label={`Add item to ${node.label}`}
            onClick={() => addListItem(path)}
            className="border-border/60 hover:border-primary/40 text-foreground inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
          >
            <Plus className="text-primary h-3 w-3" aria-hidden="true" />
            Add
          </button>
        </FieldSection.Action>
      </FieldSection.Header>
      <FieldSection.Body>
        {items.length === 0 ? (
          <FieldSection.Empty />
        ) : (
          <ul className="space-y-3">
            {items.map((itemValue, i) => {
              const itemPath = `${path}[${i}]`;
              const { label, derived } = deriveListItemLabel(node, itemValue, i);
              const removeButton = canRemove ? (
                <button
                  type="button"
                  aria-label={`Remove item ${i + 1}`}
                  onClick={() => removeListItem(path, i)}
                  className="border-border/60 text-muted-foreground rounded-md border p-1 hover:border-red-500/40 hover:text-red-400"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              ) : null;
              return (
                <li
                  key={itemKeys[i]}
                  className={`border-border/40 bg-background/30 space-y-3 rounded-lg border p-4 ${itemHasTablist ? "relative" : ""}`}
                >
                  {itemHasTablist ? (
                    removeButton && (
                      <span className="absolute top-3 right-3 z-10">{removeButton}</span>
                    )
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-medium ${derived ? "text-foreground" : "text-muted-foreground italic"}`}
                      >
                        {label}
                      </span>
                      {removeButton}
                    </div>
                  )}
                  <ListItemContext.Provider value={true}>
                    <SchemaRenderer
                      node={node.itemSchema}
                      depth={depth + 1}
                      path={itemPath}
                      headless={node.itemSchema.controlType === "group"}
                    />
                  </ListItemContext.Provider>
                </li>
              );
            })}
          </ul>
        )}
      </FieldSection.Body>
    </FieldSection>
  );
}
