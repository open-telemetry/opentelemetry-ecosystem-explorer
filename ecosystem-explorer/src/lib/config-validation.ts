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
import type {
  ConfigNode,
  GroupNode,
  NumberInputNode,
  SelectNode,
  ListNode,
} from "@/types/configuration";
import type { ConfigValue, ConfigValues, ValidationResult } from "@/types/configuration-builder";

export function validateField(node: ConfigNode, value: ConfigValue | undefined): string | null {
  if (node.required && (value === undefined || value === null || value === "")) {
    return "Required";
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (node.controlType === "number_input") {
    const constraints = (node as NumberInputNode).constraints;
    if (constraints && typeof value === "number") {
      if (constraints.minimum !== undefined && value < constraints.minimum) {
        return `Must be at least ${constraints.minimum}`;
      }
      if (constraints.maximum !== undefined && value > constraints.maximum) {
        return `Must be at most ${constraints.maximum}`;
      }
      if (constraints.exclusiveMinimum !== undefined && value <= constraints.exclusiveMinimum) {
        return `Must be greater than ${constraints.exclusiveMinimum}`;
      }
      if (constraints.exclusiveMaximum !== undefined && value >= constraints.exclusiveMaximum) {
        return `Must be less than ${constraints.exclusiveMaximum}`;
      }
    }
  }

  if (node.controlType === "select") {
    const options = (node as SelectNode).enumOptions;
    if (options && typeof value === "string") {
      const validValues = options.map((o) => o.value);
      if (!validValues.includes(value)) {
        return `Must be one of: ${validValues.join(", ")}`;
      }
    }
  }

  if (
    node.controlType === "list" ||
    node.controlType === "string_list" ||
    node.controlType === "number_list"
  ) {
    if (Array.isArray(value)) {
      const constraints = (node as ListNode).constraints;
      if (constraints?.minItems !== undefined && value.length < constraints.minItems) {
        return `Must have at least ${constraints.minItems} items`;
      }
      if (constraints?.maxItems !== undefined && value.length > constraints.maxItems) {
        return `Must have at most ${constraints.maxItems} items`;
      }
    }
  }

  return null;
}

export function validateAll(
  schema: ConfigNode,
  values: ConfigValues,
  enabledSections: Record<string, boolean>
): ValidationResult {
  const errors: Record<string, string> = {};

  function walk(node: ConfigNode, nodeValues: ConfigValues | undefined, currentPath: string) {
    if (node.controlType === "circular_ref" || node.controlType === "union") return;

    if (node.controlType === "group") {
      const group = node as GroupNode;
      for (const child of group.children) {
        const childPath = currentPath === "" ? child.key : `${currentPath}.${child.key}`;

        if (currentPath === "" && child.controlType === "group") {
          if (enabledSections[child.key] === true) {
            walk(child, nodeValues?.[child.key] as ConfigValues | undefined, childPath);
          }
          continue;
        }

        if (child.controlType === "group" || child.controlType === "list") {
          walk(child, nodeValues?.[child.key] as ConfigValues | undefined, childPath);
          continue;
        }

        const value = nodeValues?.[child.key];
        const error = validateField(child, value as ConfigValue | undefined);
        if (error) {
          errors[childPath] = error;
        }
      }
      return;
    }

    const error = validateField(node, nodeValues as ConfigValue | undefined);
    if (error) {
      errors[currentPath] = error;
    }
  }

  walk(schema, values, "");
  return { valid: Object.keys(errors).length === 0, errors };
}
