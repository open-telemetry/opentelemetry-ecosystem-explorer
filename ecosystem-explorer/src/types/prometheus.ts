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

export interface PrometheusComponent {
  id: string;
  ecosystem: "prometheus";
  distribution: "official" | "community";
  type: "exporter" | "sdk";
  name: string;
  display_name?: string;
  description?: string;
  repository?: string;
  website?: string;
  language?: string; // For SDKs
  category?: string; // For Exporters
}

export interface PrometheusVersionsIndex {
  versions: {
    version: string;
    is_latest: boolean;
  }[];
}

export interface PrometheusIndex {
  ecosystem: "prometheus";
  taxonomy: {
    distributions: string[];
    types: string[];
  };
  components: {
    id: string;
    name: string;
    distribution: string;
    type: string;
    display_name?: string;
    description?: string;
  }[];
}
