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
import type { ConfigValue, ConfigValues } from "@/types/configuration-builder";
import { isPlainObject } from "./value-guards";

let counter = 0;

/**
 * Mints a fresh list-item id. Used by the reducer when appending to a list
 * or when seeding ids for a freshly loaded values tree.
 */
export function generateListItemId(): string {
  counter += 1;
  return `li-${counter}`;
}

/**
 * Walks a values tree and produces a `path -> ids[]` map covering every
 * array encountered. Called by the reducer for `LOAD_STATE` so reloaded
 * documents start with stable, position-independent React keys.
 */
export function buildListItemIds(values: ConfigValues): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  walk(values, "", out);
  return out;
}

function walk(value: ConfigValue | undefined, parentPath: string, out: Record<string, string[]>) {
  if (Array.isArray(value)) {
    out[parentPath] = value.map(() => generateListItemId());
    value.forEach((item, i) => walk(item, `${parentPath}[${i}]`, out));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childPath = parentPath ? `${parentPath}.${key}` : key;
      walk(child, childPath, out);
    }
  }
}
