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
import { describe, it, expect } from "vite-plus/test";
import type { PythonIndexPackage } from "@/types/python";
import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  activeFilterCount,
  applyFilters,
  computeCounts,
  describeReleases,
  detailPath,
  metricsFacet,
  paginate,
  parseFilters,
  resolveVersion,
  semconvFacet,
  semconvOptions,
  serializeFilters,
  sortRows,
  sourceUrl,
  toRow,
} from "./catalogue";

function entry(overrides: Partial<PythonIndexPackage> = {}): PythonIndexPackage {
  return {
    name: "opentelemetry-instrumentation-flask",
    description: "Flask instrumentation for OpenTelemetry",
    supports_metrics: true,
    semantic_convention_status: "migration",
    version: "0.66b2",
    releases: [
      { version: "0.66b2", hash: "aaa" },
      { version: "0.66b1", hash: "aaa" },
      { version: "0.66b0", hash: "bbb" },
    ],
    ...overrides,
  };
}

const rows = [
  entry({ name: "opentelemetry-instrumentation-flask" }),
  entry({
    name: "opentelemetry-instrumentation-click",
    description: "Click CLI instrumentation",
    supports_metrics: null,
    semantic_convention_status: null,
  }),
  entry({
    name: "opentelemetry-instrumentation-asyncpg",
    description: "Asyncpg instrumentation",
    supports_metrics: false,
    semantic_convention_status: null,
  }),
].map(toRow);

describe("metricsFacet and semconvFacet", () => {
  it("keeps null and undefined as unknown, never false", () => {
    expect(metricsFacet(true)).toBe("supported");
    expect(metricsFacet(false)).toBe("unsupported");
    expect(metricsFacet(null)).toBe("unknown");
    expect(metricsFacet(undefined)).toBe("unknown");
  });

  it("lowercases statuses and maps empty ones to unknown", () => {
    expect(semconvFacet("Migration")).toBe("migration");
    expect(semconvFacet(null)).toBe("unknown");
    expect(semconvFacet("  ")).toBe("unknown");
  });
});

describe("toRow", () => {
  it("uses the package name as the title and never invents a display name", () => {
    const row = toRow(entry());
    expect(row).toMatchObject({
      name: "opentelemetry-instrumentation-flask",
      version: "0.66b2",
      releaseCount: 3,
      metrics: "supported",
      semconv: "migration",
      href: "/python/instrumentation/opentelemetry-instrumentation-flask",
    });
    expect(row).not.toHaveProperty("displayName");
  });

  it("keeps a missing or blank description as null", () => {
    expect(toRow(entry({ description: null })).description).toBeNull();
    expect(toRow(entry({ description: "  " })).description).toBeNull();
  });

  it("encodes the name in the detail path", () => {
    expect(detailPath("a b/c")).toBe("/python/instrumentation/a%20b%2Fc");
  });
});

describe("parseFilters and serializeFilters", () => {
  it("returns the defaults for an empty query", () => {
    expect(parseFilters("")).toEqual(DEFAULT_FILTERS);
    expect(parseFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
  });

  it("reads every filter, accepting CSV and repeated params", () => {
    const filters = parseFilters(
      "?q=%20flask%20&metrics=supported,unknown&metrics=Unsupported&semconv=migration&page=2&density=table"
    );
    expect(filters).toEqual({
      q: "flask",
      metrics: ["supported", "unknown", "unsupported"],
      semconv: ["migration"],
      page: 2,
      density: "table",
    });
  });

  it("drops unknown metrics values and falls back on a bad page or density", () => {
    const filters = parseFilters("?metrics=bogus,supported&page=-3&density=wide");
    expect(filters.metrics).toEqual(["supported"]);
    expect(filters.page).toBe(1);
    expect(filters.density).toBe("compact");
    expect(parseFilters("?page=abc").page).toBe(1);
  });

  it("omits defaults and empty values when writing", () => {
    expect(serializeFilters(DEFAULT_FILTERS).toString()).toBe("");
    expect(serializeFilters({ q: "  flask ", page: 1 }).toString()).toBe("q=flask");
  });

  it("round-trips a full filter set", () => {
    const filters = {
      q: "flask",
      metrics: ["supported", "unknown"] as const,
      semconv: ["migration", "unknown"],
      page: 3,
      density: "cards" as const,
    };
    const qs = serializeFilters({ ...filters, metrics: [...filters.metrics] }).toString();
    expect(parseFilters(qs)).toEqual({ ...filters, metrics: [...filters.metrics] });
  });

  it("counts active filters, the search text included", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(
      activeFilterCount({ ...DEFAULT_FILTERS, q: "x", metrics: ["supported"], semconv: ["a", "b"] })
    ).toBe(4);
  });
});

