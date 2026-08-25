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
import { useTranslation } from "react-i18next";

import { Compass } from "@/components/icons/compass";
import { Seo } from "@/components/seo/seo";
import { CoverBlock } from "@/v1/components/home/cover-block";
import { EcosystemsGrid } from "@/v1/components/home/ecosystems-grid";
import { GlobalSearch } from "@/v1/components/home/global-search";
import { RecentActivityRail } from "@/v1/components/home/recent-activity-rail";
import { SignalsRow } from "@/v1/components/home/signals-row";
import { StatsBand } from "@/v1/components/home/stats-band";

/**
 * Home page (v1) — composes the v1 chrome with home-specific sections.
 * Only the GlobalSearch slot inside CoverBlock is still a skeleton.
 * The CncfCallout and FooterV1 are mounted by `<V1App />`, not here.
 */
export function HomeV1() {
  const { t } = useTranslation("home");

  const coverCtas = (
    <>
      <Link className="td-btn td-btn--primary" to="/collector">
        {t("homeV1.hero.ctaBrowse")}
      </Link>
      <a
        className="td-btn td-btn--outline-light"
        href="https://opentelemetry.io/docs/what-is-opentelemetry/"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("homeV1.hero.ctaOverview")}
      </a>
    </>
  );

  return (
    <div className="td-home">
      <Seo />
      <CoverBlock
        logo={<Compass />}
        title={
          <>
            {t("homeV1.hero.titlePrefix")}{" "}
            <span className="td-cover-block__title-accent">{t("homeV1.hero.titleAccent")}</span>
          </>
        }
        lead={t("homeV1.hero.lead")}
        ctas={coverCtas}
      >
        <GlobalSearch />
      </CoverBlock>

      <StatsBand />

      <EcosystemsGrid />

      <section className="td-box td-box--muted" aria-label={t("homeV1.sectionsAriaLabel")}>
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
