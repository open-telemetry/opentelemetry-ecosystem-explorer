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
 * release deltas come from diffing the two latest per-version manifests (added
 * = ids new in latest, changed = ids whose content hash moved, deprecated =
 * ids the latest bundle marks deprecated/unmaintained). Java Agent counts come
 * from running the SAME substring search the list page uses for each tile's
 * `?search=` term, so a tile's count equals what clicking it lands on. Java
 * Agent records carry no stability field, so its deltas are `null` (the
 * ReleaseCard then renders version-only).
 */

import { useEffect, useState } from "react";

import type { DataState } from "@/hooks/data-state";
import type { ReleaseDeltas } from "@/v1/components/ecosystem/release-card";
import { getInstrumentationDisplayName } from "@/features/java-agent/utils/format";
import * as collectorData from "@/lib/api/collector-data";
import * as javaagentData from "@/lib/api/javaagent-data";

export interface EcosystemLandingData {
  /** Live count per stage id (matches the `stages[].id`s in configs.tsx). */
  stageCounts: Record<string, number>;
  release: {
    version: string | null;
    /** Null when deltas are not computable (e.g. Java Agent has no stability). */
    deltas: ReleaseDeltas | null;
  };
}

/**
 * Diffs two collector version manifests (id → content-hash maps) plus the
 * latest list bundle into release deltas. Mirrors the client-side version-diff
 * approach in `use-telemetry-comparison.ts`.
 */
function computeCollectorDeltas(
  latest: Record<string, string>,
  previous: Record<string, string>,
  latestBundle: Array<{ id: string; stability?: string | null }>
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

  const deprecated = latestBundle.filter(
    (c) => c.stability === "deprecated" || c.stability === "unmaintained"
  ).length;

  return { added, changed, deprecated };
}

async function loadCollectorLandingData(): Promise<EcosystemLandingData> {
  const [index, versions] = await Promise.all([
    collectorData.loadIndex(),
    collectorData.loadVersions(),
  ]);

  // Group the slim index by `type` — the type strings (receiver, processor,
  // exporter, connector, extension) are exactly the configs.tsx stage ids.
  const stageCounts: Record<string, number> = {};
  for (const component of index.components) {
    stageCounts[component.type] = (stageCounts[component.type] ?? 0) + 1;
  }

  const latestVersion = versions.versions.find((v) => v.is_latest) ?? versions.versions[0];
  // Second-newest entry. The versions index is ordered newest-first, so the
  // entry after the latest is the prior release we diff against.
  const previousVersion = versions.versions.find((v) => v.version !== latestVersion?.version);

  let deltas: ReleaseDeltas | null = null;
  if (latestVersion && previousVersion) {
    const [latestManifest, previousManifest, latestBundle] = await Promise.all([
      collectorData.loadVersionManifest(latestVersion.version),
      collectorData.loadVersionManifest(previousVersion.version),
      collectorData.loadAllComponents(latestVersion.version),
    ]);
    deltas = computeCollectorDeltas(
      latestManifest.components,
      previousManifest.components,
      latestBundle
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
  /** Maps each stage id to its `?search=` term, derived from configs.tsx hrefs. */
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

export type EcosystemLandingId = "collector" | "java-agent";

/**
 * Fetches the live landing data for an ecosystem. `searchTermsByStageId` is
 * only consulted for Java Agent (each stage's `?search=` term); pass it from
 * the config so the per-tile counts stay in lockstep with the tiles' links.
 */
export function useEcosystemLandingData(
  id: EcosystemLandingId,
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
    // searchTermsByStageId is a stable module-level object from configs.tsx;
    // the eslint dep check would force memoizing it at every call site.
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
