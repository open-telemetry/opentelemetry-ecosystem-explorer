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
import { useId } from "react";
import type { SelectNode } from "@/types/configuration";
import { ControlWrapper } from "./control-wrapper";

interface SelectControlProps {
  node: SelectNode;
  value: string | null;
  onChange: (path: string, value: string | null) => void;
}

const SELECT_CLASS =
  "w-full rounded-lg border border-border/60 bg-background/80 px-4 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20";

export function SelectControl({ node, value, onChange }: SelectControlProps) {
  const id = useId();
  const descId = useId();

  return (
    <ControlWrapper node={node} inputId={id} descriptionId={node.description ? descId : undefined}>
      <select
        id={id}
        value={value ?? ""}
        aria-describedby={node.description ? descId : undefined}
        aria-required={node.required || undefined}
        onChange={(e) => onChange(node.path, e.target.value === "" ? null : e.target.value)}
        className={SELECT_CLASS}
      >
        {node.nullable && (
          <option value="">{node.nullBehavior ?? node.defaultBehavior ?? "Default"}</option>
        )}
        {node.enumOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.value}
          </option>
        ))}
      </select>
    </ControlWrapper>
  );
}
