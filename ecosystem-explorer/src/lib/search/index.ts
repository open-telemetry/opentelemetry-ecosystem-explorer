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
 * Public entry point for the global search module. Consumers import from
 * `@/lib/search`; the per-ecosystem sources, matching engine, and orchestrator
 * are internal implementation details.
 */

export { search } from "./search-index";
export type { SearchResult, SearchResultEcosystem, SearchSource } from "./types";
