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
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as collectorData from "@/lib/api/collector-data";
import * as javaagentData from "@/lib/api/javaagent-data";
import { useEcosystemLandingData } from "./use-ecosystem-landing-data";

vi.mock("@/lib/api/collector-data");
vi.mock("@/lib/api/javaagent-data");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useEcosystemLandingData — collector", () => {
  beforeEach(() => {
    // index.json grouped by `type` → stage counts keyed by the stage ids.
    vi.mocked(collectorData.loadIndex).mockResolvedValue({
      ecosystem: "collector",
      taxonomy: { distributions: ["core", "contrib"], types: ["receiver"] },
      components: [
        { id: "a", name: "a", distribution: "core", type: "receiver" },
        { id: "b", name: "b", distribution: "core", type: "receiver" },
        { id: "c", name: "c", distribution: "core", type: "processor" },
        { id: "d", name: "d", distribution: "contrib", type: "exporter" },
      ],
    });
    vi.mocked(collectorData.loadVersions).mockResolvedValue({
      versions: [
        { version: "0.154.0", is_latest: true },
        { version: "0.153.0", is_latest: false },
      ],
    });
    // Two manifests (id → content-hash). Latest adds `c-new`, changes `b`'s
    // hash, leaves `a` untouched.
    vi.mocked(collectorData.loadVersionManifest).mockImplementation(async (version: string) => {
      const components: Record<string, string> =
        version === "0.154.0" ? { a: "h1", b: "h2-new", "c-new": "h3" } : { a: "h1", b: "h2-old" };
      return { version, components };
    });
    // Latest bundle marks one component deprecated and one unmaintained.
    vi.mocked(collectorData.loadAllComponents).mockResolvedValue([
      { id: "a", name: "a", distribution: "core", type: "receiver", stability: "stable" },
      { id: "b", name: "b", distribution: "core", type: "receiver", stability: "deprecated" },
      {
        id: "c-new",
        name: "c-new",
        distribution: "core",
        type: "processor",
        stability: "unmaintained",
      },
    ]);
  });

  it("groups index by type and diffs the two latest manifests into release deltas", async () => {
    const { result } = renderHook(() => useEcosystemLandingData("collector", {}));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.data?.stageCounts).toEqual({
      receiver: 2,
      processor: 1,
      exporter: 1,
    });
    expect(result.current.data?.release.version).toBe("v0.154.0");
    // added: `c-new` is new in latest; changed: `b`'s hash moved; deprecated:
    // the bundle's deprecated + unmaintained entries.
    expect(result.current.data?.release.deltas).toEqual({ added: 1, changed: 1, deprecated: 2 });
  });

  it("surfaces an error when a loader rejects", async () => {
    vi.mocked(collectorData.loadIndex).mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useEcosystemLandingData("collector", {}));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.data).toBeNull();
  });
});

describe("useEcosystemLandingData — java-agent", () => {
  it("counts instrumentations per stage with the list page's substring match and omits deltas", async () => {
    vi.mocked(javaagentData.loadVersions).mockResolvedValue({
      versions: [{ version: "2.28.1", is_latest: true }],
    });
    vi.mocked(javaagentData.loadAllInstrumentations).mockResolvedValue([
      // matches "http" by name
      mkInstr("apache-httpclient-4.3"),
      // matches "http" by description
      mkInstr("foo", "Foo", "Adds HTTP server spans"),
      // matches "db" by name (substring), not "http"
      mkInstr("jdbc-1.0", "JDBC Database"),
      // matches nothing
      mkInstr("runtime-telemetry", "Runtime Telemetry"),
    ]);

    const { result } = renderHook(() =>
      useEcosystemLandingData("java-agent", { http: "http", db: "db", runtime: "runtime" })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.stageCounts).toEqual({ http: 2, db: 1, runtime: 1 });
    expect(result.current.data?.release.version).toBe("v2.28.1");
    // No stability field on instrumentations → version-only release card.
    expect(result.current.data?.release.deltas).toBeNull();
  });
});

function mkInstr(name: string, display_name?: string, description?: string) {
  return {
    name,
    display_name,
    description,
    scope: { name },
    has_spans: false,
    has_metrics: false,
    _is_custom: false,
  };
}
