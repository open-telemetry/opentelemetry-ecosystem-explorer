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
import type { KeyValueMapNode } from "@/types/configuration";
import { ControlWrapper } from "./control-wrapper";

interface KeyValueMapControlProps {
  node: KeyValueMapNode;
  value: Record<string, string> | null;
  onChange: (path: string, value: Record<string, string> | null) => void;
}

type Entry = { key: string; value: string };

function toEntries(record: Record<string, string>): Entry[] {
  return Object.entries(record).map(([k, v]) => ({ key: k, value: v }));
}

function fromEntries(entries: Entry[]): Record<string, string> {
  return Object.fromEntries(entries.map(({ key, value }) => [key, value]));
}

const INPUT_CLASS =
  "rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20";

export function KeyValueMapControl({ node, value, onChange }: KeyValueMapControlProps) {
  const entries: Entry[] = value ? toEntries(value) : [];
  const isNull = node.nullable === true && value === null;
  const listRef = useRef<HTMLUListElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  const announce = useCallback((message: string) => {
    if (statusRef.current) statusRef.current.textContent = message;
  }, []);

  const emit = (next: Entry[]) => {
    onChange(node.path, fromEntries(next));
  };

  const handleAdd = () => {
    emit([...entries, { key: "", value: "" }]);
    requestAnimationFrame(() => {
      const items = listRef.current?.querySelectorAll("li");
      const lastItem = items?.item(items.length - 1);
      lastItem?.querySelector("input")?.focus();
    });
    announce("Entry added");
  };

  const handleRemove = (index: number) => {
    emit(entries.filter((_, i) => i !== index));
    requestAnimationFrame(() => {
      const items = listRef.current?.querySelectorAll("li");
      if (items && items.length > 0) {
        const focusIndex = Math.min(index, items.length - 1);
        items.item(focusIndex)?.querySelector("input")?.focus();
      } else {
        addButtonRef.current?.focus();
      }
    });
    announce("Entry removed");
  };

  return (
    <ControlWrapper
      node={node}
      isNull={isNull}
      onClear={() => onChange(node.path, null)}
      onActivate={() => onChange(node.path, {})}
    >
      <div className="space-y-2">
        <span ref={statusRef} className="sr-only" aria-live="polite" />
        <div className="flex justify-end">
          <button
            ref={addButtonRef}
            type="button"
            onClick={handleAdd}
            aria-label={`Add entry to ${node.label}`}
            className="flex items-center gap-1 rounded-md border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Add
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">No entries</p>
        ) : (
          <ul ref={listRef} className="space-y-2" aria-label={`${node.label} entries`}>
            {entries.map((entry, index) => (
              <li key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label={`Key ${index + 1}`}
                  placeholder="key"
                  value={entry.key}
                  onChange={(e) => {
                    const next = [...entries];
                    next[index] = { ...next[index], key: e.target.value };
                    emit(next);
                  }}
                  className={`w-2/5 ${INPUT_CLASS}`}
                />
                <span className="text-muted-foreground" aria-hidden="true">
                  =
                </span>
                <input
                  type="text"
                  aria-label={`Value ${index + 1}`}
                  placeholder="value"
                  value={entry.value}
                  onChange={(e) => {
                    const next = [...entries];
                    next[index] = { ...next[index], value: e.target.value };
                    emit(next);
                  }}
                  className={`min-w-0 flex-1 ${INPUT_CLASS}`}
                />
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  aria-label={`Remove entry ${index + 1}`}
                  className="shrink-0 rounded-lg border border-border/60 bg-background/80 p-2 text-muted-foreground transition-all hover:border-red-500/40 hover:text-red-400"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ControlWrapper>
  );
}
