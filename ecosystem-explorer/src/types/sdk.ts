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

// Runtime state stored in the builder context
export interface SdkConfig {
  fileFormat: string;
  propagators: string[];
  tracerProvider: {
    exporterType: string;
    exporterEndpoint: string;
    exporterProtocol: string;
    samplerType: string;
    samplerRoot: string;
    samplerRatio: number;
    batchScheduleDelay: number;
    batchExportTimeout: number;
    batchMaxQueueSize: number;
    batchMaxExportBatchSize: number;
  };
}

// sdk-options.json shape — source of truth for defaults and UI metadata
export interface SdkOptions {
  schema_version: string;
  defaults: SdkDefaults;
  sections: SdkSections;
}

export interface SdkDefaults {
  file_format: string;
  propagators: string[];
  tracer_provider: {
    exporter_type: string;
    exporters: Record<string, Record<string, string>>;
    sampler: {
      type: string;
      root: string;
      ratio: number;
    };
    batch_processor: {
      schedule_delay: number;
      export_timeout: number;
      max_queue_size: number;
      max_export_batch_size: number;
    };
  };
}

export interface SdkSections {
  propagators: SdkPropagatorSection;
  tracer_provider: SdkTracerProviderSection;
}

export interface SdkPropagatorSection {
  name: string;
  description: string;
  options: SdkPropagatorOption[];
}

export interface SdkPropagatorOption {
  id: string;
  name: string;
  description: string;
}

export interface SdkTracerProviderSection {
  name: string;
  description: string;
  exporter: SdkExporterConfig;
  sampler: SdkSamplerConfig;
  batch_processor: SdkBatchProcessorConfig;
}

export interface SdkExporterConfig {
  name: string;
  description: string;
  options: SdkExporterOption[];
}

export interface SdkExporterOption {
  id: string;
  name: string;
  description: string;
  settings: SdkSettingField[];
}

export interface SdkSamplerConfig {
  name: string;
  description: string;
  options: SdkSamplerOption[];
}

export interface SdkSamplerOption {
  id: string;
  name: string;
  description: string;
  has_root?: boolean;
  root_options?: string[];
  has_ratio?: boolean;
}

export interface SdkBatchProcessorConfig {
  name: string;
  description: string;
  settings: SdkSettingField[];
}

export interface SdkSettingField {
  name: string;
  label: string;
  description: string;
  type: "string" | "integer" | "enum";
  options?: string[];
  min?: number;
}
