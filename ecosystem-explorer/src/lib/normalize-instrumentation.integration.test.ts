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
import {
  installFetchInterceptor,
  uninstallFetchInterceptor,
} from "@/test/integration/helpers/fetch-interceptor";
import { loadVersions, loadAllInstrumentations } from "@/lib/api/javaagent-data";
import { groupByModule } from "./normalize-instrumentation";

beforeAll(() => installFetchInterceptor());
afterAll(() => uninstallFetchInterceptor());

describe("snapshot: latest published registry", () => {
  it("produces a stable partition with valid module names", async () => {
    const { versions } = await loadVersions();
    const latest = versions.find((v) => v.is_latest);
    expect(latest, "no version is marked is_latest").toBeDefined();

    const entries = await loadAllInstrumentations(latest!.version);
    expect(entries.length).toBeGreaterThan(0);

    const modules = groupByModule(entries);
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.length, "grouping collapsed nothing").toBeLessThan(entries.length);

    const totalCovered = modules.reduce((sum, m) => sum + m.coveredEntries.length, 0);
    expect(totalCovered).toBe(entries.length);

    for (const m of modules) {
      expect(m.name).toMatch(/^[a-z][a-z0-9_]*$/);
      const flags = new Set(m.coveredEntries.map((e) => e.disabled_by_default === true));
      expect(flags.size, `module ${m.name} has mixed disabled_by_default`).toBe(1);
    }
  });
});
