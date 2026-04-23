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
import type { PluginSelectNode, ConfigNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { SchemaRenderer } from "./schema-renderer";
import { parsePath, getByPath } from "@/lib/config-path";

export interface PluginSelectRendererProps {
  node: PluginSelectNode;
  depth: number;
  path: string;
}

const CUSTOM_SENTINEL = "__custom__";

function resolveSelectedKey(value: unknown, options: ConfigNode[]): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) return null;
  const match = options.find((o) => o.key === keys[0]);
  return match ? match.key : keys[0];
}

export function PluginSelectRenderer({
  node,
  depth,
  path,
}: PluginSelectRendererProps): JSX.Element {
  const { state, selectPlugin } = useConfigurationBuilder();
  const current = getByPath(state.values, parsePath(path));
  const selectedKey = resolveSelectedKey(current, node.options);
  const knownOption = selectedKey ? node.options.find((o) => o.key === selectedKey) : undefined;
  const isCustom = !knownOption && selectedKey !== null;
  const selectedIsFlag = knownOption?.controlType === "flag";

  const [customDraft, setCustomDraft] = useState("");
  const [customPickerOpen, setCustomPickerOpen] = useState(false);

  const selectValue = isCustom ? CUSTOM_SENTINEL : (selectedKey ?? "");

  return (
    <div className="space-y-3">
      {node.description && <p className="text-xs text-muted-foreground">{node.description}</p>}
      <select
        aria-label={`${node.label} variant`}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          if (v === CUSTOM_SENTINEL) {
            setCustomPickerOpen(true);
            return;
          }
          selectPlugin(path, v);
        }}
        className="w-full rounded-lg border border-border/60 bg-background/80 px-4 py-2.5 text-sm"
      >
        <option value="" disabled hidden>
          Select a {node.label.toLowerCase()}
        </option>
        {node.options.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
        {node.allowCustom && (
          <option value={CUSTOM_SENTINEL}>{isCustom ? `Custom: ${selectedKey}` : "Custom…"}</option>
        )}
      </select>

      {customPickerOpen && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            autoFocus
            aria-label="Custom plugin name"
            placeholder="custom-plugin-name"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            className="flex-1 rounded-md border border-border/60 bg-background/80 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              const k = customDraft.trim();
              if (!k) return;
              selectPlugin(path, k);
              setCustomPickerOpen(false);
              setCustomDraft("");
            }}
            className="rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-foreground hover:bg-card/80"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setCustomPickerOpen(false);
              setCustomDraft("");
            }}
            className="rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-card/80"
          >
            Cancel
          </button>
        </div>
      )}

      {knownOption && !selectedIsFlag && (
        <SchemaRenderer
          key={knownOption.key}
          node={knownOption}
          depth={depth + 1}
          path={`${path}.${knownOption.key}`}
        />
      )}

      {isCustom && (
        <p className="text-xs text-muted-foreground">
          Custom plugin. Configure its body manually by importing YAML or leave it as an empty
          block.
        </p>
      )}
    </div>
  );
}
