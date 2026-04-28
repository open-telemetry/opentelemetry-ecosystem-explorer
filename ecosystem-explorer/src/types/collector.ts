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

export interface VersionsIndex {
  versions: VersionInfo[];
}

export interface VersionInfo {
  version: string;
  is_latest: boolean;
}

export interface VersionManifest {
  components: Record<string, string>;
  version: string;
}

export interface CollectorComponent {
  name: string;
  component_type: "receiver" | "processor" | "exporter" | "extension" | "connector";
  distribution: "core" | "contrib" | string;
  version: string;
  repository?: string;
  type?: string;
  display_name?: string;
  description?: string;
  status?: ComponentStatus;
  codeowners?: CodeOwners;
}

export interface ComponentStatus {
  class: string;
  stability: Record<string, string[]>;
  distributions: string[];
}

export interface CodeOwners {
  active?: string[];
  emeritus?: string[];
}
