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
 * Shapes written by explorer-db-builder's javascript pipeline
 * (ecosystem-automation/explorer-db-builder/src/explorer_db_builder/javascript_builder.py).
 *
 * JS packages version independently, so there is no ecosystem-wide version index.
 * `index.json` lists every package with its releases, and each release points at a
 * content-addressed package file. Package files carry no version, so releases that
 * only bumped it share one file.
 */

/** One release of a package and the package file it uses. */
export interface JavascriptRelease {
  version: string;
  hash: string;
}

/** One entry in `index.json`. Metadata comes from the package's latest release. */
export interface JavascriptIndexPackage {
  name: string;
  /** Always written; null when the latest release has none. */
  npm_package: string | null;
  description: string | null;
  in_auto_instrumentations_node: boolean;
  /** Latest version, the same as `releases[0].version`. */
  version: string;
  /** Every release, newest first. */
  releases: JavascriptRelease[];
}

export interface JavascriptIndex {
  ecosystem: "javascript";
  packages: JavascriptIndexPackage[];
}

/** Library versions the package README says it supports. */
export interface JavascriptSupportedVersion {
  package: string;
  version_range: string;
  source: string;
}

/** Library versions the package is tested against, from its `.tav.yml`. */
export interface JavascriptTestedVersion {
  package: string;
  range: string;
  source: string;
  mode?: string;
  exclude?: string;
}

/** A module inside a package that bundles several instrumentations (browser-instrumentation). */
export interface JavascriptModule {
  name: string;
  import_path: string;
  source_path: string;
  scope_name?: string;
}

/**
 * A package file, `packages/{name}/{name}-{hash}.json`. Every field except `name` is
 * optional: the builder only writes the fields a release has, and js-contrib and
 * browser packages carry different ones.
 */
export interface JavascriptPackage {
  name: string;
  npm_package?: string;
  description?: string;
  /** Upstream repository, e.g. "open-telemetry/opentelemetry-js-contrib". */
  repository?: string;
  source_path?: string;
  node_engine?: string;
  in_auto_instrumentations_node?: boolean;
  supported_versions?: JavascriptSupportedVersion[];
  tested_versions?: JavascriptTestedVersion[];
  modules?: JavascriptModule[];
}
