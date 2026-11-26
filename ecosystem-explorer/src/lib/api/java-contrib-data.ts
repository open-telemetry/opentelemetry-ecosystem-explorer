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
import { load as loadYaml, CORE_SCHEMA } from "js-yaml";
import { resolveDataPath } from "./fetch-with-cache";
import {
  COMPONENT_TYPES,
  CONFIGURATION_METHOD_TYPES,
  CONTRIB_STABILITIES,
  DISTRIBUTIONS,
  EXAMPLE_LANGUAGES,
  SETTING_TYPES,
  type ComponentType,
  type ContribComponent,
  type ContribConfiguration,
  type ContribDistribution,
  type ContribEntry,
  type ContribIndex,
  type ContribSetting,
  type SettingDefault,
} from "@/types/java-contrib";

/*
 * Hand-maintained prototype data for the java-contrib `metadata.yaml` pilot. It lives outside
 * `data/javaagent/` because the explorer-db-builder rmtree's that directory on `--clean` (#882).
 * Files are raw YAML parsed in the browser and not cached in IndexedDB, so edits show up on reload.
 */
const BASE_DIR = "data/java-contrib";

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// One or more dot-separated keys, each optionally followed by `[]`; keys cannot contain `.[]`.
const LOCATION_PATTERN = /^[^.[\]]+(?:\[\])?(?:\.[^.[\]]+(?:\[\])?)*$/;

const TOP_LEVEL_FIELDS = [
  "name",
  "display_name",
  "description",
  "source_path",
  "component_types",
  "docs_url",
  "usage",
  "status",
  "artifact",
  "min_java_version",
  "distributions",
  "configurations",
];
const METHOD_FIELDS = [
  "type",
  "display_name",
  "description",
  "example",
  "settings",
  "component_key",
  "location",
];
const SETTING_FIELDS = ["name", "type", "default", "description", "allowed_values", "unit"];

type Raw = Record<string, unknown>;

function isMapping(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

/** Flags keys outside the allowed set, which also catches renamed fields such as `component_type`. */
function rejectUnknown(obj: Raw, allowed: string[], path: string, problems: string[]): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      problems.push(`${path}${key}: unknown field`);
    }
  }
}

