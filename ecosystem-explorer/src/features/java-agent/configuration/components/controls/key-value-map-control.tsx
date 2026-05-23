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
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { KeyValueMapNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { ControlWrapper } from "./control-wrapper";
import { FieldSection } from "../field-section";

interface KeyValueMapControlProps {
  node: KeyValueMapNode;
  path: string;
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

function getDuplicateKeys(entries: Entry[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (entry.key === "") continue;
    if (seen.has(entry.key)) {
      duplicates.add(entry.key);
    } else {
      seen.add(entry.key);
    }
  }
  return duplicates;
}

const INPUT_CLASS =
  "rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20";

const INPUT_ERROR_CLASS =
  "rounded-lg border border-red-500/60 bg-background/80 px-3 py-2 text-sm backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-red-500/80 focus:outline-none focus:ring-2 focus:ring-red-500/20";

export function KeyValueMapControl({ node, path, value, onChange }: KeyValueMapControlProps) {
  const isNull = node.nullable === true && value === null;
  const { state } = useConfigurationBuilder();
  const error = state.validationErrors[path] ?? null;
  const listRef = useRef<HTMLUListElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  // Track entries in local state so the UI can display duplicate rows before
  // fromEntries silently drops them. lastSerializedEmit lets us distinguish
  // our own onChange calls from external resets (e.g. Reset or Import YAML).
  const [localEntries, setLocalEntries] = useState<Entry[]>(() => (value ? toEntries(value) : []));
  const lastSerializedEmit = useRef<string>(JSON.stringify(value ?? {}));

  useEffect(() => {
    const serialized = JSON.stringify(value ?? {});
    if (serialized !== lastSerializedEmit.current) {
      lastSerializedEmit.current = serialized;
      setLocalEntries(value ? toEntries(value) : []);
    }
  }, [value]);

  const duplicateKeys = getDuplicateKeys(localEntries);

  const announce = useCallback((message: string) => {
    if (statusRef.current) statusRef.current.textContent = message;
  }, []);

  const emit = (next: Entry[]) => {
    const obj = fromEntries(next);
    lastSerializedEmit.current = JSON.stringify(obj);
    setLocalEntries(next);
    onChange(path, obj);
  };

  const handleAdd = () => {
    emit([...localEntries, { key: "", value: "" }]);
    requestAnimationFrame(() => {
      const items = listRef.current?.querySelectorAll("li");
      const lastItem = items?.item(items.length - 1);
      lastItem?.querySelector("input")?.focus();
    });
    announce("Entry added");
  };

  const handleRemove = (index: number) => {
    emit(localEntries.filter((_, i) => i !== index));
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
      error={error}
      onClear={() => onChange(path, null)}
      hideLabel
    >
      <FieldSection node={node} level="field" value={value ?? {}} asGroup={false}>
        <FieldSection.Header>
          <FieldSection.Label />
          <FieldSection.Stability />
          <FieldSection.Info />
          <FieldSection.Action>
            <button
              ref={addButtonRef}
              type="button"
              onClick={handleAdd}
              aria-label={`Add entry to ${node.label}`}
              className="border-border/60 bg-background/80 hover:border-primary/40 text-foreground flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition-all"
            >
              <Plus className="text-primary h-3 w-3" aria-hidden="true" />
              Add
            </button>
          </FieldSection.Action>
        </FieldSection.Header>
        <FieldSection.Body>
          <span ref={statusRef} className="sr-only" aria-live="polite" />
          {localEntries.length === 0 ? (
            <FieldSection.Empty>No entries yet</FieldSection.Empty>
          ) : (
            <ul ref={listRef} className="space-y-2" aria-label={`${node.label} entries`}>
              {localEntries.map((entry, index) => {
                const isDuplicate = duplicateKeys.has(entry.key);
                return (
                  <li key={index} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        aria-label={`Key ${index + 1}`}
                        aria-invalid={isDuplicate}
                        aria-describedby={isDuplicate ? `dup-key-${path}-${index}` : undefined}
                        placeholder="key"
                        value={entry.key}
                        onChange={(e) => {
                          const next = [...localEntries];
                          next[index] = { ...next[index], key: e.target.value };
                          emit(next);
                        }}
                        className={`w-2/5 ${isDuplicate ? INPUT_ERROR_CLASS : INPUT_CLASS}`}
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
                          const next = [...localEntries];
                          next[index] = { ...next[index], value: e.target.value };
                          emit(next);
                        }}
                        className={`min-w-0 flex-1 ${INPUT_CLASS}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemove(index)}
                        aria-label={`Remove entry ${index + 1}`}
                        className="border-border/60 bg-background/80 text-muted-foreground shrink-0 rounded-lg border p-2 transition-all hover:border-red-500/40 hover:text-red-400"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    {isDuplicate && (
                      <p
                        id={`dup-key-${path}-${index}`}
                        role="alert"
                        className="pl-1 text-xs text-red-400"
                      >
                        Duplicate key. Only the last entry with this key will appear in the
                        generated YAML.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </FieldSection.Body>
      </FieldSection>
    </ControlWrapper>
  );
}
