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

import type { Stability } from "@/components/ui/status-pill";

export type SearchResultEcosystem = "collector" | "java-agent" | "page";

export interface SearchResult {
  title: string;
  description: string;
  path: string;
  type: "page" | "section" | "item";
  keywords?: string[];

  /** Drives the lead pill in the dropdown row. */
  ecosystem?: SearchResultEcosystem;
  /**
   * Short, ecosystem-defined descriptors rendered in the meta line between the
   * ecosystem pill and the version (Collector → component type e.g. "receiver";
   * Java Agent → "standalone library" when the instrumentation ships as one).
   * Each ecosystem's mapper owns its vocabulary, so adding new ecosystems like
   * "JavaScript" or "Go" means writing a mapper — not touching this type or
   * `<GlobalSearch>`. Keep to 1–2 short tokens; omit labels that just repeat
   * the ecosystem pill.
   */
  facets?: string[];
  /**
   * Resolved stability for the trailing pill. Comes straight from the
   * Collector component index (`stability` is pre-resolved upstream). Java
   * Agent instrumentations don't track stability, so the field is omitted
   * and the pill doesn't render.
   */
  stability?: Stability;
  /** Indexed version (omitted on pages). */
  version?: string;
}

/**
 * A pluggable contributor to the global search index. Each ecosystem implements
 * one; the orchestrator (`search-index.ts`) composes the registry without
 * knowing any concrete ecosystem. Adding JavaScript/Go means writing a source
 * and registering it — the orchestrator stays closed for modification (OCP) and
 * depends only on this interface, never on the concrete loaders (DIP).
 */
export interface SearchSource {
  /** Stable identifier; mirrors the `ecosystem` this source's results carry. */
  readonly id: SearchResultEcosystem;
  /**
   * This source's contribution to the index. Resolves to an empty array when
   * there is nothing to add (e.g. no latest version). May reject — the
   * orchestrator treats rejection as a transient failure and retries on the
   * next query rather than caching a degraded index.
   */
  load(): Promise<SearchResult[]>;
}
