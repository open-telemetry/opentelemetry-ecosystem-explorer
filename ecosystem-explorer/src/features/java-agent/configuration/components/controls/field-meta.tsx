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
import type { Constraints } from "@/types/configuration";

interface FieldMetaNode {
  defaultBehavior?: string;
  constraints?: Constraints;
}

interface FieldMetaProps {
  node: FieldMetaNode;
}

function rangeChip(constraints: Constraints): string | null {
  const hasMin = constraints.minimum !== undefined;
  const hasMax = constraints.maximum !== undefined;
  const hasExMin = constraints.exclusiveMinimum !== undefined;
  const hasExMax = constraints.exclusiveMaximum !== undefined;

  if (hasMin && hasMax) return `${constraints.minimum}–${constraints.maximum}`;
  if (!hasMin && !hasMax && hasExMin && hasExMax) {
    return `> ${constraints.exclusiveMinimum} & < ${constraints.exclusiveMaximum}`;
  }
  if (hasMin) return `≥ ${constraints.minimum}`;
  if (hasExMin) return `> ${constraints.exclusiveMinimum}`;
  if (hasMax) return `≤ ${constraints.maximum}`;
  if (hasExMax) return `< ${constraints.exclusiveMaximum}`;
  return null;
}

function itemsChip(constraints: Constraints): string | null {
  const hasMin = constraints.minItems !== undefined;
  const hasMax = constraints.maxItems !== undefined;
  if (hasMin && hasMax) return `${constraints.minItems}–${constraints.maxItems} items`;
  if (hasMin) {
    const unit = constraints.minItems === 1 ? "item" : "items";
    return `≥ ${constraints.minItems} ${unit}`;
  }
  if (hasMax) return `≤ ${constraints.maxItems} items`;
  return null;
}

export function FieldMeta({ node }: FieldMetaProps) {
  const chips: string[] = [];
  if (node.constraints) {
    const r = rangeChip(node.constraints);
    if (r) chips.push(r);
    const i = itemsChip(node.constraints);
    if (i) chips.push(i);
  }
  const hasDefault = node.defaultBehavior !== undefined;

  if (chips.length === 0 && !hasDefault) return null;

  return (
    <div className="text-muted-foreground space-y-1 text-xs">
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {chips.map((text, i) => (
            <span key={i} className="whitespace-nowrap">
              {text}
            </span>
          ))}
        </div>
      )}
      {hasDefault && (
        <p>
          <span className="text-foreground/70 font-medium">Default:</span> {node.defaultBehavior}
        </p>
      )}
    </div>
  );
}
