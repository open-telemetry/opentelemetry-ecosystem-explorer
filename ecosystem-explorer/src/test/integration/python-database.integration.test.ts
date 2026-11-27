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
import { describe, it, expect, beforeAll, afterAll } from "vite-plus/test";
import { installFetchInterceptor, uninstallFetchInterceptor } from "./helpers/fetch-interceptor";
import { loadIndex, loadPackage } from "@/lib/api/python-data";
import {
  applyFilters,
  computeCounts,
  parseFilters,
  sourceUrl,
  toRow,
} from "@/features/python/utils/catalogue";

beforeAll(() => installFetchInterceptor());
afterAll(() => uninstallFetchInterceptor());

describe("python database", () => {
  it("lists packages, each with at least one release and its latest version first", async () => {
    const index = await loadIndex();

    expect(index.ecosystem).toBe("python");
    expect(index.packages.length).toBeGreaterThan(0);
    for (const pkg of index.packages) {
      expect(pkg.releases.length).toBeGreaterThan(0);
      expect(pkg.version).toBe(pkg.releases[0].version);
    }
  });

  it("resolves every release of every package to a package file with the same name", async () => {
    const index = await loadIndex();

    for (const pkg of index.packages) {
      for (const release of pkg.releases) {
        const data = await loadPackage(pkg.name, release.version, index);
        expect(data.name).toBe(pkg.name);
      }
    }
  });

  it("keeps the version out of package files, so releases can share one", async () => {
    const index = await loadIndex();

    for (const pkg of index.packages) {
      const data = await loadPackage(pkg.name, undefined, index);
      expect(data).not.toHaveProperty("version");
    }
  });

  it("keeps null metrics and semantic-convention status distinct from false", async () => {
    const index = await loadIndex();

    for (const pkg of index.packages) {
      expect([true, false, null]).toContain(pkg.supports_metrics);
      const data = await loadPackage(pkg.name, undefined, index);
      // The package file agrees with the index, including when upstream said nothing.
      expect(data.supports_metrics).toBe(pkg.supports_metrics);
      expect(data.semantic_convention_status).toBe(pkg.semantic_convention_status);
    }
  });

  it("builds a catalogue row and a source link for every package", async () => {
    const index = await loadIndex();
    const rows = index.packages.map(toRow);

    expect(rows.map((r) => r.name)).toEqual(index.packages.map((p) => p.name));
    for (const pkg of index.packages) {
      const data = await loadPackage(pkg.name, undefined, index);
      expect(sourceUrl(data)).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/tree\/main\/.+/);
    }
  });

  it("splits packages exactly across the metrics facet, with no package lost or double counted", async () => {
    const index = await loadIndex();
    const rows = index.packages.map(toRow);
    const counts = computeCounts(rows);

    expect(counts.metrics.supported + counts.metrics.unsupported + counts.metrics.unknown).toBe(
      rows.length
    );
    const unknown = applyFilters(rows, parseFilters("?metrics=unknown"));
    expect(unknown).toHaveLength(counts.metrics.unknown);
    expect(unknown.every((r) => r.metrics === "unknown")).toBe(true);
  });
});