/** Reads a required nonempty string, recording a problem and returning "" when invalid. */
function requireString(obj: Raw, key: string, path: string, problems: string[]): string {
  const value = obj[key];
  if (value === undefined) {
    problems.push(`${path}${key}: required field is missing`);
    return "";
  }
  if (!isNonEmptyString(value)) {
    problems.push(`${path}${key}: must be a nonempty string`);
    return typeof value === "string" ? value : "";
  }
  return value;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isStringMap(value: unknown): value is Record<string, string> {
  return (
    isMapping(value) &&
    Object.entries(value).every(([k, v]) => isNonEmptyString(k) && isNonEmptyString(v))
  );
}

function defaultMatchesType(type: ContribSetting["type"], value: unknown): boolean {
  switch (type) {
    case "string":
    case "duration":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "int":
      return typeof value === "number" && Number.isInteger(value);
    case "double":
      return typeof value === "number" && Number.isFinite(value);
    case "list":
      return isStringList(value);
    case "map":
      return isStringMap(value);
  }
}

function validateSetting(raw: unknown, path: string, problems: string[]): ContribSetting | null {
  if (!isMapping(raw)) {
    problems.push(`${path}: must be a mapping`);
    return null;
  }
  rejectUnknown(raw, SETTING_FIELDS, path, problems);
  const name = requireString(raw, "name", path, problems);
  const description = requireString(raw, "description", path, problems);

  let type: ContribSetting["type"] = "string";
  if (includes(SETTING_TYPES, raw.type)) {
    type = raw.type;
  } else {
    problems.push(`${path}type: must be one of ${SETTING_TYPES.join(", ")}`);
  }

  let defaultValue: SettingDefault = null;
  if (!("default" in raw)) {
    problems.push(`${path}default: required field is missing (use null for no value)`);
  } else if (raw.default === null) {
    defaultValue = null;
  } else if (!defaultMatchesType(type, raw.default)) {
    problems.push(`${path}default: ${JSON.stringify(raw.default)} does not match type "${type}"`);
    defaultValue = JSON.stringify(raw.default);
  } else {
    defaultValue = raw.default as SettingDefault;
  }

  const setting: ContribSetting = { name, type, default: defaultValue, description };

  if (raw.allowed_values !== undefined) {
    if (type !== "string") {
      problems.push(`${path}allowed_values: only allowed on string settings`);
    } else if (!isStringList(raw.allowed_values) || raw.allowed_values.length === 0) {
      problems.push(`${path}allowed_values: must be a nonempty list of nonempty strings`);
    } else if (new Set(raw.allowed_values).size !== raw.allowed_values.length) {
      problems.push(`${path}allowed_values: values must be distinct`);
    } else {
      setting.allowed_values = raw.allowed_values;
      if (typeof defaultValue === "string" && !raw.allowed_values.includes(defaultValue)) {
        problems.push(`${path}default: "${defaultValue}" is not one of allowed_values`);
      }
    }
  }

  if (raw.unit !== undefined) {
    if (type !== "int" && type !== "double") {
      problems.push(`${path}unit: only allowed on int and double settings`);
    } else if (!isNonEmptyString(raw.unit)) {
      problems.push(`${path}unit: must be a nonempty string`);
    } else {
      setting.unit = raw.unit;
    }
  }

  return setting;
}

/**
 * Walks a location such as `tracer_provider.processors[]` through a parsed example and returns
 * every node it reaches. `[]` fans out to each sequence element, so any element may match.
 */
function resolveLocation(root: unknown, location: string): unknown[] {
  let nodes: unknown[] = [root];
  for (const segment of location.split(".")) {
    const isSequence = segment.endsWith("[]");
    const key = isSequence ? segment.slice(0, -2) : segment;
    const next: unknown[] = [];
    for (const node of nodes) {
      if (!isMapping(node) || !(key in node)) continue;
      const value = node[key];
      if (isSequence) {
        if (Array.isArray(value)) next.push(...(value as unknown[]));
      } else {
        next.push(value);
      }
    }
    nodes = next;
  }
  return nodes;
}

/** Checks that the declarative example contains the declared placement and only listed settings. */
function checkPlacement(config: ContribConfiguration, path: string, problems: string[]): void {
  const { component_key, location, example, settings } = config;
  if (!component_key || !location || example.language !== "yaml" || !example.code) return;

  let parsed: unknown;
  try {
    parsed = loadYaml(example.code, { schema: CORE_SCHEMA });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    problems.push(`${path}example.code: YAML parse error: ${message}`);
    return;
  }

  const holders = resolveLocation(parsed, location).filter(
    (node): node is Raw => isMapping(node) && component_key in node
  );
  if (holders.length === 0) {
    problems.push(`${path}example.code: does not contain "${component_key}" at "${location}"`);
    return;
  }

  const known = new Set(settings.map((s) => s.name));
  for (const holder of holders) {
    const mapping = holder[component_key];
    if (mapping === null) continue; // A component with no settings configured.
    if (!isMapping(mapping)) {
      problems.push(`${path}example.code: "${component_key}" must map to a mapping or null`);
      continue;
    }
    for (const key of Object.keys(mapping)) {
      if (!known.has(key)) {
        problems.push(`${path}example.code: "${key}" is not a listed setting of this method`);
      }
    }
  }
}

function validateConfiguration(
  raw: unknown,
  path: string,
  problems: string[]
): ContribConfiguration | null {
  if (!isMapping(raw)) {
    problems.push(`${path}: must be a mapping`);
    return null;
  }
  rejectUnknown(raw, METHOD_FIELDS, path, problems);

  let type: ContribConfiguration["type"] = "sdk-autoconfiguration";
  if (includes(CONFIGURATION_METHOD_TYPES, raw.type)) {
    type = raw.type;
  } else {
    problems.push(`${path}type: must be one of ${CONFIGURATION_METHOD_TYPES.join(", ")}`);
  }

  const display_name = requireString(raw, "display_name", path, problems);
  const description = requireString(raw, "description", path, problems);

  const example: ContribConfiguration["example"] = { language: "yaml", code: "" };
  if (!isMapping(raw.example)) {
    problems.push(`${path}example: must be a mapping with language and code`);
  } else {
    rejectUnknown(raw.example, ["language", "code"], `${path}example.`, problems);
    if (includes(EXAMPLE_LANGUAGES, raw.example.language)) {
      example.language = raw.example.language;
    } else {
      problems.push(`${path}example.language: must be one of ${EXAMPLE_LANGUAGES.join(", ")}`);
    }
    example.code = requireString(raw.example, "code", `${path}example.`, problems);
    if (type === "declarative" && example.language !== "yaml") {
      problems.push(`${path}example.language: declarative examples must use yaml`);
    }
  }

  const settings: ContribSetting[] = [];
  if (!Array.isArray(raw.settings)) {
    problems.push(`${path}settings: must be a list (use [] when none apply)`);
  } else {
    const seen = new Set<string>();
    raw.settings.forEach((s, i) => {
      const setting = validateSetting(s, `${path}settings[${i}].`, problems);
      if (!setting) return;
      if (setting.name && seen.has(setting.name)) {
        problems.push(`${path}settings[${i}].name: "${setting.name}" is not unique in this method`);
      }
      seen.add(setting.name);
      settings.push(setting);
    });
  }

  const config: ContribConfiguration = { type, display_name, description, example, settings };

  const hasKey = raw.component_key !== undefined;
  const hasLocation = raw.location !== undefined;
  if (hasKey || hasLocation) {
    if (type !== "declarative") {
      problems.push(`${path}: component_key and location are only allowed on declarative methods`);
    } else if (hasKey !== hasLocation) {
      problems.push(`${path}: component_key and location must be supplied together`);
    } else {
      const component_key = requireString(raw, "component_key", path, problems);
      const location = requireString(raw, "location", path, problems);
      if (location && !LOCATION_PATTERN.test(location)) {
        problems.push(`${path}location: "${location}" is not a valid path`);
      } else if (component_key && location) {
        config.component_key = component_key;
        config.location = location;
        checkPlacement(config, path, problems);
      }
    }
  }

  return config;
}

function validateDistribution(
  raw: unknown,
  path: string,
  problems: string[]
): ContribDistribution | null {
  if (!isMapping(raw)) {
    problems.push(`${path}: must be a mapping`);
    return null;
  }
  rejectUnknown(raw, ["name", "repository_url"], path, problems);
  const names = Object.keys(DISTRIBUTIONS) as (keyof typeof DISTRIBUTIONS)[];
  if (!includes(names, raw.name)) {
    problems.push(`${path}name: must be one of ${names.join(", ")}`);
    return null;
  }
  const repository_url = requireString(raw, "repository_url", path, problems);
  if (repository_url && repository_url !== DISTRIBUTIONS[raw.name]) {
    problems.push(`${path}repository_url: must be ${DISTRIBUTIONS[raw.name]} for "${raw.name}"`);
  }
  return { name: raw.name, repository_url: DISTRIBUTIONS[raw.name] };
}

/**
 * Checks a parsed `metadata.yaml` against the pilot schema and returns a normalized component that
 * is always safe to render (missing lists become [], missing strings become ""), together with
 * every rule violation found. Problems are collected rather than thrown so the prototype UI can
 * show exactly where a file deviates from the format. Rules that span files (name uniqueness,
 * `replaced_by` targets) are checked separately by `checkCrossReferences`.
 */
export function validateContribComponent(
  raw: unknown,
  id: string
): { component: ContribComponent; problems: string[] } {
  const problems: string[] = [];
  const obj: Raw = isMapping(raw) ? raw : {};
  if (!isMapping(raw)) {
    problems.push("document: must be a YAML mapping");
  } else {
    rejectUnknown(obj, TOP_LEVEL_FIELDS, "", problems);
  }

  const name = requireString(obj, "name", "", problems);
  if (name && !NAME_PATTERN.test(name)) {
    problems.push(`name: "${name}" must match ${NAME_PATTERN.source}`);
  } else if (name && name !== id) {
    problems.push(`name: "${name}" must match the file name "${id}.yaml"`);
  }

  const display_name = requireString(obj, "display_name", "", problems) || id;
  const description = requireString(obj, "description", "", problems);
  const usage = requireString(obj, "usage", "", problems);

  const source_path = requireString(obj, "source_path", "", problems);
  if (source_path && (source_path.startsWith("/") || source_path.endsWith("/"))) {
    problems.push("source_path: must not have a leading or trailing slash");
  }

  const docs_url = requireString(obj, "docs_url", "", problems);
  if (docs_url && !/^https:\/\/[^\s]+$/.test(docs_url)) {
    problems.push("docs_url: must be an absolute HTTPS URL");
  }

  const component_types: ComponentType[] = [];
  if (!Array.isArray(obj.component_types) || obj.component_types.length === 0) {
    problems.push("component_types: must be a nonempty list");
  } else {
    obj.component_types.forEach((value, i) => {
      if (!includes(COMPONENT_TYPES, value)) {
        problems.push(`component_types[${i}]: must be one of ${COMPONENT_TYPES.join(", ")}`);
      } else if (component_types.includes(value)) {
        problems.push(`component_types[${i}]: "${value}" is listed more than once`);
      } else {
        component_types.push(value);
      }
    });
  }

  const status: ContribComponent["status"] = { stability: "development" };
  if (!isMapping(obj.status)) {
    problems.push("status: must be a mapping with stability");
  } else {
    rejectUnknown(obj.status, ["stability", "replaced_by"], "status.", problems);
    if (includes(CONTRIB_STABILITIES, obj.status.stability)) {
      status.stability = obj.status.stability;
    } else {
      problems.push(`status.stability: must be one of ${CONTRIB_STABILITIES.join(", ")}`);
    }
    if (obj.status.replaced_by !== undefined) {
      const replacedBy = requireString(obj.status, "replaced_by", "status.", problems);
      if (status.stability !== "deprecated") {
        problems.push("status.replaced_by: only allowed when stability is deprecated");
      } else if (replacedBy && replacedBy === name) {
        problems.push("status.replaced_by: a component cannot replace itself");
      } else if (replacedBy) {
        status.replaced_by = replacedBy;
      }
    }
  }

  let artifact: ContribComponent["artifact"];
  if (obj.artifact !== undefined) {
    if (!isMapping(obj.artifact)) {
      problems.push("artifact: must be a mapping with group_id and artifact_id");
    } else {
      rejectUnknown(obj.artifact, ["group_id", "artifact_id"], "artifact.", problems);
      artifact = {
        group_id: requireString(obj.artifact, "group_id", "artifact.", problems),
        artifact_id: requireString(obj.artifact, "artifact_id", "artifact.", problems),
      };
    }
  }

  let min_java_version = 0;
  if (typeof obj.min_java_version === "number" && Number.isInteger(obj.min_java_version)) {
    min_java_version = obj.min_java_version;
  } else {
    problems.push("min_java_version: must be an integer");
  }

  const distributions: ContribDistribution[] = [];
  if (!Array.isArray(obj.distributions)) {
    problems.push("distributions: must be a list (use [] when none apply)");
  } else {
    obj.distributions.forEach((d, i) => {
      const dist = validateDistribution(d, `distributions[${i}].`, problems);
      if (!dist) return;
      if (distributions.some((existing) => existing.name === dist.name)) {
        problems.push(`distributions[${i}].name: "${dist.name}" is listed more than once`);
        return;
      }
      distributions.push(dist);
    });
  }

  const configurations: ContribConfiguration[] = [];
  if (!Array.isArray(obj.configurations)) {
    problems.push("configurations: must be a list (use [] when none apply)");
  } else {
    obj.configurations.forEach((c, i) => {
      const config = validateConfiguration(c, `configurations[${i}].`, problems);
      if (!config) return;
      if (configurations.some((existing) => existing.type === config.type)) {
        problems.push(`configurations[${i}].type: "${config.type}" is listed more than once`);
      }
      configurations.push(config);
    });
  }

  return {
    component: {
      name: name || id,
      display_name,
      description,
      source_path,
      component_types,
      docs_url,
      usage,
      status,
      ...(artifact ? { artifact } : {}),
      min_java_version,
      distributions,
      configurations,
    },
    problems,
  };
}

/** Parses YAML text into a validated entry. Parse errors become problems, never throws. */
export function parseContribYaml(text: string, id: string): ContribEntry {
  let raw: unknown;
  try {
    // CORE_SCHEMA keeps scalars to null/bool/int/float/str, so values like `5ms` stay strings.
    // js-yaml also rejects duplicate mapping keys here.
    raw = loadYaml(text, { schema: CORE_SCHEMA });
  } catch (err) {
    const { component } = validateContribComponent({}, id);
    const message = err instanceof Error ? err.message : String(err);
    return { id, component, problems: [`YAML parse error: ${message}`] };
  }
  return { id, ...validateContribComponent(raw, id) };
}

/** Adds problems for `replaced_by` targets that have no metadata in the index. */
export function checkCrossReferences(entry: ContribEntry, index: ContribIndex): ContribEntry {
  const target = entry.component.status.replaced_by;
  if (!target || index.components.includes(target)) return entry;
  return {
    ...entry,
    problems: [...entry.problems, `status.replaced_by: no component named "${target}" exists`],
  };
}

export async function loadContribIndex(): Promise<ContribIndex> {
  const response = await fetch(resolveDataPath(BASE_DIR, "index.json"));
  if (!response.ok) {
    throw new Error(`Failed to load contrib index: ${response.status} ${response.statusText}`);
  }
  const data: unknown = await response.json();
  if (
    !isMapping(data) ||
    !Array.isArray(data.components) ||
    !data.components.every((c) => typeof c === "string")
  ) {
    throw new Error("Invalid contrib index: expected { components: string[] }");
  }
  const components = data.components as string[];
  // Names are the file stems, so a duplicate index entry is the only way two can collide.
  const duplicate = components.find((c, i) => components.indexOf(c) !== i);
  if (duplicate) {
    throw new Error(`Invalid contrib index: "${duplicate}" is listed more than once`);
  }
  return { components };
}

async function fetchComponent(id: string, index: ContribIndex): Promise<ContribEntry> {
  const response = await fetch(resolveDataPath(BASE_DIR, "components", `${id}.yaml`));
  if (!response.ok) {
    throw new Error(`Failed to load contrib component ${id}: ${response.status}`);
  }
  return checkCrossReferences(parseContribYaml(await response.text(), id), index);
}

export async function loadContribComponent(id: string): Promise<ContribEntry> {
  return fetchComponent(id, await loadContribIndex());
}

export async function loadAllContribComponents(): Promise<ContribEntry[]> {
  const index = await loadContribIndex();
  return Promise.all(index.components.map((id) => fetchComponent(id, index)));
}
