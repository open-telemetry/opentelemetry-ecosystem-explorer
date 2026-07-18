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
import {
  clampDescription,
  collectorDetailPath,
  instrumentationDetailPath,
  deriveCollectorMeta,
  deriveInstrumentationMeta,
  STATIC_ROUTE_META,
} from "./derive";

describe("clampDescription", () => {
  it("returns empty string for nullish/blank input", () => {
    expect(clampDescription(null)).toBe("");
    expect(clampDescription(undefined)).toBe("");
    expect(clampDescription("   ")).toBe("");
  });

  it("strips HTML and markdown and collapses whitespace", () => {
    const input = "See <b>the</b> [docs](https://x.io) for `config`\n\n## Heading  *emphasis*";
    expect(clampDescription(input)).toBe("See the docs for config Heading emphasis");
  });

  it("clamps long text at a word boundary with an ellipsis", () => {
    const long = "word ".repeat(60).trim();
    const result = clampDescription(long, 40);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toContain("wor…"); // clamped on a boundary, not mid-word
  });

  it("leaves short text untouched", () => {
    expect(clampDescription("Short and sweet.")).toBe("Short and sweet.");
  });
});

describe("canonical path builders", () => {
  it("builds a version-less Collector detail path", () => {
    expect(collectorDetailPath({ distribution: "contrib", name: "kafkareceiver" })).toBe(
      "/collector/components/contrib/kafkareceiver"
    );
  });

  it("builds a version-less instrumentation detail path", () => {
    expect(instrumentationDetailPath({ name: "kafka-clients-0.11" })).toBe(
      "/java-agent/instrumentation/kafka-clients-0.11"
    );
  });
});

describe("deriveCollectorMeta", () => {
  it("uses the display name and real description when present", () => {
    const meta = deriveCollectorMeta({
      id: "contrib-otlpreceiver",
      name: "otlpreceiver",
      distribution: "contrib",
      display_name: "OTLP Receiver",
      description: "Receives OTLP data.",
      type: "receiver",
      stability: "stable",
    });
    expect(meta.title).toBe("OTLP Receiver — OpenTelemetry Collector");
    expect(meta.description).toBe("Receives OTLP data.");
  });

  it("falls back to a templated description and the name when metadata is sparse", () => {
    const meta = deriveCollectorMeta({
      id: "core-xconnector",
      name: "xconnector",
      distribution: "core",
      display_name: null,
      description: null,
      type: "connector",
      stability: "alpha",
    });
    expect(meta.title).toBe("xconnector — OpenTelemetry Collector");
    expect(meta.description).toBe(
      "xconnector is a connector in the OpenTelemetry Collector core distribution (alpha)."
    );
  });
});

describe("deriveInstrumentationMeta", () => {
  it("uses the display name and description when present", () => {
    const meta = deriveInstrumentationMeta({
      name: "activej-http-6.0",
      display_name: "ActiveJ",
      description: "Enables HTTP server spans for ActiveJ.",
    });
    expect(meta.title).toBe("ActiveJ — OpenTelemetry Java Agent");
    expect(meta.description).toBe("Enables HTTP server spans for ActiveJ.");
  });

  it("falls back to a templated description and the name", () => {
    const meta = deriveInstrumentationMeta({ name: "some-lib-1.0" });
    expect(meta.title).toBe("some-lib-1.0 — OpenTelemetry Java Agent");
    expect(meta.description).toBe(
      "some-lib-1.0 auto-instrumentation for the OpenTelemetry Java agent."
    );
  });
});

describe("STATIC_ROUTE_META", () => {
  it("covers the fixed routes with non-empty titles and descriptions", () => {
    for (const [pathname, meta] of Object.entries(STATIC_ROUTE_META)) {
      expect(pathname.startsWith("/")).toBe(true);
      expect(meta.title.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
    expect(STATIC_ROUTE_META["/"]).toBeDefined();
  });
});
