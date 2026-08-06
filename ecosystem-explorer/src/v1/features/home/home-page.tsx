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
import { Seo } from "@/components/seo/seo";
import { CoverBlock } from "@/v1/components/home/cover-block";
import { EcosystemsGrid } from "@/v1/components/home/ecosystems-grid";
import { GlobalSearch } from "@/v1/components/home/global-search";
import { RecentActivityRail } from "@/v1/components/home/recent-activity-rail";
import { SignalsRow } from "@/v1/components/home/signals-row";
import { StatsBand } from "@/v1/components/home/stats-band";

const COVER_CTAS = (
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
);

/**
 * Home page (v1) — composes the v1 chrome with home-specific sections.
 * Only the GlobalSearch slot inside CoverBlock is still a skeleton.
 * The CncfCallout and FooterV1 are mounted by `<V1App />`, not here.
 */
export function HomeV1() {
  return (
    <div className="td-home">
      <Seo />
      <CoverBlock
        logo={<Compass />}
        title={
          <>
            OpenTelemetry <span className="td-cover-block__title-accent">Ecosystem Explorer</span>
          </>
        }
        lead="Navigate every receiver, processor, exporter, and instrumentation across the OpenTelemetry project — searchable, comparable, version-aware."
        ctas={COVER_CTAS}
      >
        <GlobalSearch />
      </CoverBlock>

      <StatsBand />

      <EcosystemsGrid />

      <section className="td-box td-box--muted" aria-label="Signals and recent activity">
        <div className="td-box__container">
          <div className="td-two-col">
            <SignalsRow />
            <RecentActivityRail />
          </div>
        </div>
      </section>
    </div>
  );
}
