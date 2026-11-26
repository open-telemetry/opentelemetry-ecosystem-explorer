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
import type { PythonIndex, PythonPackage } from "@/types/python";

/** A small index in the shape of the real one: three packages, with every flag state present. */
export const pythonIndex: PythonIndex = {
  ecosystem: "python",
  packages: [
    {
      name: "opentelemetry-instrumentation-flask",
      description: "Flask instrumentation for OpenTelemetry",
      supports_metrics: true,
      semantic_convention_status: "migration",
      version: "0.66b2",
      releases: [
        { version: "0.66b2", hash: "aaaaaaaaaaaa" },
        { version: "0.66b1", hash: "aaaaaaaaaaaa" },
        { version: "0.66b0", hash: "bbbbbbbbbbbb" },
      ],
    },
    {
      name: "opentelemetry-instrumentation-click",
      description: "Click instrumentation for OpenTelemetry",
      supports_metrics: null,
      semantic_convention_status: null,
      version: "0.66b2",
      releases: [{ version: "0.66b2", hash: "cccccccccccc" }],
    },
    {
      name: "opentelemetry-instrumentation-asyncpg",
      description: "Asyncpg instrumentation for OpenTelemetry",
      supports_metrics: false,
      semantic_convention_status: null,
      version: "0.66b2",
      releases: [{ version: "0.66b2", hash: "dddddddddddd" }],
    },
  ],
};

const REPOSITORY = "open-telemetry/opentelemetry-python-contrib";

export const flaskPackage: PythonPackage = {
  name: "opentelemetry-instrumentation-flask",
  description: "Flask instrumentation for OpenTelemetry",
  repository: REPOSITORY,
  source_path: "instrumentation/opentelemetry-instrumentation-flask",
  homepage: `https://github.com/${REPOSITORY}/tree/main/instrumentation/opentelemetry-instrumentation-flask`,
  requires_python: ">=3.10",
  entry_points: [
    {
      name: "flask",
      value: "opentelemetry.instrumentation.flask:FlaskInstrumentor",
    },
  ],
  instruments: [
    { library: "flask", version_range: ">= 1.0", source_key: "instruments" },
    { library: "werkzeug", version_range: ">= 2.0", source_key: "instruments-any" },
  ],
  supports_metrics: true,
  semantic_convention_status: "migration",
};

/** A package with nothing optional: no libraries, no entry points, null flags, a bad homepage. */
export const clickPackage: PythonPackage = {
  name: "opentelemetry-instrumentation-click",
  repository: REPOSITORY,
  source_path: "instrumentation/opentelemetry-instrumentation-click",
  // Copied verbatim from upstream and missing "tree/main/": the pages must not link to it.
  homepage: `https://github.com/${REPOSITORY}/instrumentation/opentelemetry-instrumentation-click`,
  requires_python: ">=3.10",
  entry_points: [],
  instruments: [],
  supports_metrics: null,
  semantic_convention_status: null,
};

export const packagesByName: Record<string, PythonPackage> = {
  [flaskPackage.name]: flaskPackage,
  [clickPackage.name]: clickPackage,
};
