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

import type { SearchSource } from "../types";
import { collectorSearchSource } from "./collector";
import { javaAgentSearchSource } from "./java-agent";
import { pageSearchSource } from "./pages";

/**
 * Registry of every search source. This is the single edit point for adding an
 * ecosystem: write a `*SearchSource` module and list it here. The orchestrator
 * (`../search-index.ts`) iterates this array and stays closed for modification.
 *
 * Order is a weak tiebreaker only — results are re-ranked by `sortResults`, so
 * it affects sibling ordering for identical (rank, title) pairs alone.
 */
export const SEARCH_SOURCES: readonly SearchSource[] = [
  pageSearchSource,
  javaAgentSearchSource,
  collectorSearchSource,
];
