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

/*
 * Types for the opentelemetry-java-contrib `metadata.yaml` pilot format. Field names mirror the
 * YAML keys exactly so parsed documents can be used without remapping.
 */

export const COMPONENT_TYPES = ["library", "agent-extension", "standalone"] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const CONTRIB_STABILITIES = [
  "development",
  "alpha",
  "beta",
  "stable",
  "deprecated",
] as const;
export type ContribStability = (typeof CONTRIB_STABILITIES)[number];

/** Each known distribution and the repository that publishes it. */
export const DISTRIBUTIONS = {
  javaagent: "https://github.com/open-telemetry/opentelemetry-java-instrumentation",
} as const;
export type DistributionName = keyof typeof DISTRIBUTIONS;

export const CONFIGURATION_METHOD_TYPES = ["sdk-autoconfiguration", "declarative"] as const;
export type ConfigurationMethodType = (typeof CONFIGURATION_METHOD_TYPES)[number];

export const EXAMPLE_LANGUAGES = ["yaml", "shell", "properties", "java", "kotlin", "xml"] as const;
export type ExampleLanguage = (typeof EXAMPLE_LANGUAGES)[number];

export const SETTING_TYPES = [
  "string",
  "boolean",
  "int",
  "double",
  "duration",
  "list",
  "map",
] as const;
export type SettingType = (typeof SETTING_TYPES)[number];

/** `list` is a sequence of strings and `map` a string-to-string mapping in this pilot format. */
export type SettingDefault = string | number | boolean | string[] | Record<string, string> | null;

export interface ContribSetting {
  name: string;
  type: SettingType;
  /** null means no configured value; the description explains the fallback. */
  default: SettingDefault;
  description: string;
  /** Only on `string` settings. */
  allowed_values?: string[];
  /** Only on `int` and `double` settings. */
  unit?: string;
}

export interface ContribConfiguration {
  type: ConfigurationMethodType;
  display_name: string;
  description: string;
  example: {
    language: ExampleLanguage;
    code: string;
  };
  settings: ContribSetting[];
  /** Declarative only, and always paired with `location`. */
  component_key?: string;
  /** Dot-separated mapping keys, with `[]` marking sequence-element traversal. */
  location?: string;
}

export interface ContribDistribution {
  name: DistributionName;
  repository_url: string;
}

export interface ContribComponent {
  name: string;
  display_name: string;
  description: string;
  source_path: string;
  component_types: ComponentType[];
  docs_url: string;
  usage: string;
  status: {
    stability: ContribStability;
    replaced_by?: string;
  };
  artifact?: {
    group_id: string;
    artifact_id: string;
  };
  min_java_version: number;
  distributions: ContribDistribution[];
  configurations: ContribConfiguration[];
}

/** `index.json`: file stems under `components/`, in display order. Each stem must equal `name`. */
export interface ContribIndex {
  components: string[];
}

/**
 * A loaded `components/<id>.yaml`. `component` is normalized so it is always safe to render, even
 * when `problems` is nonempty.
 */
export interface ContribEntry {
  id: string;
  component: ContribComponent;
  problems: string[];
}
