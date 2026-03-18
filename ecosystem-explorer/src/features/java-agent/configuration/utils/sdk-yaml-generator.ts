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
import type { SdkConfig } from "@/types/sdk";

export function generateSdkYaml(sdk: SdkConfig): string {
  const lines: string[] = [];

  lines.push(`file_format: "${sdk.fileFormat}"`);

  // tracer_provider
  lines.push("tracer_provider:");
  lines.push("  processors:");
  lines.push("    - batch:");
  lines.push("        exporter:");

  const { exporterType, exporterEndpoint, exporterProtocol } = sdk.tracerProvider;

  if (exporterType === "console") {
    lines.push("          console:");
  } else {
    lines.push(`          ${exporterType}:`);
    if (exporterEndpoint) {
      lines.push(`            endpoint: ${exporterEndpoint}`);
    }
    if (exporterType === "otlp_http" && exporterProtocol) {
      lines.push(`            protocol: ${exporterProtocol}`);
    }
  }

  // sampler
  const { samplerType, samplerRoot, samplerRatio } = sdk.tracerProvider;
  lines.push("  sampler:");

  if (samplerType === "parent_based") {
    lines.push("    parent_based:");
    lines.push("      root:");
    if (samplerRoot === "trace_id_ratio_based") {
      lines.push("        trace_id_ratio_based:");
      lines.push(`          ratio: ${samplerRatio}`);
    } else {
      lines.push(`        ${samplerRoot}:`);
    }
  } else if (samplerType === "trace_id_ratio_based") {
    lines.push("    trace_id_ratio_based:");
    lines.push(`      ratio: ${samplerRatio}`);
  } else {
    lines.push(`    ${samplerType}:`);
  }

  // propagator
  if (sdk.propagators.length > 0) {
    lines.push("propagator:");
    lines.push("  composite:");
    for (const propagator of sdk.propagators) {
      lines.push(`    - ${propagator}:`);
    }
  }

  return lines.join("\n");
}
