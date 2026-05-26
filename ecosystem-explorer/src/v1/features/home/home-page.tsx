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

import { Link } from "react-router-dom";

import { Compass } from "@/components/icons/compass";
import { CoverBlock } from "@/v1/components/home/cover-block";
import { EcosystemsGrid } from "@/v1/components/home/ecosystems-grid";
import { SignalsRow } from "@/v1/components/home/signals-row";
import { StatsBand } from "@/v1/components/home/stats-band";

/**
 * Home page (v1) — composes the v1 chrome with home-specific sections.
 * Only the recent-activity slot is still a skeleton-box placeholder.
 * The CncfCallout and FooterV1 are mounted by `<V1App />`, not here.
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
            <Link className="td-btn td-btn--primary" to="/collector">
              Browse components
            </Link>
            <a
              className="td-btn td-btn--outline-light"
              href="https://opentelemetry.io/docs/what-is-opentelemetry/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the overview
            </a>
          </>
        }
      >
        <div className="td-home__skeleton td-home__skeleton--search" aria-hidden="true" />
      </CoverBlock>

      <StatsBand />

      <EcosystemsGrid />

      <SignalsRow />

      <section aria-label="Recent activity">
        <div className="td-home__skeleton td-home__skeleton--recent-activity" aria-hidden="true" />
      </section>
    </div>
  );
}
