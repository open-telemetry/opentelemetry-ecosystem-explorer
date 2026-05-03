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
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { InstrumentationData } from "@/types/javaagent";
import { groupByModule, normalizeRegistryName } from "./normalize-instrumentation";

const REGISTRY_DIR = "public/data/javaagent/instrumentations";

function makeEntry(
  overrides: Partial<InstrumentationData> & { name: string }
): InstrumentationData {
  return {
    scope: { name: `io.opentelemetry.${overrides.name}` },
    ...overrides,
  } as InstrumentationData;
}

describe("normalizeRegistryName", () => {
  it("strips a trailing -N.N version suffix", () => {
    expect(normalizeRegistryName("cassandra-4.4")).toBe("cassandra");
    expect(normalizeRegistryName("akka-http-10.0")).toBe("akka_http");
    expect(normalizeRegistryName("kafka-clients-0.11")).toBe("kafka_clients");
  });

  it("strips a trailing -N (no minor) version suffix", () => {
    expect(normalizeRegistryName("foo-3")).toBe("foo");
  });

  it("strips a trailing -N.N.N version suffix", () => {
    expect(normalizeRegistryName("foo-1.2.3")).toBe("foo");
  });

  it("keeps names without a trailing version suffix", () => {
    expect(normalizeRegistryName("jmx-metrics")).toBe("jmx_metrics");
    expect(normalizeRegistryName("methods")).toBe("methods");
  });

  it("preserves modules that share a parent dir but are distinct", () => {
    expect(normalizeRegistryName("armeria-1.3")).toBe("armeria");
    expect(normalizeRegistryName("armeria-grpc-1.14")).toBe("armeria_grpc");
  });

  it("replaces dots in embedded version markers (jaxrs/jaxws style)", () => {
    expect(normalizeRegistryName("jaxrs-2.0-annotations")).toBe("jaxrs_2_0_annotations");
    expect(normalizeRegistryName("jaxrs-2.0-cxf-3.2")).toBe("jaxrs_2_0_cxf");
    expect(normalizeRegistryName("jaxrs-3.0-annotations")).toBe("jaxrs_3_0_annotations");
    expect(normalizeRegistryName("jaxws-2.0-axis2-1.6")).toBe("jaxws_2_0_axis2");
  });
});

describe("groupByModule", () => {
  it("groups entries with the same normalized name", () => {
    const entries = [
      makeEntry({ name: "cassandra-3.0" }),
      makeEntry({ name: "cassandra-4.0" }),
      makeEntry({ name: "cassandra-4.4" }),
    ];
    const modules = groupByModule(entries);
    expect(modules).toHaveLength(1);
    expect(modules[0].name).toBe("cassandra");
    expect(modules[0].coveredEntries.map((e) => e.name)).toEqual([
      "cassandra-3.0",
      "cassandra-4.0",
      "cassandra-4.4",
    ]);
  });

  it("aggregates defaultDisabled with `every`", () => {
    const allDisabled = groupByModule([
      makeEntry({ name: "jmx-metrics", disabled_by_default: true }),
    ]);
    expect(allDisabled[0].defaultDisabled).toBe(true);

    const allEnabled = groupByModule([makeEntry({ name: "cassandra-4.4" })]);
    expect(allEnabled[0].defaultDisabled).toBe(false);

    const mixed = groupByModule([
      makeEntry({ name: "x-1.0", disabled_by_default: true }),
      makeEntry({ name: "x-2.0", disabled_by_default: false }),
    ]);
    expect(mixed[0].defaultDisabled).toBe(false);
  });

  it("sorts modules alphabetically and entries within a module", () => {
    const entries = [
      makeEntry({ name: "zookeeper-3.0" }),
      makeEntry({ name: "armeria-1.3" }),
      makeEntry({ name: "cassandra-4.4" }),
      makeEntry({ name: "cassandra-3.0" }),
    ];
    const modules = groupByModule(entries);
    expect(modules.map((m) => m.name)).toEqual(["armeria", "cassandra", "zookeeper"]);
    expect(modules[1].coveredEntries.map((e) => e.name)).toEqual([
      "cassandra-3.0",
      "cassandra-4.4",
    ]);
  });
});

describe("snapshot: full registry", () => {
  function loadAllEntries(): InstrumentationData[] {
    const entries: InstrumentationData[] = [];
    for (const dir of readdirSync(REGISTRY_DIR)) {
      const dirPath = join(REGISTRY_DIR, dir);
      if (!statSync(dirPath).isDirectory()) continue;
      const files = readdirSync(dirPath)
        .filter((f) => f.endsWith(".json"))
        .map((f) => ({ f, mtime: statSync(join(dirPath, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      if (files.length === 0) continue;
      const data = JSON.parse(readFileSync(join(dirPath, files[0].f), "utf8"));
      entries.push(data);
    }
    return entries;
  }

  it("produces a stable partition with valid module names", () => {
    const entries = loadAllEntries();
    expect(entries.length).toBeGreaterThanOrEqual(250);
    const modules = groupByModule(entries);
    expect(modules.length).toBeGreaterThanOrEqual(170);
    expect(modules.length).toBeLessThan(entries.length);

    const totalCovered = modules.reduce((sum, m) => sum + m.coveredEntries.length, 0);
    expect(totalCovered).toBe(entries.length);

    for (const m of modules) {
      expect(m.name).toMatch(/^[a-z][a-z0-9_]*$/);
      const flags = new Set(m.coveredEntries.map((e) => e.disabled_by_default === true));
      expect(flags.size, `module ${m.name} has mixed disabled_by_default`).toBe(1);
    }
  });
});
