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
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error -- untyped build script, imported for its pure page builders.
import {
  buildJavaInstrumentationPage,
  buildCollectorComponentPage,
  writeLatestJsonAliases,
  writeFacetArtifacts,
  collectorSignals,
  javaSignals,
} from "./generate-agent-docs.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../public");
const dataDir = resolve(publicDir, "data");
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf-8"));

const latestVersion = (ecosystem: string): string => {
  const { versions } = readJson(resolve(dataDir, ecosystem, "versions-index.json"));
  return versions.find((v: { is_latest: boolean }) => v.is_latest).version;
};

type Doc = {
  name?: string;
  display_name?: string;
  type?: string;
  distribution?: string;
  description?: string;
  status?: { stability?: Record<string, string[]> };
  telemetry?: unknown;
};

/** `{id: doc}` for every component in an ecosystem's latest release. */
const latestDocs = (
  ecosystem: string,
  contentDir: string,
  sections: string[]
): Record<string, Doc> => {
  const manifest = readJson(
    resolve(dataDir, ecosystem, `versions/${latestVersion(ecosystem)}-index.json`)
  );
  const hashes: Record<string, string> = Object.assign(
    {},
    ...sections.map((section) => manifest[section] ?? {})
  );
  return Object.fromEntries(
    Object.entries(hashes).map(([id, hash]) => [
      id,
      readJson(resolve(dataDir, ecosystem, contentDir, id, `${id}-${hash}.json`)),
    ])
  );
};

/**
 * Corpus fidelity assertion: every metric name, span kind, and `when` condition
 * present in the source JSON must survive into the generated Markdown. This is
 * the check that would have caught the flattening and the missing Collector
 * metrics at build time.
 */
