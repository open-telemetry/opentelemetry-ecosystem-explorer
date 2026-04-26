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
import type { ToggleNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { SwitchPill } from "@/components/ui/switch-pill";
import { parseBooleanDefault } from "@/lib/parse-default-behavior";
import { ControlWrapper } from "./control-wrapper";

interface ToggleControlProps {
  node: ToggleNode;
  path: string;
  value: boolean | null;
  onChange: (path: string, value: boolean | null) => void;
}

export function ToggleControl({ node, path, value, onChange }: ToggleControlProps) {
  const isNull = node.nullable === true && value === null;
  const defaultBool = parseBooleanDefault(node.defaultBehavior);
  // The switch position is always the *resolved* value: the user's explicit
  // choice when set, the schema's inferred default when null, or `false` as a
  // last-resort fallback when the default text is unparseable.
  const resolved = value ?? defaultBool ?? false;
  const { state } = useConfigurationBuilder();
  const error = state.validationErrors[path] ?? null;

  return (
    <ControlWrapper
      node={node}
      isNull={isNull}
      error={error}
      onClear={() => onChange(path, null)}
      inlineControl
      defaultPreview={{
        value: defaultBool,
        description: node.defaultBehavior ?? "Using default",
      }}
    >
      <SwitchPill
        checked={resolved}
        ariaLabel={node.label}
        ariaRequired={node.required}
        variant={isNull ? "dashed" : "solid"}
        onClick={() => onChange(path, !resolved)}
      />
    </ControlWrapper>
  );
}
