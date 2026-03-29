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
export interface ConfigVersionsIndex {
  versions: ConfigVersionInfo[];
}

export interface ConfigVersionInfo {
  version: string;
  is_latest: boolean;
}

export type ControlType =
  | "text_input"
  | "toggle"
  | "flag"
  | "number_input"
  | "number_list"
  | "string_list"
  | "select"
  | "list"
  | "group"
  | "plugin_select"
  | "key_value_map"
  | "circular_ref"
  | "union";

export interface Constraints {
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minItems?: number;
  maxItems?: number;
}

export interface EnumOption {
  value: string;
  description: string;
}

export interface ConfigNodeBase {
  controlType: ControlType;
  key: string;
  label: string;
  path: string;
  description?: string;
  defaultBehavior?: string;
  nullable?: boolean;
  required?: boolean;
  stability?: "development";
  nullBehavior?: string;
}

export interface GroupNode extends ConfigNodeBase {
  controlType: "group";
  children: ConfigNode[];
  allowAdditional?: boolean;
}

export interface ListNode extends ConfigNodeBase {
  controlType: "list";
  itemSchema: ConfigNode;
  constraints?: Constraints;
}

export interface SelectNode extends ConfigNodeBase {
  controlType: "select";
  enumOptions: EnumOption[];
}

export interface PluginSelectNode extends ConfigNodeBase {
  controlType: "plugin_select";
  options: ConfigNode[];
  allowCustom: boolean;
}

export interface CircularRefNode extends ConfigNodeBase {
  controlType: "circular_ref";
  refType: string;
}

export interface UnionNode extends ConfigNodeBase {
  controlType: "union";
  variants: ConfigNode[];
}

export interface NumberInputNode extends ConfigNodeBase {
  controlType: "number_input";
  constraints?: Constraints;
}

export interface StringListNode extends ConfigNodeBase {
  controlType: "string_list";
  constraints?: Constraints;
}

export interface NumberListNode extends ConfigNodeBase {
  controlType: "number_list";
  constraints?: Constraints;
}

export interface TextInputNode extends ConfigNodeBase {
  controlType: "text_input";
}

export interface ToggleNode extends ConfigNodeBase {
  controlType: "toggle";
}

export interface FlagNode extends ConfigNodeBase {
  controlType: "flag";
}

export interface KeyValueMapNode extends ConfigNodeBase {
  controlType: "key_value_map";
}

export type ConfigNode =
  | GroupNode
  | ListNode
  | SelectNode
  | PluginSelectNode
  | CircularRefNode
  | UnionNode
  | NumberInputNode
  | StringListNode
  | NumberListNode
  | TextInputNode
  | ToggleNode
  | FlagNode
  | KeyValueMapNode;
