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
 * use-ecosystem-landing-data — fetches the live pipeline/category counts and
 * the latest-release summary that drive the ecosystem landing pages. Per the
 * "Data fetching" rule in AGENTS.md, all fetching is wrapped here so
 * `EcosystemPage` only consumes `{ data, loading, error }` and never touches
 * the data layer directly.
 *
 * Collector counts come from the slim `index.json` grouped by `type`; the
 * release deltas come from diffing the two latest releases (added = ids new in
 * latest, changed = ids whose content hash moved, deprecated = ids newly marked
 * deprecated/unmaintained vs the prior release — a delta, not a running total).
 * Java Agent counts come
 * from running the SAME substring search the list page uses for each tile's
 * `?search=` term, so a tile's count equals what clicking it lands on. Java
 * Agent records carry no stability field, so its deltas are `null` (the
 * ReleaseCard then renders version-only).
 */

import { useEffect, useState } from "react";

import type { DataState } from "@/hooks/data-state";
import type { ReleaseDeltas } from "@/v1/components/ecosystem/release-card";
import type { EcosystemId } from "./types";
import { getInstrumentationDisplayName } from "@/features/java-agent/utils/format";
import * as collectorData from "@/lib/api/collector-data";
import * as javaagentData from "@/lib/api/javaagent-data";

export interface EcosystemLandingData {
  /** Live count per stage id (matches the `stages[].id`s in the per-ecosystem config). */
  stageCounts: Record<string, number>;
  release: {
    version: string | null;
    /** Null when deltas are not computable (e.g. Java Agent has no stability). */
    deltas: ReleaseDeltas | null;
  };
}

type StabilityComponent = { id: string; stability?: string | null };

const isDeprecatedStability = (stability?: string | null): boolean =>
  stability === "deprecated" || stability === "unmaintained";

/**
 * Diffs the two latest collector releases into release deltas. `added`/`changed`
 * come from the per-version manifests (id → content-hash maps); `deprecated` is
 * a delta too — components newly marked deprecated/unmaintained in the latest
 * release that were not already so in the prior one (a brand-new component that
 * arrives deprecated counts, since its prior stability is "none"). Mirrors the
 * client-side version-diff approach in `use-telemetry-comparison.ts`.
 */
function computeCollectorDeltas(
  latest: Record<string, string>,
  previous: Record<string, string>,
  latestBundle: StabilityComponent[],
  previousBundle: StabilityComponent[]
): ReleaseDeltas {
  const previousIds = new Set(Object.keys(previous));

  let added = 0;
  let changed = 0;
  for (const [id, hash] of Object.entries(latest)) {
    if (!previousIds.has(id)) {
      added += 1;
    } else if (previous[id] !== hash) {
      changed += 1;
    }
  }

  const previousStability = new Map(previousBundle.map((c) => [c.id, c.stability]));
  const deprecated = latestBundle.filter(
    (c) => isDeprecatedStability(c.stability) && !isDeprecatedStability(previousStability.get(c.id))
  ).length;

  return { added, changed, deprecated };
}

async function loadCollectorLandingData(): Promise<EcosystemLandingData> {
  const [index, versions] = await Promise.all([
    collectorData.loadIndex(),
    collectorData.loadVersions(),
  ]);

  // Group the slim index by `type` — the type strings (receiver, processor,
  // exporter, connector, extension) are exactly the collector-config.tsx stage ids.
  const stageCounts: Record<string, number> = {};
  for (const component of index.components) {
    stageCounts[component.type] = (stageCounts[component.type] ?? 0) + 1;
  }

  // The versions index is ordered newest-first; the entry right after the
  // latest is the prior release we diff against. Resolve `latest` by index so
  // `previous` stays correct even if `is_latest` is not the first entry.
  const latestIndex = Math.max(
    versions.versions.findIndex((v) => v.is_latest),
    0
  );
  const latestVersion = versions.versions[latestIndex];
  const previousVersion = versions.versions[latestIndex + 1];

  let deltas: ReleaseDeltas | null = null;
  if (latestVersion && previousVersion) {
    const [latestManifest, previousManifest, latestBundle, previousBundle] = await Promise.all([
      collectorData.loadVersionManifest(latestVersion.version),
      collectorData.loadVersionManifest(previousVersion.version),
      collectorData.loadAllComponents(latestVersion.version),
      collectorData.loadAllComponents(previousVersion.version),
    ]);
    deltas = computeCollectorDeltas(
      latestManifest.components,
      previousManifest.components,
      latestBundle,
      previousBundle
    );
  }

  return {
    stageCounts,
    release: { version: latestVersion ? `v${latestVersion.version}` : null, deltas },
  };
}

/**
 * Runs the same substring match the instrumentation list page uses
 * (`name`/`display_name`/`description` `includes` the lowercased term) so each
 * stage count equals what clicking that tile's `?search=` link lands on.
 */
function matchesSearch(
  instr: { name: string; display_name?: string; description?: string },
  term: string
): boolean {
  const search = term.toLowerCase();
  const displayName = getInstrumentationDisplayName(instr).toLowerCase();
  const rawName = instr.name.toLowerCase();
  const description = (instr.description ?? "").toLowerCase();
  return displayName.includes(search) || rawName.includes(search) || description.includes(search);
}

async function loadJavaAgentLandingData(
  /** Maps each stage id to its `?search=` term, derived from the per-ecosystem config hrefs. */
  searchTermsByStageId: Record<string, string>
): Promise<EcosystemLandingData> {
  const versions = await javaagentData.loadVersions();
  const latestVersion = versions.versions.find((v) => v.is_latest) ?? versions.versions[0];

  const stageCounts: Record<string, number> = {};
  if (latestVersion) {
    const instrumentations = await javaagentData.loadAllInstrumentations(latestVersion.version);
    for (const [stageId, term] of Object.entries(searchTermsByStageId)) {
      stageCounts[stageId] = instrumentations.filter((i) => matchesSearch(i, term)).length;
    }
  }

  return {
    stageCounts,
    // Instrumentation records have no stability field, so deprecated/changed are
    // not computable. Pass deltas: null — the ReleaseCard renders version-only.
    release: { version: latestVersion ? `v${latestVersion.version}` : null, deltas: null },
  };
}

/**
 * Fetches the live landing data for an ecosystem. `searchTermsByStageId` is
 * only consulted for Java Agent (each stage's `?search=` term); pass it from
 * the config so the per-tile counts stay in lockstep with the tiles' links.
 */
export function useEcosystemLandingData(
  id: EcosystemId,
  searchTermsByStageId: Record<string, string>
): DataState<EcosystemLandingData> {
  const [state, setState] = useState<DataState<EcosystemLandingData>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data =
          id === "collector"
            ? await loadCollectorLandingData()
            : await loadJavaAgentLandingData(searchTermsByStageId);
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id, searchTermsByStageId]);

  return state;
}
