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

import { Compass } from "@/components/icons/compass";
import { CoverBlock } from "@/v1/components/home/cover-block";

/**
 * Home page (v1) — composes the v1 chrome with home-specific sections.
 *
 * In PR 1, the four sections below the hero are skeleton-box placeholders
 * that PRs 2-6 replace with the real components (StatsBand, EcosystemsGrid,
 * SignalsRow, RecentActivityRail). The GlobalSearch slot inside CoverBlock
 * is also a skeleton until PR 2.
 *
 * The CncfCallout and FooterV1 are mounted by `<V1App />`, not here —
 * HomeV1 only owns the page-content slot.
 */
export function HomeV1() {
  return (
    <div className="td-home">
      <CoverBlock
        logo={<Compass />}
        title={
          <>
            OpenTelemetry <span className="td-cover-block__title-accent">Ecosystem Explorer</span>
          </>
        }
        lead="Navigate every receiver, processor, exporter, and instrumentation across the OpenTelemetry project — searchable, comparable, version-aware."
        ctas={
          <>
            <a className="td-btn td-btn--primary" href="/collector">
              Browse components
            </a>
            <a
              className="td-btn td-btn--outline-light"
              href="https://opentelemetry.io/docs/what-is-opentelemetry/"
              target="_blank"
              rel="noopener"
            >
              Read the overview
            </a>
          </>
        }
      >
        <div className="td-home__skeleton td-home__skeleton--search" aria-hidden="true" />
      </CoverBlock>

      <section aria-label="Ecosystem statistics">
        <div className="td-home__skeleton td-home__skeleton--stats" aria-hidden="true" />
      </section>

      <section aria-label="Featured ecosystems">
        <div className="td-home__skeleton td-home__skeleton--ecosystems" aria-hidden="true" />
      </section>

      <section aria-label="Browse by signal">
        <div className="td-home__skeleton td-home__skeleton--signals" aria-hidden="true" />
      </section>

      <section aria-label="Recent activity">
        <div className="td-home__skeleton td-home__skeleton--recent-activity" aria-hidden="true" />
      </section>
    </div>
  );
}
