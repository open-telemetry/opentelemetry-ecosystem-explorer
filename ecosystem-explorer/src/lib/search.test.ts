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

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/javaagent-data", () => ({
  loadVersions: vi.fn(),
  loadAllInstrumentations: vi.fn(),
}));

vi.mock("@/lib/api/collector-data", () => ({
  loadVersions: vi.fn(),
  loadIndex: vi.fn(),
}));

describe("search", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("matches text across multiple fields case-insensitively", async () => {
    const { matchesSearch } = await import("./search");

    expect(matchesSearch("Kafka", "Kafka Client", "Messaging instrumentation")).toBe(true);
    expect(matchesSearch("kafka-client", "Kafka Client", "Messaging instrumentation")).toBe(false);
    expect(matchesSearch("", "Anything", "Else")).toBe(true);
  });

  it("searches the shared index across pages, instrumentations, and collector components", async () => {
    const javaagentData = await import("@/lib/api/javaagent-data");
    const collectorData = await import("@/lib/api/collector-data");

    vi.mocked(javaagentData.loadVersions).mockResolvedValue({
      versions: [{ version: "1.2.3", is_latest: true }],
    });
    vi.mocked(javaagentData.loadAllInstrumentations).mockResolvedValue([
      {
        name: "kafka-client",
        display_name: "Kafka Client",
        description: "Messaging instrumentation for Kafka",
        scope: { name: "kafka" },
      },
    ]);

    vi.mocked(collectorData.loadVersions).mockResolvedValue({
      versions: [{ version: "2.0.0", is_latest: true }],
    });
    vi.mocked(collectorData.loadIndex).mockResolvedValue({
      ecosystem: "collector",
      taxonomy: { distributions: ["core"], types: ["receiver"] },
      components: [
        {
          id: "core-receiver-otlp",
          name: "otlp",
          distribution: "core",
          type: "receiver",
          display_name: "OTLP Receiver",
          description: "Receives telemetry over OTLP",
          stability: "stable",
        },
      ],
    });

    const { search } = await import("./search");

    const javaAgentResults = await search("kafka");
    expect(javaAgentResults[0]).toMatchObject({
      title: "Kafka Client",
      path: "/java-agent/instrumentation/1.2.3/kafka-client",
      type: "item",
      ecosystem: "java-agent",
      version: "1.2.3",
    });
    // Java Agent items intentionally omit stability + componentType.
    expect(javaAgentResults[0].stability).toBeUndefined();
    expect(javaAgentResults[0].componentType).toBeUndefined();

    // The instrumentation path itself is searchable via its keywords.
    const pathQuery = "/java-agent/instrumentation/1.2.3/kafka-client";
    const pathResults = await search(pathQuery);
    expect(pathResults[0]).toMatchObject({
      title: "Kafka Client",
      path: pathQuery,
      type: "item",
    });

    const collectorResults = await search("otlp");
    expect(collectorResults[0]).toMatchObject({
      title: "OTLP Receiver",
      path: "/collector/components/core/otlp?version=2.0.0",
      type: "item",
      ecosystem: "collector",
      componentType: "receiver",
      stability: "stable",
      version: "2.0.0",
    });

    const pageResults = await search("collector");
    const pageHit = pageResults.find((result) => result.path === "/collector");
    expect(pageHit).toMatchObject({
      ecosystem: "page",
      type: "page",
    });
    // Pages have no version or stability or componentType.
    expect(pageHit?.version).toBeUndefined();
    expect(pageHit?.stability).toBeUndefined();
    expect(pageHit?.componentType).toBeUndefined();
  });

  it("returns undefined stability when the collector index omits it", async () => {
    const javaagentData = await import("@/lib/api/javaagent-data");
    const collectorData = await import("@/lib/api/collector-data");

    vi.mocked(javaagentData.loadVersions).mockResolvedValue({ versions: [] });
    vi.mocked(collectorData.loadVersions).mockResolvedValue({
      versions: [{ version: "9.9.9", is_latest: true }],
    });
    vi.mocked(collectorData.loadIndex).mockResolvedValue({
      ecosystem: "collector",
      taxonomy: { distributions: ["core"], types: ["receiver"] },
      components: [
        {
          id: "core-receiver-untagged",
          name: "untagged",
          distribution: "core",
          type: "receiver",
          display_name: "Untagged Receiver",
          description: "No stability in the index",
          stability: null,
        },
      ],
    });

    const { search } = await import("./search");
    const results = await search("untagged");
    expect(results[0]?.stability).toBeUndefined();
    expect(results[0]?.path).toBe("/collector/components/core/untagged?version=9.9.9");
  });

  it("returns an empty array for blank queries", async () => {
    const { search } = await import("./search");
    expect(await search("")).toEqual([]);
    expect(await search("   ")).toEqual([]);
  });

  it("falls back to an empty list when both data sources fail", async () => {
    const javaagentData = await import("@/lib/api/javaagent-data");
    const collectorData = await import("@/lib/api/collector-data");

    vi.mocked(javaagentData.loadVersions).mockRejectedValue(new Error("ja down"));
    vi.mocked(collectorData.loadVersions).mockRejectedValue(new Error("col down"));

    const { search } = await import("./search");
    const results = await search("collector");
    // The hardcoded page entries always remain available.
    expect(results.some((result) => result.path === "/collector")).toBe(true);
  });
});
