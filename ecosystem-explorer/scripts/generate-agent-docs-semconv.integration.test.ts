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

import { beforeAll, describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error -- untyped build script, imported for its pure builders.
import {
  buildSemanticConventionsDomainPage,
  buildSemanticConventionsIndex,
  writeSemanticConventionsHistory,
} from "./generate-agent-docs.mjs";
import type { TimelineData } from "../src/features/semantic-conventions/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../public");
const dataDir = resolve(publicDir, "data/semantic-conventions");
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf-8"));
let timeline: TimelineData;

beforeAll(() => {
  timeline = readJson(resolve(dataDir, "timeline.json"));
});

async function generate() {
  const outDir = mkdtempSync(resolve(tmpdir(), "agent-docs-semconv-"));
  const result = await writeSemanticConventionsHistory(publicDir, outDir);
  return { outDir, result };
}

describe("agent docs: semantic-convention history", () => {
  it("publishes the same authored records the timeline UI reads", async () => {
    const { outDir } = await generate();
    try {
      const published = readJson(
        resolve(outDir, "data/semantic-conventions/accepted-history.json")
      );
      expect(published).toEqual(timeline);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("lists every timeline event, including hidden detail events, on its lane page", async () => {
    const { outDir } = await generate();
    try {
      expect(timeline.events.some((e) => !e.major)).toBe(true);
      for (const lane of timeline.lanes) {
        const page = readFileSync(
          resolve(outDir, `agent/semantic-conventions/${lane.id}.md`),
          "utf-8"
        );
        for (const event of timeline.events.filter((e) => e.lane === lane.id)) {
          expect(page).toContain(`\`${event.id}\``);
          expect(page).toContain(event.date);
        }
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("writes an index, one page per lane, and lists them for llms.txt", async () => {
    const { outDir, result } = await generate();
    try {
      const files = readdirSync(resolve(outDir, "agent/semantic-conventions")).sort();
      expect(files).toEqual(["index.md", ...timeline.lanes.map((l) => `${l.id}.md`)].sort());
      expect(result.pages.map((p: { pageUrl: string }) => p.pageUrl)).toEqual([
        "/agent/semantic-conventions/index.md",
        ...timeline.lanes.map((l) => `/agent/semantic-conventions/${l.id}.md`),
      ]);
      const index = readFileSync(resolve(outDir, "agent/semantic-conventions/index.md"), "utf-8");
      expect(index).toBe(result.indexMd);
      expect(index).toContain("`semantic-conventions-genai`");
      expect(index).toContain("ebe3d1fb9fdda3398099e11ef91c4c490912f88d");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("rebuilds byte-identically", async () => {
    const first = await generate();
    const second = await generate();
    try {
      for (const rel of [
        "data/semantic-conventions/accepted-history.json",
        "agent/semantic-conventions/genai.md",
      ]) {
        expect(readFileSync(resolve(first.outDir, rel), "utf-8")).toBe(
          readFileSync(resolve(second.outDir, rel), "utf-8")
        );
      }
    } finally {
      rmSync(first.outDir, { recursive: true, force: true });
      rmSync(second.outDir, { recursive: true, force: true });
    }
  });

  it("renders source-qualified revisions, evidence and the migration, in date order", () => {
    const genai = timeline.lanes.find((lane) => lane.id === "genai")!;
    const page = buildSemanticConventionsDomainPage(timeline, genai);
    expect(page).toContain("moved from `semantic-conventions` to `semantic-conventions-genai`");
    expect(page).toContain("| Date | Revision | Type |");
    expect(page).toContain("semantic-conventions@v1.42.0");
    expect(page).toContain("/commit/ebe3d1fb9fdda3398099e11ef91c4c490912f88d");
    const dates = [...page.matchAll(/^\| (\d{4}-\d\d-\d\d) \|/gm)].map((m) => m[1]);
    expect(dates).toEqual([...dates].sort());
    const spec = buildSemanticConventionsDomainPage(
      timeline,
      timeline.lanes.find((lane) => lane.id === "http")!
    );
    expect(spec).toContain("opentelemetry-specification@4ac49aa1e86633887f49ab1f58221b78b4888e24");
    expect(buildSemanticConventionsIndex(timeline)).toContain("never listed here");
  });

  async function publishCopy(authored: unknown) {
    const outDir = mkdtempSync(resolve(tmpdir(), "agent-docs-semconv-out-"));
    const publicCopy = mkdtempSync(resolve(tmpdir(), "agent-docs-semconv-public-"));
    mkdirSync(resolve(publicCopy, "data/semantic-conventions"), { recursive: true });
    writeFileSync(
      resolve(publicCopy, "data/semantic-conventions/timeline.json"),
      JSON.stringify(authored)
    );
    try {
      return await writeSemanticConventionsHistory(publicCopy, outDir);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
      rmSync(publicCopy, { recursive: true, force: true });
    }
  }

  it("needs only timeline.json, with no sidecar", async () => {
    const result = await publishCopy(timeline);
    expect(result.pages).toHaveLength(timeline.lanes.length + 1);
  });

  it("refuses to publish an invalid or malformed history", async () => {
    await expect(publishCopy({ ...timeline, schemaVersion: 99 })).rejects.toThrow(/schemaVersion/);
    const malformed = structuredClone(timeline) as unknown as { lanes: Record<string, unknown>[] };
    delete malformed.lanes[0].namespaces;
    await expect(publishCopy(malformed)).rejects.toThrow(/lanes\[0\]\.namespaces/);
    const misspelled = structuredClone(timeline);
    (misspelled.events[0] as { type: string }).type = "stablity";
    await expect(publishCopy(misspelled)).rejects.toThrow(/unknown type stablity/);
  });
});
