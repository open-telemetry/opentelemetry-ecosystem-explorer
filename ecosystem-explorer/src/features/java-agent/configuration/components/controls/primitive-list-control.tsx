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
import { useRef } from "react";
import { Plus } from "lucide-react";
import type {
  ConfigNode,
  ListNode,
  NumberListNode,
  SelectNode,
  StringListNode,
} from "@/types/configuration";
import type { ConfigValue } from "@/types/configuration-builder";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { SwitchPill } from "@/components/ui/switch-pill";
import { ControlWrapper } from "./control-wrapper";
import { LIST_INPUT_CLASS } from "./control-styles";
import {
  FocusManagedInputList,
  type FocusManagedInputListHandle,
} from "./focus-managed-input-list";
import { FieldSection } from "../field-section";

type LeafItemControl = "text_input" | "number_input" | "toggle" | "select" | "flag";

interface PrimitiveListControlProps {
  node: ListNode | StringListNode | NumberListNode;
  itemSchema: ConfigNode;
  path: string;
  value: ConfigValue[] | null;
  onChange: (path: string, value: ConfigValue[] | null) => void;
}

function emptyValueFor(controlType: LeafItemControl): ConfigValue {
  switch (controlType) {
    case "text_input":
    case "select":
      return "";
    case "number_input":
      return 0;
    case "toggle":
    case "flag":
      return false;
  }
}

function PrimitiveItemInput({
  itemSchema,
  value,
  setValue,
  ariaLabel,
}: {
  itemSchema: ConfigNode;
  value: ConfigValue;
  setValue: (next: ConfigValue) => void;
  ariaLabel: string;
}) {
  switch (itemSchema.controlType) {
    case "text_input":
      return (
        <input
          type="text"
          aria-label={ariaLabel}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(e.target.value)}
          className={LIST_INPUT_CLASS}
        />
      );
    case "number_input":
      return (
        <input
          type="number"
          aria-label={ariaLabel}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => {
            const parsed = e.target.value === "" ? 0 : Number(e.target.value);
            setValue(Number.isNaN(parsed) ? 0 : parsed);
          }}
          className={LIST_INPUT_CLASS}
        />
      );
    case "toggle":
    case "flag": {
      const checked =
        value === true || (itemSchema.controlType === "flag" && value !== false && value != null);
      return (
        <span className="flex flex-1 items-center">
          <SwitchPill
            checked={checked}
            ariaLabel={ariaLabel}
            variant="solid"
            onClick={() => setValue(!checked)}
          />
        </span>
      );
    }
    case "select": {
      const opts = (itemSchema as SelectNode).enumOptions ?? [];
      return (
        <select
          aria-label={ariaLabel}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(e.target.value)}
          className={LIST_INPUT_CLASS}
        >
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value}
            </option>
          ))}
        </select>
      );
    }
    default:
      return null;
  }
}

export function PrimitiveListControl({
  node,
  itemSchema,
  path,
  value,
  onChange,
}: PrimitiveListControlProps) {
  const items = value ?? [];
  const isNull = node.nullable === true && value === null;
  const { state } = useConfigurationBuilder();
  const error = state.validationErrors[path] ?? null;
  const { constraints } = node;
  const canRemove = !constraints?.minItems || items.length > constraints.minItems;
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const handleRef = useRef<FocusManagedInputListHandle>(null);

  const itemType = itemSchema.controlType as LeafItemControl;

  const handleAdd = () => {
    onChange(path, [...items, emptyValueFor(itemType)]);
    handleRef.current?.notifyAdded();
  };

  return (
    <ControlWrapper
      node={node}
      isNull={isNull}
      error={error}
      onClear={() => onChange(path, null)}
      hideLabel
    >
      <FieldSection node={node} level="field" value={items} asGroup={false}>
        <FieldSection.Header>
          <FieldSection.Label />
          <FieldSection.Stability />
          <FieldSection.Info />
          <FieldSection.Action>
            <button
              ref={addButtonRef}
              type="button"
              onClick={handleAdd}
              aria-label={`Add item to ${node.label}`}
              className="border-border/60 bg-background/80 hover:border-primary/40 text-foreground inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs transition-all"
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
            <FocusManagedInputList<ConfigValue>
              label={node.label}
              items={items}
              canRemove={canRemove}
              onChange={(next) => onChange(path, next)}
              addButtonRef={addButtonRef}
              handleRef={handleRef}
              renderInput={({ value, setValue, ariaLabel }) => (
                <PrimitiveItemInput
                  itemSchema={itemSchema}
                  value={value}
                  setValue={setValue}
                  ariaLabel={ariaLabel}
                />
              )}
            />
          )}
        </FieldSection.Body>
      </FieldSection>
    </ControlWrapper>
  );
}
