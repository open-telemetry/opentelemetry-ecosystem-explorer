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
 * Shapes written by explorer-db-builder's python pipeline
 * (ecosystem-automation/explorer-db-builder/src/explorer_db_builder/python_builder.py).
 *
 * `index.json` lists every package with its releases, and each release points at a
 * content-addressed package file. Package files carry no version, so releases that
 * only bumped it share one file.
 */

/** One release of a package and the package file it uses. */
export interface PythonRelease {
  version: string;
  hash: string;
}

/**
 * One entry in `index.json`. Metadata comes from the package's latest release.
 *
 * `supports_metrics` and `semantic_convention_status` are null when upstream does not
 * say. Null means unknown, so it must not be treated as false or as "none".
 */
export interface PythonIndexPackage {
  name: string;
  description: string | null;
  supports_metrics: boolean | null;
  semantic_convention_status: string | null;
  /** Latest version, the same as `releases[0].version`. */
  version: string;
  /** Every release, newest first. */
  releases: PythonRelease[];
}

export interface PythonIndex {
  ecosystem: "python";
  packages: PythonIndexPackage[];
}

/** A Python library the package instruments, with the supported version range. */
export interface PythonInstrumentedLibrary {
  library: string;
  version_range: string;
  /**
   * The `pyproject.toml` dependency group the library came from. "instruments" means every
   * listed library is a dependency of the instrumentation; "instruments-any" means any one
   * of them is enough (see CONTRIBUTING.md in opentelemetry-python-contrib).
   */
  source_key: "instruments" | "instruments-any" | (string & {});
}

/** An `opentelemetry_instrumentor` entry point. */
export interface PythonEntryPoint {
  name: string;
  value: string;
}

/**
 * A package file, `packages/{name}/{name}-{hash}.json`. Every field except `name` is
 * optional here because the builder only writes the fields a release has.
 */
export interface PythonPackage {
  name: string;
  description?: string;
  /** Upstream repository, e.g. "open-telemetry/opentelemetry-python-contrib". */
  repository?: string;
  /** Path of the package inside the repository. */
  source_path?: string;
  /** Copied verbatim from upstream `pyproject.toml`; not always a working link. */
  homepage?: string;
  requires_python?: string;
  entry_points?: PythonEntryPoint[];
  instruments?: PythonInstrumentedLibrary[];
  supports_metrics?: boolean | null;
  semantic_convention_status?: string | null;
}
