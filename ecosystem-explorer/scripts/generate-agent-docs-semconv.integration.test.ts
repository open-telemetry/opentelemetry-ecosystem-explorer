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
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error -- untyped build script, imported for its pure builders.
import {
  buildSemanticConventionsDomainPage,
  buildSemanticConventionsIndex,
  writeSemanticConventionsHistory,
} from "./generate-agent-docs.mjs";
import { projectAcceptedHistory } from "../src/features/semantic-conventions/history/accepted-history";
import type { HistoryManifest, TimelineData } from "../src/features/semantic-conventions/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../public");
const dataDir = resolve(publicDir, "data/semantic-conventions");
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf-8"));
const timeline: TimelineData = readJson(resolve(dataDir, "timeline.json"));
const manifest: HistoryManifest = readJson(resolve(dataDir, "sources.json"));

async function generate() {
  const outDir = mkdtempSync(resolve(tmpdir(), "agent-docs-semconv-"));
  const result = await writeSemanticConventionsHistory(publicDir, outDir);
  return { outDir, result };
}

describe("agent docs: semantic-convention history", () => {
  it("publishes exactly the shared accepted-history projection", async () => {
    const { outDir } = await generate();
    try {
      const published = readJson(
        resolve(outDir, "data/semantic-conventions/accepted-history.json")
      );
      expect(published).toEqual(
        JSON.parse(JSON.stringify(projectAcceptedHistory(timeline, manifest)))
      );
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("includes every timeline event, including hidden detail events, with its ID and date", async () => {
    const { outDir } = await generate();
    try {
      const published = readJson(
        resolve(outDir, "data/semantic-conventions/accepted-history.json")
      );
      const events = published.lanes.flatMap(
        (lane: { events: { id: string; date: string }[] }) => lane.events
      );
      expect(events.map((e: { id: string }) => e.id).sort()).toEqual(
        timeline.events.map((e) => e.id).sort()
      );
      expect(timeline.events.some((e) => !e.major)).toBe(true);
      for (const original of timeline.events) {
        expect(events.find((e: { id: string }) => e.id === original.id).date).toBe(original.date);
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

  it("renders source-qualified releases, evidence and the migration, in date order", () => {
    const history = projectAcceptedHistory(timeline, manifest);
    const genai = history.lanes.find((lane) => lane.id === "genai")!;
    const page = buildSemanticConventionsDomainPage(genai);
    expect(page).toContain("moved from `semantic-conventions` to `semantic-conventions-genai`");
    expect(page).toContain("semantic-conventions@v1.42.0");
    expect(page).toContain("/commit/ebe3d1fb9fdda3398099e11ef91c4c490912f88d");
    const dates = [...page.matchAll(/^\| (\d{4}-\d\d-\d\d) \|/gm)].map((m) => m[1]);
    expect(dates).toEqual([...dates].sort());
    expect(buildSemanticConventionsIndex(history)).toContain("never listed here");
  });

  it("refuses to publish when the sidecar is invalid", async () => {
    const outDir = mkdtempSync(resolve(tmpdir(), "agent-docs-semconv-bad-"));
    const publicCopy = mkdtempSync(resolve(tmpdir(), "agent-docs-semconv-public-"));
    try {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(resolve(publicCopy, "data/semantic-conventions"), { recursive: true });
      writeFileSync(
        resolve(publicCopy, "data/semantic-conventions/timeline.json"),
        JSON.stringify(timeline)
      );
      writeFileSync(
        resolve(publicCopy, "data/semantic-conventions/sources.json"),
        JSON.stringify({ ...manifest, schemaVersion: 99 })
      );
      await expect(writeSemanticConventionsHistory(publicCopy, outDir)).rejects.toThrow(
        /schemaVersion/
      );
    } finally {
      rmSync(outDir, { recursive: true, force: true });
      rmSync(publicCopy, { recursive: true, force: true });
    }
  });
});
