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
import { loadIndex, loadPackage } from "@/lib/api/javascript-data";

beforeAll(() => installFetchInterceptor());
afterAll(() => uninstallFetchInterceptor());

describe("javascript database", () => {
  it("lists packages, each with at least one release and its latest version first", async () => {
    const index = await loadIndex();

    expect(index.ecosystem).toBe("javascript");
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
});
