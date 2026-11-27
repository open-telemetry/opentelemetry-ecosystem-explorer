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

/*
 * Pure catalogue logic for the Python instrumentation list and detail pages, shared by
 * LegacyApp and V1App so both read the same URLs and apply the same filters.
 *
 * Nothing here is derived from data the database does not have: there is no display name,
 * so the package name is the title, and null flags stay "unknown" rather than becoming false.
 */

import type { PythonIndexPackage, PythonPackage, PythonRelease } from "@/types/python";

export const PYTHON_LIST_PATH = "/python/instrumentation";

/** 51 packages today; a page size just above that keeps the catalogue on one page. */
export const PAGE_SIZE = 60;

export type MetricsFacet = "supported" | "unsupported" | "unknown";
export const METRICS_FACETS: readonly MetricsFacet[] = ["supported", "unsupported", "unknown"];

/** Value of the semantic-convention facet for a package whose status is null. */
export const UNKNOWN_SEMCONV = "unknown";

export type DensityMode = "cards" | "compact" | "table";
export const DENSITIES: readonly DensityMode[] = ["cards", "compact", "table"];

export interface PythonRow {
  name: string;
  description: string | null;
  version: string;
  releaseCount: number;
  metrics: MetricsFacet;
  /** The status string, or UNKNOWN_SEMCONV when the registry has none. */
  semconv: string;
  href: string;
}

export interface PythonFilters {
  q: string;
  metrics: MetricsFacet[];
  /** Status strings plus UNKNOWN_SEMCONV; lowercased. */
  semconv: string[];
  page: number;
  density: DensityMode;
}

export const DEFAULT_FILTERS: PythonFilters = {
  q: "",
  metrics: [],
  semconv: [],
  page: 1,
  density: "compact",
};

export function detailPath(name: string): string {
  return `${PYTHON_LIST_PATH}/${encodeURIComponent(name)}`;
}

export function metricsFacet(value: boolean | null | undefined): MetricsFacet {
  if (value === true) return "supported";
  if (value === false) return "unsupported";
  return "unknown";
}

export function semconvFacet(value: string | null | undefined): string {
  const trimmed = typeof value === "string" ? value.trim().toLowerCase() : "";
  return trimmed || UNKNOWN_SEMCONV;
}

export function toRow(entry: PythonIndexPackage): PythonRow {
  return {
    name: entry.name,
    description: entry.description?.trim() || null,
    version: entry.version,
    releaseCount: entry.releases?.length ?? 0,
    metrics: metricsFacet(entry.supports_metrics),
    semconv: semconvFacet(entry.semantic_convention_status),
    href: detailPath(entry.name),
  };
}

function parseCsv(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const part of raw) {
    for (const token of part.split(",")) {
      const trimmed = token.trim().toLowerCase();
      if (trimmed) seen.add(trimmed);
    }
  }
  return Array.from(seen).sort();
}