describe("agent docs: fidelity against the registry corpus", () => {
  it("preserves every Java metric name, span kind, and `when` condition", () => {
    const version = latestVersion("javaagent");
    const manifest = readJson(resolve(dataDir, `javaagent/versions/${version}-index.json`));
    const all = { ...manifest.instrumentations, ...manifest.custom_instrumentations };
    const missing: string[] = [];

    for (const [name, hash] of Object.entries(all)) {
      const instr = readJson(
        resolve(dataDir, `javaagent/instrumentations/${name}/${name}-${hash}.json`)
      );
      const md = buildJavaInstrumentationPage(instr, "/data/x.json");
      for (const group of instr.telemetry ?? []) {
        if (!md.includes(group.when)) missing.push(`${name}: when=${group.when}`);
        for (const metric of group.metrics ?? []) {
          if (!md.includes(metric.name)) missing.push(`${name}: metric=${metric.name}`);
        }
        for (const span of group.spans ?? []) {
          if (span.span_kind && !md.includes(span.span_kind)) {
            missing.push(`${name}: span_kind=${span.span_kind}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("preserves every Collector metric name across both metric shapes", () => {
    const version = latestVersion("collector");
    const manifest = readJson(resolve(dataDir, `collector/versions/${version}-index.json`));
    const missing: string[] = [];

    for (const [id, hash] of Object.entries(manifest.components)) {
      const component = readJson(resolve(dataDir, `collector/components/${id}/${id}-${hash}.json`));
      const md = buildCollectorComponentPage(component, "/data/x.json");
      const names = [
        ...Object.keys(component.metrics ?? {}),
        ...Object.keys(component.telemetry?.metrics ?? {}),
      ];
      for (const metricName of names) {
        if (!md.includes(metricName)) missing.push(`${id}: metric=${metricName}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("agent docs: stable JSON alias over the corpus", () => {
  // The alias is what makes a component readable in one request; if the copy
  // silently produced nothing, only a manual `curl` against a deploy would notice.
  it("writes a latest.json copy of every latest-release component", async () => {
    const outDir = mkdtempSync(resolve(tmpdir(), "agent-docs-aliases-"));
    try {
      await writeLatestJsonAliases(publicDir, outDir);

      for (const [ecosystem, contentDir, sections] of [
        ["collector", "components", ["components"]],
        ["javaagent", "instrumentations", ["instrumentations", "custom_instrumentations"]],
      ] as const) {
        const version = latestVersion(ecosystem);
        const manifest = readJson(resolve(dataDir, `${ecosystem}/versions/${version}-index.json`));
        const hashes: Record<string, string> = Object.assign(
          {},
          ...sections.map((section) => manifest[section] ?? {})
        );
        expect(Object.keys(hashes).length).toBeGreaterThan(0);

        for (const [id, hash] of Object.entries(hashes)) {
          const alias = readFileSync(
            resolve(outDir, `data/${ecosystem}/${contentDir}/${id}/latest.json`),
            "utf-8"
          );
          const pinned = readFileSync(
            resolve(dataDir, `${ecosystem}/${contentDir}/${id}/${id}-${hash}.json`),
            "utf-8"
          );
          expect(alias).toBe(pinned);
        }
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

describe("agent docs: reverse index and facets", () => {
  // Answering "what emits this metric?" from the reverse index is only safe if
  // the index is complete; a silently partial map reads as an authoritative "no".
  it("maps every metric and attribute in the corpus back to its component", async () => {
    const outDir = mkdtempSync(resolve(tmpdir(), "agent-docs-facets-"));
    try {
      await writeFacetArtifacts(publicDir, outDir);
      const missing: string[] = [];

      const check = (
        ecosystem: string,
        docs: Record<string, { metrics: string[]; attributes: string[] }>
      ) => {
        const byMetric = readJson(resolve(outDir, `data/${ecosystem}/by-metric.json`));
        const byAttribute = readJson(resolve(outDir, `data/${ecosystem}/by-attribute.json`));
        const facetIds = new Set(
          readFileSync(resolve(outDir, `data/${ecosystem}/facets.jsonl`), "utf-8")
            .trimEnd()
            .split("\n")
            .map((line) => JSON.parse(line).id)
        );

        for (const [id, keys] of Object.entries(docs)) {
          if (!facetIds.has(id)) missing.push(`${ecosystem}/${id}: no facet row`);
          for (const name of keys.metrics) {
            if (!byMetric.entries[name]?.includes(id)) missing.push(`${ecosystem}/${id}: ${name}`);
          }
          for (const name of keys.attributes) {
            if (!byAttribute.entries[name]?.includes(id)) {
              missing.push(`${ecosystem}/${id}: ${name}`);
            }
          }
        }

        // `resolve_ids_with` is only a real promise if every id it hands back
        // has a row in that file.
        for (const index of [byMetric, byAttribute]) {
          expect(index.resolve_ids_with).toBe(`/data/${ecosystem}/facets.jsonl`);
          for (const ids of Object.values(index.entries) as string[][]) {
            for (const id of ids) {
              if (!facetIds.has(id)) missing.push(`${ecosystem}: unresolvable id ${id}`);
            }
          }
        }
      };

      const collectorVersion = latestVersion("collector");
      const collectorManifest = readJson(
        resolve(dataDir, `collector/versions/${collectorVersion}-index.json`)
      );
      const collectorDocs: Record<string, { metrics: string[]; attributes: string[] }> = {};
      for (const [id, hash] of Object.entries(collectorManifest.components)) {
        const doc = readJson(resolve(dataDir, `collector/components/${id}/${id}-${hash}.json`));
        // Effective names, not map keys: a metric can carry a `prefix` applied
        // at emission time, and an attribute can rename itself via
        // `name_override` — the reverse index is keyed by what's actually
        // emitted/exported, matching the fix in `telemetryKeys`.
        const metricMaps = [doc.metrics ?? {}, doc.telemetry?.metrics ?? {}];
        collectorDocs[id] = {
          metrics: metricMaps.flatMap((map) =>
            Object.entries(map).map(([name, metric]) => `${metric?.prefix ?? ""}${name}`)
          ),
          attributes: Object.entries(doc.attributes ?? {}).map(
            ([name, attribute]) => attribute?.name_override ?? name
          ),
        };
      }
      check("collector", collectorDocs);

      const javaVersion = latestVersion("javaagent");
      const javaManifest = readJson(
        resolve(dataDir, `javaagent/versions/${javaVersion}-index.json`)
      );
      const javaDocs: Record<string, { metrics: string[]; attributes: string[] }> = {};
      for (const [id, hash] of Object.entries({
        ...javaManifest.instrumentations,
        ...javaManifest.custom_instrumentations,
      })) {
        const doc = readJson(
          resolve(dataDir, `javaagent/instrumentations/${id}/${id}-${hash}.json`)
        );
        const metrics: string[] = [];
        const attributes: string[] = [];
        for (const group of doc.telemetry ?? []) {
          for (const metric of group.metrics ?? []) {
            metrics.push(metric.name);
            for (const attr of metric.attributes ?? []) attributes.push(attr.name);
          }
          for (const span of group.spans ?? []) {
            for (const attr of span.attributes ?? []) attributes.push(attr.name);
          }
        }
        javaDocs[id] = { metrics, attributes };
      }
      check("javaagent", javaDocs);

      expect(missing).toEqual([]);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("emits sorted keys and ids so an unchanged corpus rebuilds byte-identically", async () => {
    const outDir = mkdtempSync(resolve(tmpdir(), "agent-docs-facets-sorted-"));
    try {
      await writeFacetArtifacts(publicDir, outDir);

      const byMetric = readJson(resolve(outDir, "data/javaagent/by-metric.json"));
      const keys = Object.keys(byMetric.entries);
      expect(keys).toEqual([...keys].sort());
      for (const ids of Object.values(byMetric.entries) as string[][]) {
        expect(ids).toEqual([...ids].sort());
      }

      const rows = readFileSync(resolve(outDir, "data/javaagent/facets.jsonl"), "utf-8")
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line));
      const ids = rows.map((row) => row.id);
      expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("carries the facets an agent filters on, and no derivable URL", async () => {
    const outDir = mkdtempSync(resolve(tmpdir(), "agent-docs-facets-fields-"));
    try {
      await writeFacetArtifacts(publicDir, outDir);

      const row = (ecosystem: string, id: string) =>
        readFileSync(resolve(outDir, `data/${ecosystem}/facets.jsonl`), "utf-8")
          .trimEnd()
          .split("\n")
          .map((line) => JSON.parse(line))
          .find((entry) => entry.id === id);

      // The subjects are picked out of the corpus rather than named, so an
      // upstream rename or removal can't fail a test about field mapping.
      // First match in id order keeps the pick deterministic.
      const pick = (docs: Record<string, Doc>, signals: (doc: Doc) => string[]) => {
        const id = Object.keys(docs)
          .sort()
          .find((candidate) => docs[candidate].description && signals(docs[candidate]).length > 0);
        expect(id, "no corpus entry has both a description and signals").toBeDefined();
        return { id: id as string, doc: docs[id as string] };
      };

      const collector = pick(
        latestDocs("collector", "components", ["components"]),
        collectorSignals
      );
      const component = row("collector", collector.id);
      expect(component).toMatchObject({
        name: collector.doc.name,
        type: collector.doc.type,
        distribution: collector.doc.distribution,
        description: collector.doc.description,
        page: `/collector/components/${collector.doc.distribution}/${collector.doc.name}`,
      });
      expect(component.signals).toEqual(collectorSignals(collector.doc));
      // Derivable from the id via the documented alias pattern, so not stored.
      expect(component.json).toBeUndefined();

      const java = pick(
        latestDocs("javaagent", "instrumentations", [
          "instrumentations",
          "custom_instrumentations",
        ]),
        javaSignals
      );
      const instrumentation = row("javaagent", java.id);
      expect(instrumentation).toMatchObject({
        display_name: java.doc.display_name || java.id,
        description: java.doc.description,
        page: `/java-agent/instrumentation/${java.id}`,
      });
      expect(instrumentation.signals).toEqual(javaSignals(java.doc));
      expect(instrumentation.json).toBeUndefined();
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
