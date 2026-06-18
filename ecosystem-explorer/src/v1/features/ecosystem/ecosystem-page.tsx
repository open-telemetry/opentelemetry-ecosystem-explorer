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

import { SubNav } from "@/v1/components/layout/sub-nav";
import { CoverBlock } from "@/v1/components/home/cover-block";
import { PipelineAnatomy } from "@/v1/components/ecosystem/pipeline-anatomy";
import { QuickEntryRow } from "@/v1/components/ecosystem/quick-entry-row";
import { ReleaseCard } from "@/v1/components/ecosystem/release-card";
import type { EcosystemConfig } from "./types";

export interface EcosystemPageProps {
  config: EcosystemConfig;
}

export function EcosystemPage({ config }: EcosystemPageProps) {
  const { hero, release, stages, quickEntries, pipelineTitle, pipelineLead, pipelineNoFlow } =
    config;

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
              rel="noopener"
              className={`td-btn ${cta.primary ? "td-btn--primary" : "td-btn--outline-light"}`}
            >
              {cta.label}
            </a>
          ) : (
            <a
              key={cta.label}
              href={cta.href}
              className={`td-btn ${cta.primary ? "td-btn--primary" : "td-btn--outline-light"}`}
            >
              {cta.label}
            </a>
          )
        )}
        aside={
          <ReleaseCard
            version={release.version}
            releaseDate={release.releaseDate}
            deltas={release.deltas}
            hrefChangelog={release.hrefChangelog}
          />
        }
      />

      <section className="td-box td-box--light">
        <div className="td-box__container">
          <PipelineAnatomy
            title={pipelineTitle ?? "Pipeline anatomy"}
            lead={pipelineLead}
            stages={stages}
            noFlow={pipelineNoFlow}
          />
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
