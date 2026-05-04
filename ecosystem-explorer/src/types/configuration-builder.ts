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

export type ConfigValue = string | number | boolean | null | ConfigValues | ConfigValue[];

export interface ConfigValues {
  [key: string]: ConfigValue;
}

export type PathSegment = string | number;
export type Path = PathSegment[];

export interface ConfigurationBuilderState {
  version: string;
  values: ConfigValues;
  enabledSections: Record<string, boolean>;
  validationErrors: Record<string, string>;
  isDirty: boolean;
  /**
   * Stable ids for list items, keyed by serialized list path. Maintained by
   * the reducer so React keys survive mid-list removals and `loadFromYaml`
   * replacements without remounting the wrong item cards. Optional so that
   * test fixtures and older saved payloads can omit it; the renderer falls
   * back to path+index keys when an entry is missing or out of sync.
   */
  listItemIds?: Record<string, string[]>;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export type ConfigurationBuilderAction =
  | { type: "SET_VALUE"; path: Path; value: ConfigValue }
  | { type: "SET_ENABLED"; section: string; enabled: boolean; defaults?: ConfigValues }
  | { type: "SELECT_PLUGIN"; path: Path; pluginKey: string; defaults: ConfigValues }
  | { type: "ADD_LIST_ITEM"; path: Path; defaultItem: ConfigValue }
  | { type: "REMOVE_LIST_ITEM"; path: Path; index: number }
  | { type: "SET_MAP_ENTRY"; path: Path; key: string; value: string }
  | { type: "REMOVE_MAP_ENTRY"; path: Path; key: string }
  | { type: "LOAD_STATE"; state: ConfigurationBuilderState }
  | { type: "SET_VALIDATION_ERRORS"; errors: Record<string, string> }
  | { type: "SET_FIELD_ERROR"; path: string; error: string | null }
  | { type: "ENABLE_ALL_SECTIONS"; defaultsBySection: Record<string, ConfigValues> }
  | { type: "SET_OVERRIDE"; module: string; status: "enabled" | "disabled" | "none" };
