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
import { Fragment, type ComponentType } from "react";
import { ArrowLeftRight, Equal, ListOrdered } from "lucide-react";
import type { Constraints } from "@/types/configuration";

interface FieldMetaNode {
  defaultBehavior?: string;
  constraints?: Constraints;
}

interface FieldMetaProps {
  node: FieldMetaNode;
}

interface MetaItem {
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  text: string;
}

function rangeItem(constraints: Constraints): MetaItem | null {
  const hasMin = constraints.minimum !== undefined;
  const hasMax = constraints.maximum !== undefined;
  const hasExMin = constraints.exclusiveMinimum !== undefined;
  const hasExMax = constraints.exclusiveMaximum !== undefined;

  if (hasMin && hasMax) {
    return { Icon: ArrowLeftRight, text: `${constraints.minimum}–${constraints.maximum}` };
  }
  if (!hasMin && !hasMax && hasExMin && hasExMax) {
    return {
      Icon: ArrowLeftRight,
      text: `> ${constraints.exclusiveMinimum} & < ${constraints.exclusiveMaximum}`,
    };
  }
  if (hasMin) {
    return { Icon: ArrowLeftRight, text: `≥ ${constraints.minimum}` };
  }
  if (hasExMin) {
    return { Icon: ArrowLeftRight, text: `> ${constraints.exclusiveMinimum}` };
  }
  if (hasMax) {
    return { Icon: ArrowLeftRight, text: `≤ ${constraints.maximum}` };
  }
  if (hasExMax) {
    return { Icon: ArrowLeftRight, text: `< ${constraints.exclusiveMaximum}` };
  }
  return null;
}

function itemsItem(constraints: Constraints): MetaItem | null {
  const hasMin = constraints.minItems !== undefined;
  const hasMax = constraints.maxItems !== undefined;
  if (hasMin && hasMax) {
    return { Icon: ListOrdered, text: `${constraints.minItems}–${constraints.maxItems} items` };
  }
  if (hasMin) {
    const unit = constraints.minItems === 1 ? "item" : "items";
    return { Icon: ListOrdered, text: `≥ ${constraints.minItems} ${unit}` };
  }
  if (hasMax) {
    return { Icon: ListOrdered, text: `≤ ${constraints.maxItems} items` };
  }
  return null;
}

function defaultItem(node: FieldMetaNode): MetaItem | null {
  if (node.defaultBehavior === undefined) return null;
  return { Icon: Equal, text: node.defaultBehavior };
}

export function FieldMeta({ node }: FieldMetaProps) {
  const items: MetaItem[] = [];
  if (node.constraints) {
    const r = rangeItem(node.constraints);
    if (r) items.push(r);
    const i = itemsItem(node.constraints);
    if (i) items.push(i);
  }
  const d = defaultItem(node);
  if (d) items.push(d);

  if (items.length === 0) return null;

  return (
    <div className="text-muted-foreground flex items-center gap-2 text-xs">
      {items.map((item, i) => {
        const { Icon } = item;
        return (
          <Fragment key={i}>
            {i > 0 && <span aria-hidden="true">·</span>}
            <span className="flex items-center gap-1">
              <Icon className="text-primary h-3 w-3" aria-hidden={true} />
              {item.text}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