describe("applyFilters, sortRows and counts", () => {
  it("searches the name and the description, ignoring case", () => {
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, q: "FLASK" })).toHaveLength(1);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, q: "cli" }).map((r) => r.name)).toEqual([
      "opentelemetry-instrumentation-click",
    ]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, q: "nothing-matches" })).toEqual([]);
  });

  it("filters metrics so unknown is not the same as unsupported", () => {
    const unknown = applyFilters(rows, { ...DEFAULT_FILTERS, metrics: ["unknown"] });
    const unsupported = applyFilters(rows, { ...DEFAULT_FILTERS, metrics: ["unsupported"] });
    expect(unknown.map((r) => r.name)).toEqual(["opentelemetry-instrumentation-click"]);
    expect(unsupported.map((r) => r.name)).toEqual(["opentelemetry-instrumentation-asyncpg"]);
  });

  it("ORs values within a facet and ANDs across facets and search", () => {
    const either = applyFilters(rows, { ...DEFAULT_FILTERS, metrics: ["supported", "unknown"] });
    expect(either).toHaveLength(2);
    const both = applyFilters(rows, {
      ...DEFAULT_FILTERS,
      metrics: ["supported", "unknown"],
      semconv: ["migration"],
    });
    expect(both.map((r) => r.name)).toEqual(["opentelemetry-instrumentation-flask"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, metrics: ["supported"], q: "click" })).toEqual(
      []
    );
  });

  it("filters semantic-convention status, with null as unknown", () => {
    const unknown = applyFilters(rows, { ...DEFAULT_FILTERS, semconv: ["unknown"] });
    expect(unknown).toHaveLength(2);
  });

  it("sorts by name without mutating the input", () => {
    const sorted = sortRows(rows);
    expect(sorted.map((r) => r.name)).toEqual([
      "opentelemetry-instrumentation-asyncpg",
      "opentelemetry-instrumentation-click",
      "opentelemetry-instrumentation-flask",
    ]);
    expect(rows[0].name).toBe("opentelemetry-instrumentation-flask");
  });

  it("counts every package once per facet", () => {
    expect(computeCounts(rows)).toEqual({
      metrics: { supported: 1, unsupported: 1, unknown: 1 },
      semconv: { migration: 1, unknown: 2 },
    });
  });

  it("lists the statuses present with unknown last", () => {
    expect(semconvOptions(rows)).toEqual(["migration", "unknown"]);
    expect(semconvOptions([])).toEqual([]);
  });

  it("offers no semantic-convention facet when every status is unknown", () => {
    expect(semconvOptions(rows.filter((r) => r.semconv === "unknown"))).toEqual([]);
  });
});

describe("paginate", () => {
  const many = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => i);

  it("shows the whole 51-package catalogue on one page", () => {
    expect(
      paginate(
        Array.from({ length: 51 }, (_, i) => i),
        1
      ).totalPages
    ).toBe(1);
  });

  it("pages beyond the page size and clamps an out-of-range page", () => {
    expect(paginate(many, 1)).toMatchObject({ page: 1, totalPages: 2 });
    expect(paginate(many, 1).items).toHaveLength(PAGE_SIZE);
    expect(paginate(many, 2).items).toEqual([PAGE_SIZE]);
    expect(paginate(many, 99).page).toBe(2);
    expect(paginate(many, 0).page).toBe(1);
    expect(paginate([], 1)).toEqual({ items: [], page: 1, totalPages: 1 });
  });
});

describe("sourceUrl", () => {
  it("builds the package directory link from repository and source_path", () => {
    expect(
      sourceUrl({
        repository: "open-telemetry/opentelemetry-python-contrib",
        source_path: "instrumentation/opentelemetry-instrumentation-flask",
      })
    ).toBe(
      "https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation/opentelemetry-instrumentation-flask"
    );
  });

  it("returns null when either field is missing", () => {
    expect(sourceUrl({ repository: "a/b" })).toBeNull();
    expect(sourceUrl({ source_path: "instrumentation/x" })).toBeNull();
    expect(sourceUrl({})).toBeNull();
  });

  it.each([
    ["a/b", "../etc"],
    ["a/b", "instrumentation/../x"],
    ["a/b", "/absolute"],
    ["a/b", "x//y"],
    ["a/b", "x y"],
    ["not a repo", "instrumentation/x"],
    ["a/b/c", "instrumentation/x"],
    ["javascript:alert(1)//x", "instrumentation/x"],
  ])("never turns %s + %s into a link", (repository, source_path) => {
    expect(sourceUrl({ repository, source_path })).toBeNull();
  });
});

describe("describeReleases and resolveVersion", () => {
  const releases = entry().releases;

  it("flags the latest release and the ones that share its metadata", () => {
    expect(describeReleases(releases)).toEqual([
      { version: "0.66b2", hash: "aaa", isLatest: true, sameAsLatest: false },
      { version: "0.66b1", hash: "aaa", isLatest: false, sameAsLatest: true },
      { version: "0.66b0", hash: "bbb", isLatest: false, sameAsLatest: false },
    ]);
    expect(describeReleases([])).toEqual([]);
  });

  it("uses the latest release when no version, or latest, is requested", () => {
    expect(resolveVersion(releases, null)).toEqual({ version: "0.66b2", invalid: false });
    expect(resolveVersion(releases, "latest")).toEqual({ version: "0.66b2", invalid: false });
  });

  it("accepts a real release and flags an unknown one while falling back to latest", () => {
    expect(resolveVersion(releases, "0.66b0")).toEqual({ version: "0.66b0", invalid: false });
    expect(resolveVersion(releases, "9.9")).toEqual({ version: "0.66b2", invalid: true });
  });

  it("returns null for a package with no releases", () => {
    expect(resolveVersion([], "0.66b0")).toBeNull();
  });
});
