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
import type { FlagNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { SwitchPill } from "@/components/ui/switch-pill";
import { ControlWrapper } from "./control-wrapper";

type FlagValue = Record<string, never> | null;

interface FlagControlProps {
  node: FlagNode;
  path: string;
  value: FlagValue;
  onChange: (path: string, value: FlagValue) => void;
}

export function FlagControl({ node, path, value, onChange }: FlagControlProps) {
  const isOn = value !== null;
  const { state } = useConfigurationBuilder();
  const error = state.validationErrors[path] ?? null;

  return (
    <ControlWrapper node={node} error={error} inlineControl>
      <SwitchPill
        checked={isOn}
        ariaLabel={node.label}
        onClick={() => onChange(path, isOn ? null : {})}
      />
    </ControlWrapper>
  );
}
