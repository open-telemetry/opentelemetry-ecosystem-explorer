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
import { useRef, type JSX } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import type { Configuration } from "@/types/javaagent";
import type { ConfigValue, ConfigValues } from "@/types/configuration-builder";
import type { AggregatedConfig } from "@/lib/configurations-aggregate";
import { parseDefault } from "@/lib/declarative-name";
import { getByPath } from "@/lib/config-path";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { SwitchPill } from "@/components/ui/switch-pill";
import {
  FocusManagedInputList,
  type FocusManagedInputListHandle,
} from "./controls/focus-managed-input-list";
import { INPUT_CLASS, LIST_INPUT_CLASS } from "./controls/control-styles";

export interface InstrumentationConfigFieldProps {
  config: AggregatedConfig;
  onJumpToGeneral: (sectionKey: string) => void;
}

interface ControlRendererProps {
  value: ConfigValue;
  onChange: (next: ConfigValue) => void;
  onClear: () => void;
  ariaLabel: string;
  disabled: boolean;
  showAdd: boolean;
}

type ControlRenderer = (props: ControlRendererProps) => JSX.Element;

function BooleanRenderer({ value, onChange, ariaLabel, disabled }: ControlRendererProps) {
  const checked = Boolean(value);
  return (
    <SwitchPill
      checked={checked}
      onClick={() => {
        if (disabled) return;
        onChange(!checked);
      }}
      ariaLabel={ariaLabel}
    />
  );
}

function StringRenderer({ value, onChange, ariaLabel, disabled }: ControlRendererProps) {
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      disabled={disabled}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_CLASS}
    />
  );
}

function NumberRenderer({ value, onChange, onClear, ariaLabel, disabled }: ControlRendererProps) {
  return (
    <input
      type="number"
      aria-label={ariaLabel}
      disabled={disabled}
      value={typeof value === "number" ? value : ""}
      onChange={(e) => {
        if (e.target.value === "") {
          onClear();
          return;
        }
        const num = Number(e.target.value);
        if (Number.isFinite(num)) onChange(num);
      }}
      className={INPUT_CLASS}
    />
  );
}

function StringListRenderer({
  value,
  onChange,
  ariaLabel,
  disabled,
  showAdd,
}: ControlRendererProps) {
  const items = Array.isArray(value)
    ? (value.filter((v) => typeof v === "string") as string[])
    : [];
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const handleRef = useRef<FocusManagedInputListHandle | null>(null);
  return (
    <div className="w-full max-w-xl">
      <FocusManagedInputList<string>
        label={ariaLabel}
        items={items}
        canRemove={!disabled}
        onChange={(next) => onChange(next as ConfigValue[])}
        addButtonRef={addBtnRef}
        handleRef={handleRef}
        renderInput={({ value: v, setValue, ariaLabel: a }) => (
          <input
            type="text"
            aria-label={a}
            value={v}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
            className={LIST_INPUT_CLASS}
          />
        )}
      />
      {showAdd ? (
        <button
          ref={addBtnRef}
          type="button"
          onClick={() => {
            onChange([...items, ""]);
            handleRef.current?.notifyAdded();
          }}
          className="border-border/60 text-foreground hover:bg-card/80 mt-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Add
        </button>
      ) : null}
    </div>
  );
}

interface MapEntry {
  key: string;
  value: string;
}

function toEntries(value: ConfigValue): MapEntry[] {
  if (!isPlainObject(value)) return [];
  return Object.entries(value).map(([k, v]) => ({
    key: k,
    value: typeof v === "string" ? v : String(v),
  }));
}

function fromEntries(entries: MapEntry[]): ConfigValues {
  const out: ConfigValues = {};
  for (const e of entries) out[e.key] = e.value;
  return out;
}

function KeyValueMapRenderer({
  value,
  onChange,
  ariaLabel,
  disabled,
  showAdd,
}: ControlRendererProps) {
  const entries = toEntries(value);
  const update = (next: MapEntry[]) => onChange(fromEntries(next));
  return (
    <div className="w-full max-w-xl space-y-1.5" aria-label={ariaLabel}>
      {entries.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            aria-label={`${ariaLabel} key ${idx}`}
            value={entry.key}
            disabled={disabled}
            onChange={(e) => {
              const next = [...entries];
              next[idx] = { ...next[idx], key: e.target.value };
              update(next);
            }}
            className={LIST_INPUT_CLASS}
          />
          <input
            type="text"
            aria-label={`${ariaLabel} value ${idx}`}
            value={entry.value}
            disabled={disabled}
            onChange={(e) => {
              const next = [...entries];
              next[idx] = { ...next[idx], value: e.target.value };
              update(next);
            }}
            className={LIST_INPUT_CLASS}
          />
          <button
            type="button"
            onClick={() => {
              const next = entries.filter((_, i) => i !== idx);
              update(next);
            }}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground rounded-md p-1"
            aria-label={`Remove entry ${idx}`}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      ))}
      {showAdd ? (
        <button
          type="button"
          onClick={() => update([...entries, { key: `new_key_${entries.length + 1}`, value: "" }])}
          className="border-border/60 text-foreground hover:bg-card/80 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Add entry
        </button>
      ) : null}
    </div>
  );
}

