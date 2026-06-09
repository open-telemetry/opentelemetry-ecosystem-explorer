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
  loadIndex: vi.fn(),
}));

vi.mock("@/lib/api/collector-data", () => ({
  loadVersions: vi.fn(),
  loadIndex: vi.fn(),
}));

describe("search (orchestration)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("composes pages, instrumentations, and collector components into one ranked index", async () => {
    const javaagentData = await import("@/lib/api/javaagent-data");
    const collectorData = await import("@/lib/api/collector-data");

    vi.mocked(javaagentData.loadVersions).mockResolvedValue({
      versions: [{ version: "1.2.3", is_latest: true }],
    });
    vi.mocked(javaagentData.loadIndex).mockResolvedValue({
      ecosystem: "javaagent",
      components: [
        {
          name: "kafka-client",
          display_name: "Kafka Client",
          description: "Messaging instrumentation for Kafka",
          search_terms: ["Messaging instrumentation for Kafka"],
        },
      ],
    });

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

    const { search } = await import("./search-index");

    // Java Agent source flows through end-to-end.
    const javaAgentResults = await search("kafka");
    expect(javaAgentResults[0]).toMatchObject({
      title: "Kafka Client",
      path: "/java-agent/instrumentation/1.2.3/kafka-client",
      type: "item",
      ecosystem: "java-agent",
      version: "1.2.3",
    });

    // The instrumentation path itself is searchable via its keywords.
    const pathQuery = "/java-agent/instrumentation/1.2.3/kafka-client";
    const pathResults = await search(pathQuery);
    expect(pathResults[0]).toMatchObject({ title: "Kafka Client", path: pathQuery, type: "item" });

    // Collector source flows through end-to-end, facet and stability intact.
    const collectorResults = await search("otlp");
    expect(collectorResults[0]).toMatchObject({
      title: "OTLP Receiver",
      path: "/collector/components/core/otlp?version=2.0.0",
      type: "item",
      ecosystem: "collector",
      facets: ["receiver"],
      stability: "stable",
      version: "2.0.0",
    });

    // The static page surface is always present.
    const pageResults = await search("collector");
    expect(pageResults.find((result) => result.path === "/collector")).toMatchObject({
      ecosystem: "page",
      type: "page",
    });
  });

  it("returns an empty array for blank queries", async () => {
    const { search } = await import("./search-index");
    expect(await search("")).toEqual([]);
    expect(await search("   ")).toEqual([]);
  });

  it("still serves the page surface when every data source fails", async () => {
    const javaagentData = await import("@/lib/api/javaagent-data");
    const collectorData = await import("@/lib/api/collector-data");

    vi.mocked(javaagentData.loadVersions).mockRejectedValue(new Error("ja down"));
    vi.mocked(collectorData.loadVersions).mockRejectedValue(new Error("col down"));

    const { search } = await import("./search-index");
    const results = await search("collector");
    // The hardcoded page entries always remain available.
    expect(results.some((result) => result.path === "/collector")).toBe(true);
  });

  it("does not cache a partial failure — the next search retries the failed source", async () => {
    const javaagentData = await import("@/lib/api/javaagent-data");
    const collectorData = await import("@/lib/api/collector-data");

    // Collector stays healthy throughout (empty index keeps the assertion focused).
    vi.mocked(collectorData.loadVersions).mockResolvedValue({
      versions: [{ version: "2.0.0", is_latest: true }],
    });
    vi.mocked(collectorData.loadIndex).mockResolvedValue({
      ecosystem: "collector",
      taxonomy: { distributions: [], types: [] },
      components: [],
    });

    // Java Agent fails on the first build, then recovers.
    vi.mocked(javaagentData.loadVersions)
      .mockRejectedValueOnce(new Error("ja down"))
      .mockResolvedValue({ versions: [{ version: "1.2.3", is_latest: true }] });
    vi.mocked(javaagentData.loadIndex).mockResolvedValue({
      ecosystem: "javaagent",
      components: [
        {
          name: "kafka-client",
          display_name: "Kafka Client",
          description: "Messaging instrumentation for Kafka",
          search_terms: ["Messaging instrumentation for Kafka"],
        },
      ],
    });

    const { search } = await import("./search-index");

    // First query builds with Java Agent down → no kafka result, cache dropped.
    expect(await search("kafka")).toEqual([]);

    // Second query rebuilds (cache was not poisoned) and now finds kafka.
    const recovered = await search("kafka");
    expect(recovered[0]).toMatchObject({ title: "Kafka Client", ecosystem: "java-agent" });
  });
});
