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
import type { Configuration } from "@/types/javaagent";
import type { ConfigValue, Path } from "@/types/configuration-builder";

export type DeclarativeScope = "general" | "common" | "owned";

const ROOT_SECTION = "instrumentation/development";

export function classifyScope(declarativeName: string): DeclarativeScope {
  if (declarativeName.startsWith("general.")) return "general";
  if (declarativeName.startsWith("java.common.")) return "common";
  return "owned";
}

export function toValuePath(declarativeName: string): Path {
  return [ROOT_SECTION, ...declarativeName.split(".")];
}

export function parseDefault(
  type: Configuration["type"],
  raw: string | boolean | number
): ConfigValue {
  switch (type) {
    case "boolean":
      return Boolean(raw);
    case "int":
    case "double":
      return Number(raw);
    case "string":
      return typeof raw === "string" ? raw : String(raw);
    case "list":
      if (typeof raw !== "string" || raw === "") return [];
      return raw.split(",").map((item) => item.trim());
    case "map":
      if (typeof raw !== "string" || raw === "") return {};
      return Object.fromEntries(
        raw.split(",").flatMap((pair) => {
          const eq = pair.indexOf("=");
          if (eq === -1) return [];
          return [[pair.slice(0, eq).trim(), pair.slice(eq + 1).trim()]];
        })
      );
  }
}
