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
import { useCallback, useRef } from "react";
import { Plus, X } from "lucide-react";
import type { StringListNode } from "@/types/configuration";
import { ControlWrapper } from "./control-wrapper";

interface StringListControlProps {
  node: StringListNode;
  value: string[] | null;
  onChange: (path: string, value: string[] | null) => void;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-border/60 bg-background/80 px-4 py-2 text-sm backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20";

export function StringListControl({ node, value, onChange }: StringListControlProps) {
  const items = value ?? [];
  const isNull = node.nullable === true && value === null;
  const { constraints } = node;
  const canAdd = !constraints?.maxItems || items.length < constraints.maxItems;
  const canRemove = !constraints?.minItems || items.length > constraints.minItems;
  const listRef = useRef<HTMLUListElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  const announce = useCallback((message: string) => {
    if (statusRef.current) statusRef.current.textContent = message;
  }, []);

  const handleAdd = () => {
    onChange(node.path, [...items, ""]);
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll("input");
      inputs?.item(inputs.length - 1)?.focus();
    });
    announce("Item added");
  };

  const handleRemove = (index: number) => {
    onChange(
      node.path,
      items.filter((_, i) => i !== index)
    );
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll("input");
      if (inputs && inputs.length > 0) {
        const focusIndex = Math.min(index, inputs.length - 1);
        inputs.item(focusIndex)?.focus();
      } else {
        addButtonRef.current?.focus();
      }
    });
    announce("Item removed");
  };

  return (
    <ControlWrapper
      node={node}
      isNull={isNull}
      onClear={() => onChange(node.path, null)}
      onActivate={() => onChange(node.path, [])}
    >
      <div className="space-y-2">
        <span ref={statusRef} className="sr-only" aria-live="polite" />
        <div className="flex justify-end">
          {canAdd && (
            <button
              ref={addButtonRef}
              type="button"
              onClick={handleAdd}
              aria-label={`Add item to ${node.label}`}
              className="flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              Add
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">No items</p>
        ) : (
          <ul ref={listRef} className="space-y-2" aria-label={`${node.label} items`}>
            {items.map((item, index) => (
              <li key={index} className="flex gap-2">
                <input
                  type="text"
                  aria-label={`Item ${index + 1}`}
                  value={item}
                  onChange={(e) => {
                    const next = [...items];
                    next[index] = e.target.value;
                    onChange(node.path, next);
                  }}
                  className={INPUT_CLASS}
                />
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    aria-label={`Remove item ${index + 1}`}
                    className="shrink-0 rounded-lg border border-border/60 bg-background/80 p-2 text-muted-foreground transition-all hover:border-red-500/40 hover:text-red-400"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {constraints &&
          (constraints.minItems !== undefined || constraints.maxItems !== undefined) && (
            <p className="text-xs text-muted-foreground/70">
              {constraints.minItems !== undefined && constraints.maxItems !== undefined
                ? `${constraints.minItems}–${constraints.maxItems} items`
                : constraints.minItems !== undefined
                  ? `At least ${constraints.minItems} items`
                  : `Up to ${constraints.maxItems} items`}
            </p>
          )}
      </div>
    </ControlWrapper>
  );
}
