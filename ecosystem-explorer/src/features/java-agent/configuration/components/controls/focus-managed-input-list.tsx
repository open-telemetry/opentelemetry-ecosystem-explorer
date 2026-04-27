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
import type { ReactNode } from "react";
import { useCallback, useRef } from "react";
import { Plus, X } from "lucide-react";

interface RenderInputProps<T> {
  value: T;
  setValue: (next: T) => void;
  ariaLabel: string;
}

interface FocusManagedInputListProps<T> {
  label: string;
  items: T[];
  canAdd: boolean;
  canRemove: boolean;
  makeEmpty: () => T;
  onChange: (next: T[]) => void;
  renderInput: (props: RenderInputProps<T>) => ReactNode;
}

/**
 * Visual + a11y shell for list-of-input controls. Owns the Add/Remove
 * buttons, the live-region announcer, and the post-mutation focus
 * restoration (focus the new last input on add; the next surviving input
 * on remove; the Add button if the list is now empty). Per-row inputs are
 * supplied by the caller via `renderInput`.
 */
export function FocusManagedInputList<T>({
  label,
  items,
  canAdd,
  canRemove,
  makeEmpty,
  onChange,
  renderInput,
}: FocusManagedInputListProps<T>) {
  const listRef = useRef<HTMLUListElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  const announce = useCallback((message: string) => {
    if (statusRef.current) statusRef.current.textContent = message;
  }, []);

  const handleAdd = () => {
    onChange([...items, makeEmpty()]);
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll("input");
      inputs?.item(inputs.length - 1)?.focus();
    });
    announce("Item added");
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
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

  const setItemAt = (index: number, next: T) => {
    const arr = [...items];
    arr[index] = next;
    onChange(arr);
  };

  return (
    <div className="space-y-2">
      <span ref={statusRef} className="sr-only" aria-live="polite" />
      <div className="flex justify-end">
        {canAdd && (
          <button
            ref={addButtonRef}
            type="button"
            onClick={handleAdd}
            aria-label={`Add item to ${label}`}
            className="flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-foreground transition-all hover:border-primary/40"
          >
            <Plus className="h-3 w-3 text-primary" aria-hidden="true" />
            Add
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No items</p>
      ) : (
        <ul ref={listRef} className="space-y-2" aria-label={`${label} items`}>
          {items.map((item, index) => (
            <li key={index} className="flex gap-2">
              {renderInput({
                value: item,
                setValue: (next) => setItemAt(index, next),
                ariaLabel: `Item ${index + 1}`,
              })}
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
    </div>
  );
}
