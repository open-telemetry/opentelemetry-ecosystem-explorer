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
  loadAllComponents: vi.fn(),
}));

describe("search", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("matches text across multiple fields", async () => {
    const { matchesSearch } = await import("./search");

    expect(matchesSearch("Kafka", "Kafka Client", "Messaging instrumentation")).toBe(true);
    expect(matchesSearch("kafka-client", "Kafka Client", "Messaging instrumentation")).toBe(false);
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
    vi.mocked(collectorData.loadAllComponents).mockResolvedValue([
      {
        id: "core-receiver-otlp",
        name: "otlp",
        ecosystem: "collector",
        type: "receiver",
        distribution: "core",
        display_name: "OTLP Receiver",
        description: "Receives telemetry over OTLP",
      },
    ]);

    const { search } = await import("./search");

    const javaAgentResults = await search("kafka");
    expect(javaAgentResults[0]).toMatchObject({
      title: "Kafka Client",
      path: "/java-agent/instrumentation/1.2.3/kafka-client",
      type: "item",
    });

    // ensure the instrumentation path itself is searchable
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
    });

    const pageResults = await search("collector");
    expect(pageResults.some((result) => result.path === "/collector")).toBe(true);
  });
});
