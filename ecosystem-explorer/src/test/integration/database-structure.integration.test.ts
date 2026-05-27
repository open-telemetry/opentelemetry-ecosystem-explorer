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
import { loadVersions, loadVersionManifest, loadInstrumentation } from "@/lib/api/javaagent-data";

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
});
