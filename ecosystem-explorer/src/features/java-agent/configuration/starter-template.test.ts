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
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ConfigNode,
  GroupNode,
  ListNode,
  PluginSelectNode,
  ConfigStarter,
} from "@/types/configuration";
import type { ConfigValue, ConfigValues } from "@/types/configuration-builder";
import { findNodeByPath } from "@/lib/schema-defaults";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJson<T>(relPath: string): T {
  const abs = resolve(__dirname, "../../../../public/data/configuration", relPath);
  return JSON.parse(readFileSync(abs, "utf-8")) as T;
}

function walk(
  value: ConfigValue,
  pathSegments: (string | number)[],
  schema: ConfigNode,
  errors: string[]
): void {
  const currentSchemaNode = findNodeByPath(schema, pathSegments);
  if (
    Array.isArray(value) &&
    currentSchemaNode?.controlType === "list" &&
    (currentSchemaNode as ListNode).itemSchema.controlType === "plugin_select"
  ) {
    const pluginSchema = (currentSchemaNode as ListNode).itemSchema as PluginSelectNode;
    const validKeys = new Set(pluginSchema.options.map((o) => o.key));
    value.forEach((item, i) => {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        errors.push(
          `list item is not an object at ${[...pathSegments, i].join(".")} (itemSchema is plugin_select, expected single-key object)`
        );
        return;
      }
      const keys = Object.keys(item as ConfigValues);
      if (keys.length !== 1) {
        errors.push(
          `plugin_select list item must have exactly one key at ${[...pathSegments, i].join(".")} (got ${keys.length})`
        );
        return;
      }
      if (!pluginSchema.allowCustom && !validKeys.has(keys[0])) {
        errors.push(`unknown plugin key "${keys[0]}" at ${[...pathSegments, i].join(".")}`);
      }
    });
  }

  if (value === null || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, [...pathSegments, i], schema, errors));
    return;
  }
  for (const [k, v] of Object.entries(value as ConfigValues)) {
    const segs = [...pathSegments, k];
    const resolved = findNodeByPath(schema, segs);
    if (!resolved) {
      errors.push(`path not resolvable in schema: ${segs.join(".")}`);
      continue;
    }
    walk(v, segs, schema, errors);
  }
}

describe("sdk-configuration-defaults-1.0.0.json shape", () => {
  const schema = loadJson<ConfigNode>("versions/1.0.0.json");
  const starter = loadJson<ConfigStarter>("defaults/sdk-configuration-defaults-1.0.0.json");

  it("every enabledSections key is a top-level group in the schema", () => {
    expect(schema.controlType).toBe("group");
    const topKeys = (schema as GroupNode).children.reduce<Record<string, string>>((acc, c) => {
      acc[c.key] = c.controlType;
      return acc;
    }, {});
    for (const [key, on] of Object.entries(starter.enabledSections)) {
      expect(on).toBe(true);
      expect(topKeys[key]).toBe("group");
    }
  });

  it("every values path resolves in the schema and list items match their itemSchema", () => {
    const errors: string[] = [];
    walk(starter.values, [], schema, errors);
    expect(errors).toEqual([]);
  });
});
