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

  function walk(node: ConfigNode, currentValues: ConfigValues | undefined, pathPrefix: string) {
    if (node.controlType === "circular_ref" || node.controlType === "union") return;

    if (node.controlType === "group") {
      const group = node as GroupNode;
      const groupValues = pathPrefix
        ? (currentValues?.[node.key] as ConfigValues | undefined)
        : currentValues;

      for (const child of group.children) {
        const childPath = pathPrefix ? `${pathPrefix}.${child.key}` : child.key;

        if (!pathPrefix && child.controlType === "group") {
          if (enabledSections[child.key] === true) {
            walk(child, currentValues, child.key);
          }
          continue;
        }

        if (child.controlType === "group" || child.controlType === "list") {
          walk(child, groupValues ?? {}, pathPrefix ? pathPrefix : node.key);
          continue;
        }

        const value = groupValues?.[child.key];
        const error = validateField(child, value as ConfigValue | undefined);
        if (error) {
          errors[childPath] = error;
        }
      }
      return;
    }

    const fullPath = pathPrefix ? `${pathPrefix}.${node.key}` : node.key;
    const value = currentValues?.[node.key];
    const error = validateField(node, value as ConfigValue | undefined);
    if (error) {
      errors[fullPath] = error;
    }
  }

  walk(schema, values, "");
  return { valid: Object.keys(errors).length === 0, errors };
}
