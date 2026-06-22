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
 * `listFilters` URL contract — single source of truth for converting
 * `URLSearchParams` ↔ a typed `ListFilters` object. Used by:
 *   - the list page (Phase 4) to read its state from the URL on every render
 *   - the ecosystem-landing PipelineAnatomy (Phase 3) to generate deep-links
 *     into the list page with the right facet pre-selected
 *
 * URL shape (collector example):
 *   /collector/components?type=receiver,processor&signal=traces
 *     &stability=stable,beta&distribution=contrib&version=v0.150.0
 *     &q=kafka&sort=updated&density=compact&page=2
 *
 * Multi-select facets are CSV-joined (lowercase, deduped, stable order).
 * Empty values are omitted from the URL so a "clean" URL is just the
 * pathname. Default values (`sort=name`, `density=compact`, `page=1`)
 * are also omitted — only deviations from the default appear.
 */

import type { CollectorComponentType } from "@/components/ui/type-stripe-colors";
import type { Stability } from "@/types/collector";

export type Signal = "traces" | "metrics" | "logs" | "baggage";
/** Stability facet vocabulary — the canonical six OTel levels from the registry types. */
export type StabilityFacet = Stability;
export type Distribution = "core" | "contrib";
export type SortMode = "name" | "updated" | "stability";
export type DensityMode = "cards" | "compact" | "table";

export interface ListFilters {
  types: CollectorComponentType[];
  signals: Signal[];
  stabilities: StabilityFacet[];
  distributions: Distribution[];
  version: string | null;
  q: string;
  sort: SortMode;
  density: DensityMode;
  page: number;
}

export const DEFAULT_FILTERS: ListFilters = {
  types: [],
  signals: [],
  stabilities: [],
  distributions: [],
  version: null,
  q: "",
  sort: "name",
  density: "compact",
  page: 1,
};

const TYPES: readonly CollectorComponentType[] = [
  "receiver",
  "processor",
  "exporter",
  "connector",
  "extension",
];
const SIGNALS: readonly Signal[] = ["traces", "metrics", "logs", "baggage"];
const STABILITIES: readonly StabilityFacet[] = [
  "stable",
  "beta",
  "alpha",
  "deprecated",
  "unmaintained",
  "development",
];
const DISTRIBUTIONS: readonly Distribution[] = ["core", "contrib"];
const SORTS: readonly SortMode[] = ["name", "updated", "stability"];
const DENSITIES: readonly DensityMode[] = ["cards", "compact", "table"];

// Accepts the raw `getAll()` list so a facet survives both encodings: a single
// CSV param (`?type=receiver,processor`) and repeated params
// (`?type=receiver&type=processor`). Each entry is itself split on commas.
function parseCsv<T extends string>(raw: readonly string[], allowed: readonly T[]): T[] {
  const seen = new Set<T>();
  for (const part of raw) {
    for (const token of part.split(",")) {
      const trimmed = token.trim().toLowerCase();
      if (!trimmed) continue;
      if ((allowed as readonly string[]).includes(trimmed)) {
        seen.add(trimmed as T);
      }
    }
  }
  // Sort to match `serializeFilters` so parse → serialize → parse round-trips.
  return Array.from(seen).sort();
}

function parseEnum<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  if (!raw) return fallback;
  const lower = raw.trim().toLowerCase();
  return (allowed as readonly string[]).includes(lower) ? (lower as T) : fallback;
}

function parsePage(raw: string | null): number {
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function parseFilters(input: string | URLSearchParams): ListFilters {
  const params =
    typeof input === "string"
      ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
      : input;
  return {
    types: parseCsv(params.getAll("type"), TYPES),
    signals: parseCsv(params.getAll("signal"), SIGNALS),
    stabilities: parseCsv(params.getAll("stability"), STABILITIES),
    distributions: parseCsv(params.getAll("distribution"), DISTRIBUTIONS),
    version: params.get("version")?.trim() || null,
    q: params.get("q")?.trim() ?? "",
    sort: parseEnum(params.get("sort"), SORTS, "name"),
    density: parseEnum(params.get("density"), DENSITIES, "compact"),
    page: parsePage(params.get("page")),
  };
}

function csv<T extends string>(values: T[]): string | undefined {
  if (values.length === 0) return undefined;
  return Array.from(new Set(values)).sort().join(",");
}

export function serializeFilters(filters: Partial<ListFilters>): URLSearchParams {
  const merged: ListFilters = { ...DEFAULT_FILTERS, ...filters };
  const params = new URLSearchParams();
  const set = (key: string, value: string | undefined) => {
    if (value) params.set(key, value);
  };
  set("type", csv(merged.types));
  set("signal", csv(merged.signals));
  set("stability", csv(merged.stabilities));
  set("distribution", csv(merged.distributions));
  const version = merged.version?.trim();
  if (version) set("version", version);
  const q = merged.q.trim();
  if (q) set("q", q);
  if (merged.sort !== DEFAULT_FILTERS.sort) set("sort", merged.sort);
  if (merged.density !== DEFAULT_FILTERS.density) set("density", merged.density);
  if (merged.page > 1) set("page", String(merged.page));
  return params;
}

/** Convenience: produce a relative href like `?type=receiver&signal=traces`. */
export function filtersToHref(basePath: string, filters: Partial<ListFilters>): string {
  const params = serializeFilters(filters);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Convenience: how many filters are currently active (used by the chip count). */
export function activeFilterCount(filters: ListFilters): number {
  return (
    filters.types.length +
    filters.signals.length +
    filters.stabilities.length +
    filters.distributions.length +
    (filters.q.trim().length > 0 ? 1 : 0) +
    (filters.version ? 1 : 0)
  );
}
