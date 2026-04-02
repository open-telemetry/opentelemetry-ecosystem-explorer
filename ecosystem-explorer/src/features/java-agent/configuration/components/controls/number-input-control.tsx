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
import type { ChangeEvent } from "react";
import { useId } from "react";
import type { NumberInputNode } from "@/types/configuration";
import { ControlWrapper } from "./control-wrapper";

interface NumberInputControlProps {
  node: NumberInputNode;
  value: number | null;
  onChange: (path: string, value: number | null) => void;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-border/60 bg-background/80 px-4 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20";

export function NumberInputControl({ node, value, onChange }: NumberInputControlProps) {
  const id = useId();
  const descId = useId();
  const isNull = node.nullable === true && value === null;
  const { constraints } = node;
  const hasExclusiveMin =
    constraints?.exclusiveMinimum !== undefined && constraints?.minimum === undefined;
  const hasExclusiveMax =
    constraints?.exclusiveMaximum !== undefined && constraints?.maximum === undefined;
  const min = constraints?.minimum ?? constraints?.exclusiveMinimum;
  const max = constraints?.maximum ?? constraints?.exclusiveMaximum;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange(node.path, 0);
      return;
    }
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      onChange(node.path, num);
    }
  };

  return (
    <ControlWrapper
      node={node}
      inputId={id}
      descriptionId={node.description ? descId : undefined}
      isNull={isNull}
      onClear={() => onChange(node.path, null)}
      onActivate={() => onChange(node.path, 0)}
    >
      <div className="space-y-1">
        <input
          id={id}
          type="number"
          value={value ?? ""}
          min={min}
          max={max}
          placeholder={node.defaultBehavior ?? ""}
          aria-describedby={node.description ? descId : undefined}
          aria-required={node.required || undefined}
          onChange={handleChange}
          className={INPUT_CLASS}
        />
        {(min !== undefined || max !== undefined) && (
          <p className="text-xs text-muted-foreground/70">
            {min !== undefined && max !== undefined
              ? `Range: ${hasExclusiveMin ? ">" : ""}${min}–${hasExclusiveMax ? "<" : ""}${max}`
              : min !== undefined
                ? hasExclusiveMin
                  ? `Greater than ${min}`
                  : `Minimum: ${min}`
                : hasExclusiveMax
                  ? `Less than ${max}`
                  : `Maximum: ${max}`}
          </p>
        )}
      </div>
    </ControlWrapper>
  );
}
