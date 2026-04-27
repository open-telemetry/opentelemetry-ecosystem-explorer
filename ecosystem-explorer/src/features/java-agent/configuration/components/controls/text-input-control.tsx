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
import type { TextInputNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { ControlWrapper } from "./control-wrapper";
import { INPUT_CLASS } from "./control-styles";

interface TextInputControlProps {
  node: TextInputNode;
  path: string;
  value: string | null;
  onChange: (path: string, value: string | null) => void;
}

export function TextInputControl({ node, path, value, onChange }: TextInputControlProps) {
  const id = useId();
  const descId = useId();
  const isNull = node.nullable === true && value === null;
  const { state, validateField } = useConfigurationBuilder();
  const error = state.validationErrors[path] ?? null;

  return (
    <ControlWrapper
      node={node}
      inputId={id}
      descriptionId={node.description ? descId : undefined}
      isNull={isNull}
      error={error}
      onClear={() => onChange(path, null)}
    >
      <input
        id={id}
        type="text"
        value={value ?? ""}
        placeholder={node.defaultBehavior ?? ""}
        aria-describedby={node.description ? descId : undefined}
        aria-required={node.required || undefined}
        onChange={(e) => onChange(path, e.target.value)}
        onBlur={() => validateField(path)}
        className={INPUT_CLASS}
      />
    </ControlWrapper>
  );
}
