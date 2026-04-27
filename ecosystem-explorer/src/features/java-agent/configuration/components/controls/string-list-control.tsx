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
import type { StringListNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { ControlWrapper } from "./control-wrapper";
import { LIST_INPUT_CLASS } from "./control-styles";
import { FocusManagedInputList } from "./focus-managed-input-list";

interface StringListControlProps {
  node: StringListNode;
  path: string;
  value: string[] | null;
  onChange: (path: string, value: string[] | null) => void;
}

export function StringListControl({ node, path, value, onChange }: StringListControlProps) {
  const items = value ?? [];
  const isNull = node.nullable === true && value === null;
  const { state } = useConfigurationBuilder();
  const error = state.validationErrors[path] ?? null;
  const { constraints } = node;
  const canAdd = !constraints?.maxItems || items.length < constraints.maxItems;
  const canRemove = !constraints?.minItems || items.length > constraints.minItems;

  return (
    <ControlWrapper node={node} isNull={isNull} error={error} onClear={() => onChange(path, null)}>
      <FocusManagedInputList<string>
        label={node.label}
        items={items}
        canAdd={canAdd}
        canRemove={canRemove}
        makeEmpty={() => ""}
        onChange={(next) => onChange(path, next)}
        renderInput={({ value, setValue, ariaLabel }) => (
          <input
            type="text"
            aria-label={ariaLabel}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={LIST_INPUT_CLASS}
          />
        )}
      />
    </ControlWrapper>
  );
}