function parsePage(raw: string | null): number {
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Reads the filters from a query string. Unknown or malformed values fall back to defaults. */
export function parseFilters(input: string | URLSearchParams): PythonFilters {
  const params =
    typeof input === "string"
      ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
      : input;
  const density = params.get("density")?.trim().toLowerCase() ?? "";
  return {
    q: params.get("q")?.trim() ?? "",
    metrics: parseCsv(params.getAll("metrics")).filter((v): v is MetricsFacet =>
      (METRICS_FACETS as readonly string[]).includes(v)
    ),
    semconv: parseCsv(params.getAll("semconv")),
    page: parsePage(params.get("page")),
    density: (DENSITIES as readonly string[]).includes(density)
      ? (density as DensityMode)
      : DEFAULT_FILTERS.density,
  };
}

/** Writes the filters to a query string, omitting empty values and defaults. */
export function serializeFilters(filters: Partial<PythonFilters>): URLSearchParams {
  const merged: PythonFilters = { ...DEFAULT_FILTERS, ...filters };
  const params = new URLSearchParams();
  const q = merged.q.trim();
  if (q) params.set("q", q);
  if (merged.metrics.length > 0)
    params.set("metrics", [...new Set(merged.metrics)].sort().join(","));
  if (merged.semconv.length > 0)
    params.set("semconv", [...new Set(merged.semconv)].sort().join(","));
  if (merged.density !== DEFAULT_FILTERS.density) params.set("density", merged.density);
  if (merged.page > 1) params.set("page", String(merged.page));
  return params;
}

export function activeFilterCount(filters: PythonFilters): number {
  return filters.metrics.length + filters.semconv.length + (filters.q.trim() ? 1 : 0);
}

export function applyFilters(rows: PythonRow[], filters: PythonFilters): PythonRow[] {
  const q = filters.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.metrics.length > 0 && !filters.metrics.includes(row.metrics)) return false;
    if (filters.semconv.length > 0 && !filters.semconv.includes(row.semconv)) return false;
    if (q && !`${row.name} ${row.description ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Name order is the only sort the data supports; there is no per-package timestamp. */
export function sortRows(rows: PythonRow[]): PythonRow[] {
  return rows.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export interface FacetCounts {
  metrics: Record<MetricsFacet, number>;
  semconv: Record<string, number>;
}

/** Counts over the unfiltered rows, so a facet shows what selecting it would add. */
export function computeCounts(rows: PythonRow[]): FacetCounts {
  const counts: FacetCounts = {
    metrics: { supported: 0, unsupported: 0, unknown: 0 },
    semconv: {},
  };
  for (const row of rows) {
    counts.metrics[row.metrics] += 1;
    counts.semconv[row.semconv] = (counts.semconv[row.semconv] ?? 0) + 1;
  }
  return counts;
}

/**
 * The semantic-convention values present in the data, with "unknown" last. Empty when no package
 * has a known status: a facet offering only "unknown" would filter nothing.
 */
export function semconvOptions(rows: PythonRow[]): string[] {
  const present = new Set(rows.map((r) => r.semconv));
  const known = [...present].filter((v) => v !== UNKNOWN_SEMCONV).sort();
  if (known.length === 0) return [];
  return present.has(UNKNOWN_SEMCONV) ? [...known, UNKNOWN_SEMCONV] : known;
}

export function paginate<T>(
  items: T[],
  page: number
): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    page: safePage,
    totalPages,
  };
}

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const PATH_SEGMENT = /^[A-Za-z0-9_.-]+$/;

/**
 * The package's directory on GitHub, built from `repository` and `source_path`.
 *
 * The raw `homepage` is not used: it is copied verbatim from upstream and is malformed for a
 * few packages, while these two fields are reliable. Returns null unless both are present and
 * well formed, so a bad value can never become a link.
 */
export function sourceUrl(pkg: Pick<PythonPackage, "repository" | "source_path">): string | null {
  const { repository, source_path: sourcePath } = pkg;
  if (!repository || !sourcePath || !REPOSITORY.test(repository)) return null;
  const segments = sourcePath.split("/");
  if (segments.some((s) => !PATH_SEGMENT.test(s) || s === "." || s === "..")) return null;
  return `https://github.com/${repository}/tree/main/${segments.join("/")}`;
}

export interface ReleaseRow extends PythonRelease {
  /** True when this release's metadata file is the same as the latest release's. */
  sameAsLatest: boolean;
  isLatest: boolean;
}

export function describeReleases(releases: PythonRelease[]): ReleaseRow[] {
  const latestHash = releases[0]?.hash;
  return releases.map((release, i) => ({
    ...release,
    isLatest: i === 0,
    sameAsLatest: i > 0 && release.hash === latestHash,
  }));
}

export interface ResolvedVersion {
  /** The release to show: the requested one if it exists, otherwise the latest. */
  version: string;
  /** True when a version was requested but is not a release of this package. */
  invalid: boolean;
}

/** Validates a `?version=` value against a package's releases, falling back to the latest. */
export function resolveVersion(
  releases: PythonRelease[],
  requested: string | null
): ResolvedVersion | null {
  const latest = releases[0]?.version;
  if (!latest) return null;
  if (!requested || requested === "latest") return { version: latest, invalid: false };
  return releases.some((r) => r.version === requested)
    ? { version: requested, invalid: false }
    : { version: latest, invalid: true };
}
