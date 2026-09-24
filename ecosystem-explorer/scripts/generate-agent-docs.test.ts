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
// @ts-expect-error -- untyped build script, imported for its pure page builders.
import {
  buildJavaInstrumentationPage,
  buildCollectorComponentPage,
  collectorSignals,
  javaSignals,
} from "./generate-agent-docs.mjs";

describe("agent docs: Java telemetry rendering", () => {
  // Mirrors Apache Dubbo: two `when` groups whose metrics are mutually
  // exclusive. Flattening them into one list is the bug this guards.
  const instr = {
    name: "apache-dubbo-2.7",
    display_name: "Apache Dubbo",
    telemetry: [
      {
        when: "default",
        metrics: [
          {
            name: "rpc.client.duration",
            instrument: "histogram",
            data_type: "HISTOGRAM",
            unit: "ms",
            description: "The duration of an outbound RPC invocation.",
            attributes: [{ name: "server.port", type: "LONG" }],
          },
        ],
        spans: [{ span_kind: "CLIENT", attributes: [{ name: "peer.service", type: "STRING" }] }],
      },
      {
        when: "otel.semconv-stability.opt-in=rpc",
        metrics: [
          {
            name: "rpc.client.call.duration",
            instrument: "histogram",
            data_type: "HISTOGRAM",
            unit: "s",
            description: "Measures the duration of outbound RPC.",
          },
        ],
        spans: [{ span_kind: "SERVER", attributes: [{ name: "error.type", type: "STRING" }] }],
      },
    ],
  };

  it("emits one subsection per `when` condition", () => {
    const md = buildJavaInstrumentationPage(instr, "/data/x.json");
    expect(md).toContain("### When `default`");
    expect(md).toContain("### When `otel.semconv-stability.opt-in=rpc`");
  });

  it("keeps each metric under its own `when`, not unioned across groups", () => {
    const md = buildJavaInstrumentationPage(instr, "/data/x.json");
    const defaultSection = md.slice(
      md.indexOf("### When `default`"),
      md.indexOf("### When `otel.semconv-stability.opt-in=rpc`")
    );
    expect(defaultSection).toContain("rpc.client.duration");
    expect(defaultSection).not.toContain("rpc.client.call.duration");
  });

  it("carries the metric fields the flat rendering discarded", () => {
    const md = buildJavaInstrumentationPage(instr, "/data/x.json");
    expect(md).toContain("| `rpc.client.duration` | histogram | HISTOGRAM | ms |");
    expect(md).toContain("The duration of an outbound RPC invocation.");
  });

  it("attaches attributes to their own span kind", () => {
    const md = buildJavaInstrumentationPage(instr, "/data/x.json");
    expect(md).toContain("| CLIENT | `peer.service` (STRING) |");
    expect(md).toContain("| SERVER | `error.type` (STRING) |");
  });

  it("omits the Telemetry section when there is no telemetry", () => {
    expect(buildJavaInstrumentationPage({ name: "x" }, "/data/x.json")).not.toContain(
      "## Telemetry"
    );
  });
});

describe("agent docs: Collector metric rendering", () => {
  const attributes = { topic: { type: "string", description: "The Kafka topic." } };

  it("renders `telemetry.metrics` (a component's internal metrics)", () => {
    const md = buildCollectorComponentPage(
      {
        name: "kafkareceiver",
        distribution: "contrib",
        attributes,
        telemetry: {
          metrics: {
            kafka_broker_closed: {
              description: "The total number of connections closed.",
              enabled: true,
              unit: "1",
              stability: "development",
              sum: { monotonic: true, value_type: "int" },
              attributes: ["topic"],
            },
          },
        },
      },
      "/data/x.json"
    );
    expect(md).toContain("## Internal telemetry");
    expect(md).toContain("| `kafka_broker_closed` | sum (monotonic) | int | 1 | development |");
    // Attribute keys are resolved against the component-level attributes map.
    expect(md).toContain("`topic` (string)");
  });

  it("renders top-level `metrics` (what the component scrapes)", () => {
    const md = buildCollectorComponentPage(
      {
        name: "apachereceiver",
        distribution: "contrib",
        attributes,
        metrics: {
          "apache.cpu.load": {
            description: "Current load of the CPU.",
            enabled: true,
            unit: "%",
            stability: "development",
            gauge: { value_type: "double" },
          },
        },
      },
      "/data/x.json"
    );
    expect(md).toContain("## Metrics");
    expect(md).toContain("| `apache.cpu.load` | gauge | double | % | development |");
  });

  it("omits both sections when the component has no metrics", () => {
    const md = buildCollectorComponentPage({ name: "x", distribution: "core" }, "/data/x.json");
    expect(md).not.toContain("## Metrics");
    expect(md).not.toContain("## Internal telemetry");
  });
});

