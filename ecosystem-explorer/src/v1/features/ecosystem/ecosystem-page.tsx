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
 * EcosystemPage — single composition consumed by every per-ecosystem
 * landing route (Collector, Java Agent, future ecosystems). Driven by an
 * `EcosystemConfig` so adding a new ecosystem is just a config entry plus
 * a one-line route swap in `V1App.tsx`.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";

import { SubNav } from "@/v1/components/layout/sub-nav";
import { CoverBlock } from "@/v1/components/home/cover-block";
import { PipelineAnatomy } from "@/v1/components/ecosystem/pipeline-anatomy";
import { QuickEntryRow } from "@/v1/components/ecosystem/quick-entry-row";
import { ReleaseCard } from "@/v1/components/ecosystem/release-card";
import { useEcosystemLandingData } from "./use-ecosystem-landing-data";
import type { EcosystemConfig } from "./types";

export interface EcosystemPageProps {
  config: EcosystemConfig;
}

/**
 * Derives the `?search=` term for each stage from its href, keyed by stage id.
 * Java Agent stages deep-link via `?search=<term>`; the landing hook reuses
 * these terms to count instrumentations with the same substring match the list
 * page applies, so each tile's count equals what clicking it lands on.
 */
function searchTermsByStageId(config: EcosystemConfig): Record<string, string> {
  const terms: Record<string, string> = {};
  for (const stage of config.stages) {
    const query = stage.href.split("?")[1];
    const term = query ? new URLSearchParams(query).get("search") : null;
    if (term) {
      terms[stage.id] = term;
    }
  }
  return terms;
}

export function EcosystemPage({ config }: EcosystemPageProps) {
  const { hero, release, stages, quickEntries, pipelineTitle, pipelineLead, pipelineNoFlow } =
    config;

  const searchTerms = useMemo(() => searchTermsByStageId(config), [config]);
  // `error` is intentionally not destructured: on fetch error `data` is null,
  // so the static-config fallback below renders without a separate error branch.
  const { data, loading } = useEcosystemLandingData(config.id, searchTerms);

  /*
   * Live data with static-config fallback. The pipeline/category counts and the
   * release summary are loaded at runtime by `useEcosystemLandingData`:
   *   - loading → render the skeleton placeholder while the fetch is in flight;
   *   - error   → fall back to the STATIC numbers authored in configs.tsx
   *               (`stages[].count` and the `release` block), so a failed fetch
   *               still renders a usable page rather than empty values;
   *   - success → override each stage count with the live value and pass the
   *               live version/deltas into the ReleaseCard.
   * configs.tsx therefore stays the documented offline/fallback baseline.
   */
  const resolvedStages = data
    ? stages.map((stage) => ({
        ...stage,
        count: data.stageCounts[stage.id] ?? stage.count,
      }))
    : stages;

  const resolvedVersion = data ? data.release.version : release.version;
  const resolvedDeltas = data ? data.release.deltas : (release.deltas ?? null);

  return (
    <div className="td-ecosystem">
      <SubNav
        crumbs={[{ label: "Explorer", href: "/" }, { label: "Ecosystems" }, { label: config.name }]}
      />

      <CoverBlock
        logo={hero.logo}
        eyebrow={hero.eyebrow}
        title={hero.title}
        lead={hero.lead}
        ctas={hero.ctas.map((cta) =>
          cta.external ? (
            <a
              key={cta.label}
              href={cta.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`td-btn ${cta.primary ? "td-btn--primary" : "td-btn--outline-light"}`}
            >
              {cta.label}
            </a>
          ) : (
            <Link
              key={cta.label}
              to={cta.href}
              className={`td-btn ${cta.primary ? "td-btn--primary" : "td-btn--outline-light"}`}
            >
              {cta.label}
            </Link>
          )
        )}
        aside={
          loading ? (
            <div
              className="td-home__skeleton td-release-card td-release-card--loading"
              aria-hidden
            />
          ) : (
            <ReleaseCard
              version={resolvedVersion}
              releaseDate={release.releaseDate}
              deltas={resolvedDeltas}
              hrefChangelog={release.hrefChangelog}
            />
          )
        }
      />

      <section className="td-box td-box--light">
        <div className="td-box__container">
          {loading ? (
            <div
              className="td-home__skeleton"
              style={{ height: "8rem" }}
              aria-label={`${pipelineTitle ?? "Pipeline anatomy"} loading`}
            />
          ) : (
            <PipelineAnatomy
              title={pipelineTitle ?? "Pipeline anatomy"}
              lead={pipelineLead}
              stages={resolvedStages}
              noFlow={pipelineNoFlow}
            />
          )}
        </div>
      </section>

      <section className="td-box td-box--muted">
        <div className="td-box__container">
          <QuickEntryRow items={quickEntries} />
        </div>
      </section>
    </div>
  );
}
