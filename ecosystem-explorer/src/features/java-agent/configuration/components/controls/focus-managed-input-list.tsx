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
import type { ReactNode, RefObject } from "react";
import { useCallback, useImperativeHandle, useRef } from "react";
import { X } from "lucide-react";

interface RenderInputProps<T> {
  value: T;
  setValue: (next: T) => void;
  ariaLabel: string;
  index: number;
}

const ROW_FOCUSABLE_SELECTOR = 'input, [role="switch"], select';

export interface FocusManagedInputListHandle {
  /**
   * Call after the consumer's Add handler emits a new item. Schedules focus
   * on the newly-rendered last input and announces "Item added" via the
   * polite live region owned by this component.
   */
  notifyAdded: () => void;
}

interface FocusManagedInputListProps<T> {
  label: string;
  items: T[];
  canRemove: boolean;
  onChange: (next: T[]) => void;
  renderInput: (props: RenderInputProps<T>) => ReactNode;
  /** Add button rendered by the consumer (inside FieldSection.Action). When the
   *  list empties on remove, focus falls back to this button. */
  addButtonRef: RefObject<HTMLButtonElement | null>;
  /** Optional imperative handle; the consumer's Add handler should call
   *  `current?.notifyAdded()` after emitting the new item. */
  handleRef?: RefObject<FocusManagedInputListHandle | null>;
}

/**
 * Renders the rows of inputs plus the per-row Remove buttons for a primitive
 * list (string / number). Owns the live-region announcer and the post-mutation
 * focus restoration. The Add button lives in the consumer's FieldSection.Action
 * slot so the header layout stays consistent across all list-like controls.
 */
export function FocusManagedInputList<T>({
  label,
  items,
  canRemove,
  onChange,
  renderInput,
  addButtonRef,
  handleRef,
}: FocusManagedInputListProps<T>) {
  const listRef = useRef<HTMLUListElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  const announce = useCallback((message: string) => {
    if (statusRef.current) statusRef.current.textContent = message;
  }, []);

  useImperativeHandle(
    handleRef ?? { current: null },
    () => ({
      notifyAdded: () => {
        requestAnimationFrame(() => {
          const inputs = listRef.current?.querySelectorAll<HTMLElement>(ROW_FOCUSABLE_SELECTOR);
          inputs?.item(inputs.length - 1)?.focus();
        });
        announce("Item added");
      },
    }),
    [announce]
  );

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll<HTMLElement>(ROW_FOCUSABLE_SELECTOR);
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
    <>
      <span ref={statusRef} className="sr-only" aria-live="polite" />
      {items.length > 0 && (
        <ul ref={listRef} className="space-y-2" aria-label={`${label} items`}>
          {items.map((item, index) => (
            <li key={index} className="flex gap-2">
              {renderInput({
                value: item,
                setValue: (next) => setItemAt(index, next),
                ariaLabel: `Item ${index + 1}`,
                index,
              })}
              {canRemove && (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  aria-label={`Remove item ${index + 1}`}
                  className="border-border/60 bg-background/80 text-muted-foreground shrink-0 rounded-lg border p-2 transition-all hover:border-red-500/40 hover:text-red-400"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
