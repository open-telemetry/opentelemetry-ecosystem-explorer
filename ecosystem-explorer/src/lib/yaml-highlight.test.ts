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
import { tokenize, type Token, type TokenKind } from "./yaml-highlight";

function kinds(line: Token[]): TokenKind[] {
  return line.map((t) => t.kind);
}

function reassemble(lines: Token[][]): string {
  return lines.map((tokens) => tokens.map((t) => t.text).join("")).join("\n");
}

describe("tokenize", () => {
  it("returns [] for empty input", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("classifies a comment-only line", () => {
    const [line] = tokenize("# header comment");
    expect(kinds(line)).toEqual(["comment"]);
    expect(line[0].text).toBe("# header comment");
  });

  it("classifies key + quoted string value", () => {
    const [line] = tokenize('endpoint: "https://otel.example/v1/traces"');
    expect(kinds(line)).toEqual(["key", "punct", "ws", "string"]);
    expect(line[0].text).toBe("endpoint");
    expect(line[1].text).toBe(":");
    expect(line[3].text).toBe('"https://otel.example/v1/traces"');
  });

  it("classifies key + unquoted plain scalar", () => {
    const [line] = tokenize("compression: gzip");
    expect(kinds(line)).toEqual(["key", "punct", "ws", "plain"]);
  });

  it("classifies key + integer / decimal / negative number", () => {
    expect(kinds(tokenize("count: 5")[0])).toEqual(["key", "punct", "ws", "number"]);
    expect(kinds(tokenize("ratio: 0.25")[0])).toEqual(["key", "punct", "ws", "number"]);
    expect(kinds(tokenize("delta: -3")[0])).toEqual(["key", "punct", "ws", "number"]);
  });

  it("classifies true / false / null / ~ as keyword", () => {
    expect(kinds(tokenize("enabled: true")[0])).toEqual(["key", "punct", "ws", "keyword"]);
    expect(kinds(tokenize("debug: false")[0])).toEqual(["key", "punct", "ws", "keyword"]);
    expect(kinds(tokenize("limit: null")[0])).toEqual(["key", "punct", "ws", "keyword"]);
    expect(kinds(tokenize("limit: ~")[0])).toEqual(["key", "punct", "ws", "keyword"]);
  });

  it("classifies key with empty value (null-as-empty)", () => {
    const [line] = tokenize("attribute_value_length_limit:");
    expect(kinds(line)).toEqual(["key", "punct"]);
    expect(line[0].text).toBe("attribute_value_length_limit");
    expect(line[1].text).toBe(":");
  });

  it("preserves leading whitespace as ws token", () => {
    const [line] = tokenize("    nested_key: value");
    expect(kinds(line)).toEqual(["ws", "key", "punct", "ws", "plain"]);
    expect(line[0].text).toBe("    ");
  });

  it("classifies list dash as punct then recurses on rest", () => {
    const [line] = tokenize("  - name: service.name");
    expect(kinds(line)).toEqual(["ws", "punct", "ws", "key", "punct", "ws", "plain"]);
  });

  it("preserves a URL value containing colons as plain", () => {
    const yaml = "endpoint: http://localhost:4318/v1/traces";
    const [line] = tokenize(yaml);
    expect(kinds(line)).toEqual(["key", "punct", "ws", "plain"]);
    expect(line[3].text).toBe("http://localhost:4318/v1/traces");
  });

  it("splits an inline trailing comment off the value", () => {
    const [line] = tokenize("count: 5  # tail");
    expect(kinds(line)).toEqual(["key", "punct", "ws", "number", "comment"]);
    expect(line[4].text).toBe("  # tail");
  });

  it("classifies a quoted key as 'key' (not as a string starting the line)", () => {
    const [line] = tokenize('"odd:key": value');
    expect(kinds(line)).toEqual(["key", "punct", "ws", "plain"]);
    expect(line[0].text).toBe('"odd:key"');
  });

  it("does not classify capitalized or mixed-case scalars as keywords", () => {
    expect(kinds(tokenize("name: True")[0])).toEqual(["key", "punct", "ws", "plain"]);
    expect(kinds(tokenize("name: NULL")[0])).toEqual(["key", "punct", "ws", "plain"]);
  });

  it("round-trip on a hand-curated representative sample", () => {
    const samples = [
      "# OpenTelemetry SDK Configuration",
      'file_format: "1.0"',
      "resource:",
      "  attributes:",
      "    - name: service.name",
      "      value: unknown_service",
      "tracer_provider:",
      "  processors:",
      "    - batch:",
      "        schedule_delay: 5000",
      "        exporter:",
      "          otlp_http:",
      "            endpoint: http://localhost:4318/v1/traces",
      "            timeout: 10000",
      "            compression: gzip",
      "            headers:",
      '              api-key: "$OTEL_EXPORTER_OTLP_HEADERS"',
      "  limits:",
      "    attribute_count_limit: 128",
      "    attribute_value_length_limit:",
      "propagator:",
      "  composite:",
      "    - tracecontext:",
      "    - baggage:",
      "instrumentation:",
      "  java:",
      "    enabled: true",
      "    debug: false",
      "    log_level: info",
      '"odd:key": value',
      "",
    ];
    const yaml = samples.join("\n");
    expect(reassemble(tokenize(yaml))).toBe(yaml);
  });

  it("round-trip on every js-yaml dump of representative emitter input", async () => {
    const { dump } = await import("js-yaml");
    const inputs = [
      { resource: { attributes: [{ name: "service.name", value: "x" }] } },
      { tracer_provider: { processors: [{ batch: { schedule_delay: 5000 } }] } },
      { exporter: { otlp_http: { endpoint: "http://x:4318/v1/t", compression: "gzip" } } },
      { logger_provider: { loggers: [] } },
      { propagator: { composite: ["tracecontext", "baggage"] } },
      { instrumentation: { java: { enabled: true, debug: false, log_level: "info" } } },
    ];
    for (const input of inputs) {
      const yaml = dump(input, { lineWidth: -1, noRefs: true, quotingType: '"' });
      expect(reassemble(tokenize(yaml))).toBe(yaml);
    }
  });
});
