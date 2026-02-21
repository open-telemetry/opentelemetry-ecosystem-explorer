import { describe, it, expect } from "vitest";
import { groupInstrumentationsByDisplayName } from "./group-instrumentations";
import type { InstrumentationData } from "@/types/javaagent";

function makeInstr(
  overrides: Partial<InstrumentationData> & { name: string }
): InstrumentationData {
  return { scope: { name: "test" }, ...overrides };
}

describe("groupInstrumentationsByDisplayName", () => {
  it("returns empty array for empty input", () => {
    expect(groupInstrumentationsByDisplayName([])).toEqual([]);
  });

  it("groups instrumentations with the same explicit display_name", () => {
    const instrumentations: InstrumentationData[] = [
      makeInstr({ name: "apache-httpclient-4.0", display_name: "Apache HttpClient" }),
      makeInstr({ name: "apache-httpclient-5.0", display_name: "Apache HttpClient" }),
    ];

    const groups = groupInstrumentationsByDisplayName(instrumentations);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("Apache HttpClient");
    expect(groups[0].instrumentations).toHaveLength(2);
    expect(groups[0].instrumentations[0].name).toBe("apache-httpclient-4.0");
    expect(groups[0].instrumentations[1].name).toBe("apache-httpclient-5.0");
  });

  it("groups instrumentations by fallback name when display_name is absent", () => {
    const instrumentations: InstrumentationData[] = [
      makeInstr({ name: "spring-web-3.1" }),
      makeInstr({ name: "spring-web-6.0" }),
    ];

    const groups = groupInstrumentationsByDisplayName(instrumentations);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("Spring Web");
    expect(groups[0].instrumentations).toHaveLength(2);
  });

  it("keeps singletons as groups with one member", () => {
    const instrumentations: InstrumentationData[] = [
      makeInstr({ name: "jdbc", display_name: "JDBC" }),
    ];

    const groups = groupInstrumentationsByDisplayName(instrumentations);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("JDBC");
    expect(groups[0].instrumentations).toHaveLength(1);
  });

  it("does not group instrumentations with different display names", () => {
    const instrumentations: InstrumentationData[] = [
      makeInstr({ name: "spring-web-3.1" }),
      makeInstr({ name: "spring-webmvc-3.1" }),
      makeInstr({ name: "spring-webflux-5.0" }),
    ];

    const groups = groupInstrumentationsByDisplayName(instrumentations);

    expect(groups).toHaveLength(3);
    const names = groups.map((g) => g.displayName);
    expect(names).toContain("Spring Web");
    expect(names).toContain("Spring Webmvc");
    expect(names).toContain("Spring Webflux");
  });

  it("sorts groups alphabetically by display name", () => {
    const instrumentations: InstrumentationData[] = [
      makeInstr({ name: "zookeeper", display_name: "Zookeeper" }),
      makeInstr({ name: "akka-actor-2.3", display_name: "Akka Actors" }),
      makeInstr({ name: "jdbc", display_name: "JDBC" }),
    ];

    const groups = groupInstrumentationsByDisplayName(instrumentations);

    expect(groups.map((g) => g.displayName)).toEqual(["Akka Actors", "JDBC", "Zookeeper"]);
  });

  it("sorts instrumentations within a group alphabetically by name", () => {
    const instrumentations: InstrumentationData[] = [
      makeInstr({ name: "mongo-4.0", display_name: "MongoDB Driver" }),
      makeInstr({ name: "mongo-3.1", display_name: "MongoDB Driver" }),
      makeInstr({ name: "mongo-3.7", display_name: "MongoDB Driver" }),
    ];

    const groups = groupInstrumentationsByDisplayName(instrumentations);

    expect(groups[0].instrumentations.map((i) => i.name)).toEqual([
      "mongo-3.1",
      "mongo-3.7",
      "mongo-4.0",
    ]);
  });

  it("handles mixed explicit and fallback names that resolve to the same display name", () => {
    const instrumentations: InstrumentationData[] = [
      makeInstr({ name: "servlet-2.2", display_name: "Servlet" }),
      makeInstr({ name: "servlet-3.0", display_name: "Servlet" }),
      makeInstr({ name: "servlet-5.0", display_name: "Servlet" }),
    ];

    const groups = groupInstrumentationsByDisplayName(instrumentations);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("Servlet");
    expect(groups[0].instrumentations).toHaveLength(3);
  });

  it("produces both groups and singletons in correct sorted order", () => {
    const instrumentations: InstrumentationData[] = [
      makeInstr({ name: "netty-4.1", display_name: "Netty HTTP codec" }),
      makeInstr({ name: "jdbc", display_name: "JDBC" }),
      makeInstr({ name: "netty-4.0", display_name: "Netty HTTP codec" }),
      makeInstr({ name: "akka-actor-2.3", display_name: "Akka Actors" }),
    ];

    const groups = groupInstrumentationsByDisplayName(instrumentations);

    expect(groups).toHaveLength(3);
    expect(groups[0].displayName).toBe("Akka Actors");
    expect(groups[0].instrumentations).toHaveLength(1);
    expect(groups[1].displayName).toBe("JDBC");
    expect(groups[1].instrumentations).toHaveLength(1);
    expect(groups[2].displayName).toBe("Netty HTTP codec");
    expect(groups[2].instrumentations).toHaveLength(2);
  });

  it("preserves all instrumentation data fields through grouping", () => {
    const original: InstrumentationData = {
      name: "kafka-clients-0.11",
      display_name: "Apache Kafka Client",
      description: "Kafka instrumentation",
      scope: { name: "io.opentelemetry.kafka-clients-0.11" },
      tags: ["kafka"],
      javaagent_target_versions: ["Java 8+"],
      has_standalone_library: true,
      telemetry: [{ when: "default", spans: [{ span_kind: "PRODUCER" }] }],
    };

    const groups = groupInstrumentationsByDisplayName([original]);

    const result = groups[0].instrumentations[0];
    expect(result).toEqual(original);
  });
});