const RENDER_BY_TYPE: Record<Configuration["type"], ControlRenderer> = {
  boolean: BooleanRenderer,
  string: StringRenderer,
  int: NumberRenderer,
  double: NumberRenderer,
  list: StringListRenderer,
  map: KeyValueMapRenderer,
};

export function InstrumentationConfigField({
  config,
  onJumpToGeneral,
}: InstrumentationConfigFieldProps): JSX.Element {
  const { entry, scope, path } = config;
  const declarativeName = entry.declarative_name ?? "";
  const isReadOnly = scope === "general";
  const isExperimental = declarativeName.includes("/development");

  const { state, setValueByPath, removeMapEntry } = useConfigurationBuilder();
  const currentValue = getByPath(state.values, path);
  const isOverridden = currentValue !== undefined && currentValue !== null;
  const typeMismatch = isOverridden && !valueMatchesType(currentValue, entry.type);

  const parentPath = path.slice(0, -1).join(".");
  const leafKey = String(path[path.length - 1]);

  const handleOverride = () => {
    setValueByPath(path, parseDefault(entry.type, entry.default));
  };

  const handleReset = () => {
    removeMapEntry(parentPath, leafKey);
  };

  const handleChange = (next: ConfigValue) => {
    setValueByPath(path, next);
  };

  const Render = RENDER_BY_TYPE[entry.type];

  return (
    <div
      data-testid={`config-field-${declarativeName}`}
      data-scope={scope}
      className={fieldClass(scope)}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-foreground font-mono text-sm">{declarativeName}</span>
        <ScopePill scope={scope} />
        {isExperimental ? <ExperimentalPill /> : null}
        {typeMismatch ? <MismatchPill type={entry.type} /> : null}
      </div>

      {entry.description ? (
        <p className="text-muted-foreground mt-1 text-xs">{entry.description}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {isReadOnly ? (
          <Render
            value={currentValue ?? defaultRenderValue(entry.type)}
            onChange={() => {}}
            onClear={() => {}}
            ariaLabel={declarativeName}
            disabled={true}
            showAdd={false}
          />
        ) : isOverridden ? (
          <Render
            value={currentValue as ConfigValue}
            onChange={handleChange}
            onClear={handleReset}
            ariaLabel={declarativeName}
            disabled={false}
            showAdd={true}
          />
        ) : (
          <DefaultPreview type={entry.type} raw={entry.default} />
        )}

        {isReadOnly ? (
          <button
            type="button"
            onClick={() => onJumpToGeneral("general")}
            className="border-border/60 text-foreground hover:bg-card/80 inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs"
          >
            Edit in General Settings ↑
          </button>
        ) : isOverridden ? (
          <button
            type="button"
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-md p-1 text-xs"
            aria-label={`Reset ${declarativeName}`}
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Reset
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOverride}
            className="border-border/60 text-foreground hover:bg-card/80 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            Override
          </button>
        )}
      </div>
    </div>
  );
}

function valueMatchesType(value: ConfigValue | undefined, type: Configuration["type"]): boolean {
  switch (type) {
    case "boolean":
      return typeof value === "boolean";
    case "string":
      return typeof value === "string";
    case "int":
    case "double":
      return typeof value === "number";
    case "list":
      return Array.isArray(value);
    case "map":
      return isPlainObject(value);
  }
}

function defaultRenderValue(type: Configuration["type"]): ConfigValue {
  switch (type) {
    case "boolean":
      return false;
    case "string":
      return "";
    case "int":
    case "double":
      return 0;
    case "list":
      return [];
    case "map":
      return {};
  }
}

function fieldClass(scope: AggregatedConfig["scope"]): string {
  const base = "rounded-md border border-border/60 bg-background/40 px-3 py-2";
  if (scope === "general") return `${base} border-l-[3px] border-l-purple-400/60 opacity-90`;
  if (scope === "common") return `${base} border-l-[3px] border-l-amber-400/60`;
  return base;
}

function ScopePill({ scope }: { scope: AggregatedConfig["scope"] }) {
  if (scope === "general") {
    return (
      <span className="inline-flex items-center rounded-full border border-purple-400/40 bg-purple-400/10 px-2 py-0.5 text-[10px] leading-none text-purple-300">
        general · shared
      </span>
    );
  }
  if (scope === "common") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] leading-none text-amber-300">
        java.common · shared
      </span>
    );
  }
  return null;
}

function ExperimentalPill() {
  return (
    <span className="inline-flex items-center rounded-full border border-red-400/40 bg-red-400/10 px-2 py-0.5 text-[10px] leading-none text-red-300">
      experimental
    </span>
  );
}

function MismatchPill({ type }: { type: Configuration["type"] }) {
  const article = type === "int" || type === "double" ? "a number" : `a ${type}`;
  return (
    <span className="inline-flex items-center rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2 py-0.5 text-[10px] leading-none text-yellow-300">
      imported value not {article}
    </span>
  );
}

function DefaultPreview({
  type,
  raw,
}: {
  type: Configuration["type"];
  raw: string | boolean | number;
}) {
  const text = type === "list" || type === "map" ? "" : String(raw);
  return (
    <span className="text-muted-foreground text-xs italic">
      default: <code className="font-mono">{text === "" ? "(empty)" : text}</code>
    </span>
  );
}

function isPlainObject(v: ConfigValue | undefined): v is ConfigValues {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
