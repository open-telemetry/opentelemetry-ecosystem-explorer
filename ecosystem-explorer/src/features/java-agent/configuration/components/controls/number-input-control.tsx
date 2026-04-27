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
import { useId, useState } from "react";
import type { NumberInputNode } from "@/types/configuration";
import { useConfigurationBuilder } from "@/hooks/use-configuration-builder";
import { ControlWrapper } from "./control-wrapper";
import { INPUT_CLASS } from "./control-styles";

interface NumberInputControlProps {
  node: NumberInputNode;
  path: string;
  value: number | null;
  onChange: (path: string, value: number | null) => void;
}

function formatValue(value: number | null): string {
  return value === null ? "" : String(value);
}

/**
 * True when `draft` is a valid alternative spelling of `value` that we
 * shouldn't clobber on a self-induced re-render — e.g. draft `"1.2e3"`
 * after we just emitted `1200`. Partial / invalid inputs (NaN) were never
 * emitted in the first place, so `value` cannot have come from us; falling
 * through to a resync on external value change is the desired behavior.
 */
function draftRepresentsValue(draft: string, value: number | null): boolean {
  if (value === null) return draft === "";
  if (draft === "") return false;
  return parseFloat(draft) === value;
}

export function NumberInputControl({ node, path, value, onChange }: NumberInputControlProps) {
  const id = useId();
  const descId = useId();
  const isNull = node.nullable === true && value === null;
  const { state, validateField } = useConfigurationBuilder();
  const error = state.validationErrors[path] ?? null;
  const { constraints } = node;
  const min = constraints?.minimum ?? constraints?.exclusiveMinimum;
  const max = constraints?.maximum ?? constraints?.exclusiveMaximum;

  const [draft, setDraft] = useState<string>(() => formatValue(value));
  const [prevValue, setPrevValue] = useState<number | null>(value);

  // Sync the draft when the external value actually changes (Reset,
  // loadFromYaml, sibling control), but leave the in-flight draft alone if
  // it already parses back to the same number — preserves notations like
  // "1.2e3" after we emitted 1200.
  if (prevValue !== value) {
    setPrevValue(value);
    if (!draftRepresentsValue(draft, value)) {
      setDraft(formatValue(value));
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDraft(raw);
    if (raw === "") return;
    const num = parseFloat(raw);
    if (Number.isFinite(num)) onChange(path, num);
  };

  const handleBlur = () => {
    if (draft === "" && value !== null) setDraft(String(value));
    validateField(path);
  };

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
        type="number"
        value={draft}
        min={min}
        max={max}
        placeholder={node.defaultBehavior ?? ""}
        aria-describedby={node.description ? descId : undefined}
        aria-required={node.required || undefined}
        onChange={handleChange}
        onBlur={handleBlur}
        className={INPUT_CLASS}
      />
    </ControlWrapper>
  );
}