describe("agent docs: stable JSON alias", () => {
  it("links the latest.json alias alongside the pinned hashed URL (Collector)", () => {
    const md = buildCollectorComponentPage(
      { id: "kafkareceiver", name: "kafkareceiver", distribution: "contrib" },
      "/data/collector/components/kafkareceiver/kafkareceiver-abc123def456.json",
      "/data/collector/components/kafkareceiver/latest.json"
    );
    expect(md).toContain(
      "- **JSON (latest)**: [/data/collector/components/kafkareceiver/latest.json]"
    );
    expect(md).toContain(
      "- **JSON (pinned)**: [/data/collector/components/kafkareceiver/kafkareceiver-abc123def456.json]"
    );
  });

  it("links the latest.json alias alongside the pinned hashed URL (Java agent)", () => {
    const md = buildJavaInstrumentationPage(
      { name: "apache-dubbo-2.7" },
      "/data/javaagent/instrumentations/apache-dubbo-2.7/apache-dubbo-2.7-abc123def456.json",
      "/data/javaagent/instrumentations/apache-dubbo-2.7/latest.json"
    );
    expect(md).toContain(
      "- **JSON (latest)**: [/data/javaagent/instrumentations/apache-dubbo-2.7/latest.json]"
    );
    expect(md).toContain(
      "- **JSON (pinned)**: [/data/javaagent/instrumentations/apache-dubbo-2.7/"
    );
  });

  it("omits the alias line when no alias is supplied", () => {
    const md = buildCollectorComponentPage({ name: "x", distribution: "core" }, "/data/x.json");
    expect(md).not.toContain("**JSON (latest)**");
    expect(md).toContain("- **JSON (pinned)**: [/data/x.json](/data/x.json)");
  });
});

describe("agent docs: signal facets", () => {
  it("unions a Collector component's signals across stability levels", () => {
    expect(
      collectorSignals({
        status: { stability: { beta: ["logs", "metrics", "traces"], development: ["profiles"] } },
      })
    ).toEqual(["logs", "metrics", "profiles", "traces"]);
  });

  it("returns no Collector signals when stability is absent or malformed", () => {
    expect(collectorSignals({})).toEqual([]);
    expect(collectorSignals({ status: { stability: "beta" } })).toEqual([]);
    // A malformed level contributes nothing rather than a non-signal entry.
    expect(
      collectorSignals({
        status: { stability: { beta: "logs", development: [1, null, "traces"] } },
      })
    ).toEqual(["traces"]);
  });

  it("reports the telemetry kinds a Java instrumentation emits", () => {
    expect(
      javaSignals({ telemetry: [{ when: "default", spans: [{ span_kind: "CLIENT" }] }] })
    ).toEqual(["spans"]);
    expect(
      javaSignals({
        telemetry: [
          { when: "default", metrics: [{ name: "a" }] },
          { when: "opt-in", spans: [{ span_kind: "SERVER" }] },
        ],
      })
    ).toEqual(["metrics", "spans"]);
    expect(javaSignals({ telemetry: [{ when: "default", metrics: [], spans: [] }] })).toEqual([]);
  });
});
