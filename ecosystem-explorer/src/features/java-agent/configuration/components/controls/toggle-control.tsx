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
import { ControlWrapper } from "./control-wrapper";

interface ToggleControlProps {
  node: ToggleNode;
  value: boolean | null;
  onChange: (path: string, value: boolean | null) => void;
}

export function ToggleControl({ node, value, onChange }: ToggleControlProps) {
  const isNull = node.nullable === true && value === null;
  const isEnabled = value ?? false;

  return (
    <ControlWrapper
      node={node}
      isNull={isNull}
      onClear={() => onChange(node.path, null)}
      onActivate={() => onChange(node.path, false)}
    >
      <button
        type="button"
        role="switch"
        aria-checked={isEnabled}
        aria-label={node.label}
        aria-required={node.required || undefined}
        onClick={() => onChange(node.path, !isEnabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background ${
          isEnabled ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
            isEnabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </ControlWrapper>
  );
}
