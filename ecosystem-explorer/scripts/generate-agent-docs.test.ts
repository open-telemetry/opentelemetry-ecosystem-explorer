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
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error -- untyped build script, imported for its pure page builders.
import {
  buildJavaInstrumentationPage,
  buildCollectorComponentPage,
} from "./generate-agent-docs.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../public/data");
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf-8"));

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

/**
 * Corpus fidelity assertion: every metric name, span kind, and `when` condition
 * present in the source JSON must survive into the generated Markdown. This is
 * the check that would have caught the flattening and the missing Collector
 * metrics at build time.
 */
describe("agent docs: fidelity against the registry corpus", () => {
  const latestVersion = (ecosystem: string): string => {
    const { versions } = readJson(resolve(dataDir, ecosystem, "versions-index.json"));
    return versions.find((v: { is_latest: boolean }) => v.is_latest).version;
  };

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
