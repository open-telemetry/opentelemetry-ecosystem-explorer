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
 * EcosystemConfig — declarative shape for every per-ecosystem landing page.
 * Adding a new ecosystem (Python, Go, …) is a matter of authoring a new
 * config and a one-line route registration. No per-page component
 * duplication.
 */

import type { ReactNode } from "react";
import type { PipelineStage } from "@/v1/components/ecosystem/pipeline-anatomy";
import type { QuickEntryItem } from "@/v1/components/ecosystem/quick-entry-row";
import type { ReleaseDeltas } from "@/v1/components/ecosystem/release-card";

export interface EcosystemHeroCopy {
  /** Eyebrow text shown above the title — e.g. "Infrastructure · Vendor-agnostic agent". */
  eyebrow: string;
  /** The title. Supports rendered React (e.g. with a gradient accent span). */
  title: ReactNode;
  /** Lead paragraph below the title. */
  lead: string;
  /** Three CTA hrefs+labels. The first is rendered as primary (orange). */
  ctas: Array<{ label: string; href: string; external?: boolean; primary?: boolean }>;
  /** Logo / mark rendered above the eyebrow. */
  logo: ReactNode;
}

export interface EcosystemReleaseInfo {
  version: string | null;
  releaseDate?: string | null;
  deltas?: ReleaseDeltas | null;
  hrefChangelog?: string | null;
}

export interface EcosystemConfig {
  id: string;
  slug: string;
  name: string;
  hero: EcosystemHeroCopy;
  /** Pipeline anatomy title — defaults to "Pipeline anatomy". */
  pipelineTitle?: string;
  /** Pipeline anatomy lead sentence. */
  pipelineLead?: string;
  /**
   * When true, the pipeline renders as a grid (no chevrons) — used by
   * Java Agent's category-style diagram where order doesn't imply flow.
   */
  pipelineNoFlow?: boolean;
  stages: PipelineStage[];
  quickEntries: QuickEntryItem[];
  /**
   * Static release fallback shown when the data layer is unavailable. The
   * actual latest version may be loaded asynchronously by the page; this
   * is the v1 baseline pulled from the mockup / opentelemetry.io.
   */
  release: EcosystemReleaseInfo;
}
