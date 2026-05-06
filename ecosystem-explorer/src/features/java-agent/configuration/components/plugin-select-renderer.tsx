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
import { useId, useRef, useState, type JSX, type ReactNode } from "react";
import type { PluginSelectNode, ConfigNode } from "@/types/configuration";
import type { ConfigValue } from "@/types/configuration-builder";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { SchemaRenderer } from "./schema-renderer";
import { parsePath, getByPath } from "@/lib/config-path";
import { FieldSection } from "./field-section";
import { ListItemContext, useListItemContext, useStarterPaths } from "./configuration-ui-context";

export interface PluginSelectRendererProps {
  node: PluginSelectNode;
  depth: number;
  path: string;
}

function resolveSelectedKey(value: unknown, options: ConfigNode[]): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) return null;
  const match = options.find((o) => o.key === keys[0]);
  return match ? match.key : keys[0];
}

const TAB_BASE =
  "px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors focus:outline-none focus-visible:text-foreground";
const TAB_ACTIVE = "border-primary text-primary";
const TAB_INACTIVE = "border-transparent text-muted-foreground hover:text-foreground";

export function PluginSelectRenderer({
  node,
  depth,
  path,
}: PluginSelectRendererProps): JSX.Element {
  const { state, selectPlugin, setValue } = useConfigurationBuilder();
  const inListItem = useListItemContext();
  const starterPaths = useStarterPaths();
  const current = getByPath(state.values, parsePath(path));
  const selectedKey = resolveSelectedKey(current, node.options);
  const knownOption = selectedKey ? node.options.find((o) => o.key === selectedKey) : undefined;
  const isCustom = !knownOption && selectedKey !== null;
  const selectedIsFlag = knownOption?.controlType === "flag";

  const [customDraft, setCustomDraft] = useState("");
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [customBackup, setCustomBackup] = useState<ConfigValue | null>(null);
  const customDirtyRef = useRef(false);
  const customTabRef = useRef<HTMLButtonElement>(null);
  const customTabId = useId();
  const customPanelId = useId();
  const customActive = isCustom || customPickerOpen;

  function closeCustomPicker() {
    setCustomPickerOpen(false);
    setCustomDraft("");
    setCustomBackup(null);
    customDirtyRef.current = false;
    customTabRef.current?.focus();
  }

  const tablistOwnsHeader = inListItem || depth < 1;
  const tablist: ReactNode = (
    <div
      role="tablist"
      aria-label={`${node.label} variant`}
      className={`border-border/60 flex flex-wrap items-center gap-x-1 border-b ${inListItem ? "pr-10" : ""}`}
    >
      {tablistOwnsHeader && node.description && (
        <InfoTooltip text={node.description} className="mr-1 self-center" />
      )}
      {node.options.map((opt) => {
        const active = selectedKey === opt.key && !isCustom && !customPickerOpen;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              selectPlugin(path, opt.key);
              setCustomPickerOpen(false);
              setCustomDraft("");
              setCustomBackup(null);
              customDirtyRef.current = false;
            }}
            className={`${TAB_BASE} ${active ? TAB_ACTIVE : TAB_INACTIVE}`}
          >
            {opt.label}
          </button>
        );
      })}
      {node.allowCustom && (
        <button
          ref={customTabRef}
          id={customTabId}
          type="button"
          role="tab"
          aria-selected={customActive}
          aria-controls={customPickerOpen ? customPanelId : undefined}
          onClick={() => {
            setCustomBackup((current ?? null) as ConfigValue | null);
            setCustomDraft(isCustom && selectedKey ? selectedKey : "");
            setCustomPickerOpen(true);
            customDirtyRef.current = false;
          }}
          className={`${TAB_BASE} ${customActive ? TAB_ACTIVE : TAB_INACTIVE}`}
        >
          {isCustom && !customPickerOpen ? `Custom: ${selectedKey}` : "Custom…"}
        </button>
      )}
    </div>
  );

  const customPicker: ReactNode = customPickerOpen ? (
    <div
      id={customPanelId}
      role="tabpanel"
      aria-labelledby={customTabId}
      className="flex items-center gap-2"
    >
      <input
        type="text"
        autoFocus
        aria-label="Custom plugin name"
        placeholder="custom-plugin-name"
        value={customDraft}
        onChange={(e) => {
          const next = e.target.value;
          setCustomDraft(next);
          const trimmed = next.trim();
          if (trimmed) {
            selectPlugin(path, trimmed);
            customDirtyRef.current = true;
          }
        }}
        className="border-border/60 bg-background/80 flex-1 rounded-md border px-3 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={() => {
          if (customDirtyRef.current) {
            setValue(path, customBackup as ConfigValue);
          }
          closeCustomPicker();
        }}
        className="border-border/60 bg-card text-muted-foreground hover:bg-card/80 rounded-md border px-3 py-1.5 text-xs"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={closeCustomPicker}
        className="border-border/60 bg-card text-foreground hover:bg-card/80 rounded-md border px-3 py-1.5 text-xs"
      >
        Done
      </button>
    </div>
  ) : null;

  const optionBody: ReactNode =
    knownOption && !selectedIsFlag && !customPickerOpen ? (
      <div className="pl-3">
        <SchemaRenderer
          key={knownOption.key}
          node={knownOption}
          depth={depth + 1}
          path={`${path}.${knownOption.key}`}
          headless={knownOption.controlType === "group"}
        />
      </div>
    ) : null;

  const customBody: ReactNode = isCustom ? (
    <p className="text-muted-foreground text-xs">
      Custom plugin. Configure its body manually by importing YAML or leave it as an empty block.
    </p>
  ) : null;

  if (inListItem) {
    return (
      <div className="space-y-2">
        {tablist}
        {customPicker}
        <ListItemContext.Provider value={false}>{optionBody}</ListItemContext.Provider>
        {customBody}
      </div>
    );
  }

  if (depth < 1) {
    return (
      <div className="space-y-3">
        {tablist}
        {customPicker}
        {optionBody}
        {customBody}
      </div>
    );
  }

  return (
    <FieldSection node={node} level="field" defaultExpanded={starterPaths.has(path)}>
      <FieldSection.Header>
        <FieldSection.Chevron />
        <FieldSection.Label />
        <FieldSection.Stability />
        <FieldSection.Info />
      </FieldSection.Header>
      <FieldSection.Body>
        <div className="space-y-2">
          {tablist}
          {customPicker}
          {optionBody}
          {customBody}
        </div>
      </FieldSection.Body>
    </FieldSection>
  );
}
