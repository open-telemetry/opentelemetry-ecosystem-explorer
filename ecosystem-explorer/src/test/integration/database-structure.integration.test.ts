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
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { installFetchInterceptor, uninstallFetchInterceptor } from "./helpers/fetch-interceptor";
import {
  loadVersions,
  loadVersionManifest,
  loadInstrumentation,
  loadInstrumentationBundle,
  loadIndex,
} from "@/lib/api/javaagent-data";
import { toJavaAgentResult } from "@/lib/search/sources/java-agent";

beforeAll(() => installFetchInterceptor());
afterAll(() => uninstallFetchInterceptor());

describe("database structure", () => {
  describe("versions-index", () => {
    it("loads successfully and contains at least one version", async () => {
      const versions = await loadVersions();
      expect(versions.versions.length).toBeGreaterThan(0);
    });

    it("has exactly one version marked as latest", async () => {
      const versions = await loadVersions();
      const latestVersions = versions.versions.filter((v) => v.is_latest);
      expect(latestVersions).toHaveLength(1);
    });

    it("every version entry has a non-empty version string", async () => {
      const versions = await loadVersions();
      for (const v of versions.versions) {
        expect(typeof v.version).toBe("string");
        expect(v.version.length).toBeGreaterThan(0);
      }
    });
  });

  describe("version manifest", () => {
    it("loads for the latest version and contains instrumentations", async () => {
      const { versions } = await loadVersions();
      const latestVersion = versions.find((v) => v.is_latest)!.version;
      const manifest = await loadVersionManifest(latestVersion);

      expect(manifest.version).toBe(latestVersion);
      expect(Object.keys(manifest.instrumentations).length).toBeGreaterThan(0);
    });

    it("every manifest entry maps an id to a non-empty hash string", async () => {
      const { versions } = await loadVersions();
      const latestVersion = versions.find((v) => v.is_latest)!.version;
      const manifest = await loadVersionManifest(latestVersion);

      for (const [id, hash] of Object.entries(manifest.instrumentations)) {
        expect(typeof id).toBe("string");
        expect(id.length).toBeGreaterThan(0);
        expect(typeof hash).toBe("string");
        expect(hash.length).toBeGreaterThan(0);
      }
    });
  });

  describe("instrumentation data", () => {
    it("loads the first instrumentation from the latest manifest", async () => {
      const { versions } = await loadVersions();
      const latestVersion = versions.find((v) => v.is_latest)!.version;
      const manifest = await loadVersionManifest(latestVersion);
      const firstId = Object.keys(manifest.instrumentations)[0];

      const instrumentation = await loadInstrumentation(firstId, latestVersion, manifest);

      expect(typeof instrumentation.name).toBe("string");
      expect(instrumentation.name.length).toBeGreaterThan(0);
    });

    it("loaded instrumentation has a scope with a non-empty name", async () => {
      const { versions } = await loadVersions();
      const latestVersion = versions.find((v) => v.is_latest)!.version;
      const manifest = await loadVersionManifest(latestVersion);
      const firstId = Object.keys(manifest.instrumentations)[0];

      const instrumentation = await loadInstrumentation(firstId, latestVersion, manifest);

      expect(typeof instrumentation.scope.name).toBe("string");
      expect(instrumentation.scope.name.length).toBeGreaterThan(0);
    });

    it("loaded instrumentation name matches the id it was requested by", async () => {
      const { versions } = await loadVersions();
      const latestVersion = versions.find((v) => v.is_latest)!.version;
      const manifest = await loadVersionManifest(latestVersion);
      const firstId = Object.keys(manifest.instrumentations)[0];

      const instrumentation = await loadInstrumentation(firstId, latestVersion, manifest);

      expect(instrumentation.name).toBe(firstId);
    });
  });

  describe("version list bundle", () => {
    // Bundles are produced by the Build Explorer Database workflow, not committed
    // alongside the frontend code. When the committed data predates that run (no
    // bundle_hash yet), these tests skip rather than fail; they validate the
    // artifact once it is present.
    it("every version entry advertises a non-empty bundle hash", async (ctx) => {
      const { versions } = await loadVersions();
      if (!versions.some((v) => v.bundle_hash)) ctx.skip();
      for (const v of versions) {
        expect(typeof v.bundle_hash).toBe("string");
        expect(v.bundle_hash!.length).toBeGreaterThan(0);
      }
    });

    it("the latest bundle loads, is non-empty, and matches the manifest count", async (ctx) => {
      const { versions } = await loadVersions();
      const latest = versions.find((v) => v.is_latest)!;
      if (!latest.bundle_hash) ctx.skip();
      const manifest = await loadVersionManifest(latest.version);

      const bundle = await loadInstrumentationBundle(latest.version, latest.bundle_hash!);

      const manifestCount =
        Object.keys(manifest.instrumentations).length +
        Object.keys(manifest.custom_instrumentations ?? {}).length;
      expect(bundle.length).toBe(manifestCount);
    });

    it("bundle entries carry precomputed telemetry flags and the custom flag", async (ctx) => {
      const { versions } = await loadVersions();
      const latest = versions.find((v) => v.is_latest)!;
      if (!latest.bundle_hash) ctx.skip();

      const bundle = await loadInstrumentationBundle(latest.version, latest.bundle_hash!);

      for (const entry of bundle) {
        expect(typeof entry.name).toBe("string");
        expect(entry.name.length).toBeGreaterThan(0);
        // Slim entries precompute presence flags in place of the heavy telemetry array.
        expect(typeof entry.has_spans).toBe("boolean");
        expect(typeof entry.has_metrics).toBe("boolean");
        expect(typeof entry._is_custom).toBe("boolean");
        // The heavy detail arrays must be dropped from the slim bundle. The slim
        // type has no `telemetry` field, so probe the raw object to assert absence.
        expect((entry as unknown as Record<string, unknown>).telemetry).toBeUndefined();
      }
    });
  });

  describe("instrumentation index (global search source)", () => {
    // index.json is the sole input to the search source; tested against committed
    // data so a future field drop is caught here, not in prod.
    it("loads a non-empty index whose entries have a string name", async () => {
      const index = await loadIndex();

      expect(index.ecosystem).toBe("javaagent");
      expect(index.components.length).toBeGreaterThan(0);
      for (const entry of index.components) {
        expect(typeof entry.name).toBe("string");
        expect(entry.name.length).toBeGreaterThan(0);
        if (entry.search_terms !== undefined) {
          expect(Array.isArray(entry.search_terms)).toBe(true);
          expect(entry.search_terms.every((t) => typeof t === "string")).toBe(true);
        }
      }
    });

    it("every entry produces a search result whose keywords include the index name", async () => {
      const index = await loadIndex();

      // Exercises the real search source, including the no-search_terms graceful path.
      for (const entry of index.components) {
        const result = toJavaAgentResult(entry, "latest");
        expect(result.keywords).toContain(entry.name);
      }
    });
  });
});
