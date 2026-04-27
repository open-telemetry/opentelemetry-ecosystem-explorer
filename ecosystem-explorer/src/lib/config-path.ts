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
import type { Path, ConfigValue, ConfigValues } from "@/types/configuration-builder";
import { isPlainObject } from "./value-guards";

export function parsePath(dotted: string): Path {
  const segments: Path = [];
  const parts = dotted.split(".");
  for (const part of parts) {
    const bracketMatch = part.match(/^([^[]+)\[(\d+)\]$/);
    if (bracketMatch) {
      segments.push(bracketMatch[1]);
      segments.push(Number(bracketMatch[2]));
    } else {
      segments.push(part);
    }
  }
  return segments;
}

export function serializePath(path: Path): string {
  let result = "";
  for (const segment of path) {
    if (typeof segment === "number") {
      result += `[${segment}]`;
    } else {
      result += result.length > 0 ? `.${segment}` : segment;
    }
  }
  return result;
}

export function getByPath(obj: ConfigValues, path: Path): ConfigValue | undefined {
  let current: ConfigValue = obj;
  for (const segment of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof segment === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[segment];
    } else {
      if (typeof current !== "object" || Array.isArray(current)) return undefined;
      current = (current as ConfigValues)[segment];
    }
  }
  return current;
}

export function setByPath(obj: ConfigValues, path: Path, value: ConfigValue): ConfigValues {
  if (path.length === 0) return obj;
  return setByPathRecursive(obj, path, 0, value) as ConfigValues;
}

function setByPathRecursive(
  current: ConfigValue,
  path: Path,
  index: number,
  value: ConfigValue
): ConfigValue {
  const segment = path[index];

  if (index === path.length - 1) {
    if (typeof segment === "number") {
      const arr = Array.isArray(current) ? [...current] : [];
      arr[segment] = value;
      return arr;
    }
    return { ...(current as ConfigValues), [segment]: value };
  }

  if (typeof segment === "number") {
    const arr = Array.isArray(current) ? [...current] : [];
    arr[segment] = setByPathRecursive(arr[segment] ?? {}, path, index + 1, value);
    return arr;
  }

  const obj: ConfigValues = isPlainObject(current) ? { ...current } : {};
  obj[segment] = setByPathRecursive(
    (current as ConfigValues)?.[segment] ?? {},
    path,
    index + 1,
    value
  );
  return obj;
}
