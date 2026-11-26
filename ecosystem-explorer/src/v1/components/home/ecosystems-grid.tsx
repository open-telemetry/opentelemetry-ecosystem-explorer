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
 * EcosystemsGrid — two active cards (Collector, Java Agent) plus four
 * dashed "coming soon" placeholders. Counts are the canonical 2026-05-19
 * values from `projects/84-ui-ux-design/ecosystem-explorer-v1-mockups.html`;
 * they stay hardcoded until the data layer exposes synchronous totals.
 */

import type { ReactNode } from "react";
import { Boxes, Network } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { JavaIcon } from "@/components/icons/java-icon";
import { type Stability, StatusPill } from "@/components/ui/status-pill";

export type ActiveEcosystemId = "collector" | "java-agent";
export type ComingSoonEcosystemId = "python" | "go" | "js" | "dotnet";

export interface ActiveEcosystem {
  id: ActiveEcosystemId;
  stability: Stability;
  components: string;
  version: string;
  weeklyDelta: string;
  href: string;
  icon: ReactNode;
}

export interface ComingSoonEcosystem {
  id: ComingSoonEcosystemId;
}

const DEFAULT_ACTIVE: ActiveEcosystem[] = [
  {
    id: "collector",
    stability: "stable",
    components: "200+",
    version: "v0.150.0",
    weeklyDelta: "12",
    href: "/collector",
    icon: <Network className="td-ecosystem-card__icon-svg" aria-hidden />,
  },
  {
    id: "java-agent",
    stability: "stable",
    components: "187",
    version: "v2.10.0",
    weeklyDelta: "8",
    href: "/java-agent",
    icon: <JavaIcon className="td-ecosystem-card__icon-svg" />,
  },
];

const PLACEHOLDER_ICON = <Boxes className="td-ecosystem-card__placeholder-icon" aria-hidden />;

const DEFAULT_COMING_SOON: ComingSoonEcosystem[] = [
  { id: "python" },
  { id: "go" },
  { id: "js" },
  { id: "dotnet" },
];

export interface EcosystemsGridProps {
  active?: ActiveEcosystem[];
  comingSoon?: ComingSoonEcosystem[];
  /** Override the `<h2>` id (used by `aria-labelledby`). Defaults to `"ecosystems-grid-title"`. */
  headingId?: string;
}

export function EcosystemsGrid({
  active = DEFAULT_ACTIVE,
  comingSoon = DEFAULT_COMING_SOON,
  headingId = "ecosystems-grid-title",
}: EcosystemsGridProps) {
  const { t } = useTranslation("home");

  return (
    <section className="td-ecosystems-grid" aria-labelledby={headingId}>
      <div className="td-ecosystems-grid__container">
        <div className="td-section-header">
          <div>
            <h2 id={headingId} className="td-section-header__title">
              {t("homeV1.ecosystems.title")}
            </h2>
            <p className="td-section-header__lead">{t("homeV1.ecosystems.lead")}</p>
          </div>
          <a
            className="td-section-header__action"
            href="https://opentelemetry.io/ecosystem/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("homeV1.ecosystems.viewAll")}
          </a>
        </div>

        <div className="td-ecosystems-grid__cards">
          {active.map((eco) => {
            const name = t(`homeV1.ecosystems.active.${eco.id}.name`);
            const tagline = t(`homeV1.ecosystems.active.${eco.id}.tagline`);
            const description = t(`homeV1.ecosystems.active.${eco.id}.description`);
            const unit = t(`homeV1.ecosystems.active.${eco.id}.unit`);
            return (
              <Link
                key={eco.id}
                to={eco.href}
                className="td-ecosystem-card"
                aria-label={`${name} — ${tagline}`}
              >
                <div className="td-ecosystem-card__head">
                  <div className="td-ecosystem-card__id">
                    <div
                      className={`td-ecosystem-card__icon td-ecosystem-card__icon--${eco.id}`}
                      aria-hidden
                    >
                      {eco.icon}
                    </div>
                    <div>
                      <h3 className="td-ecosystem-card__name">{name}</h3>
                      <p className="td-ecosystem-card__tagline">{tagline}</p>
                    </div>
                  </div>
                  <StatusPill stability={eco.stability} />
                </div>
                <p className="td-ecosystem-card__description">{description}</p>
                <div className="td-ecosystem-card__metrics">
                  {(
                    [
                      [eco.components, unit],
                      [eco.version, t("homeV1.ecosystems.metricLabels.latest")],
                      [eco.weeklyDelta, t("homeV1.ecosystems.metricLabels.updatedThisWeek")],
                    ] as const
                  ).map(([value, label]) => (
                    <span key={label}>
                      <span className="td-ecosystem-card__metric-value">{value}</span>{" "}
                      <span className="td-ecosystem-card__metric-label">{label}</span>
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}

          {comingSoon.map((eco) => (
            <div key={eco.id} className="td-ecosystem-card td-ecosystem-card--placeholder">
              {PLACEHOLDER_ICON}
              <div className="td-ecosystem-card__name td-ecosystem-card__name--placeholder">
                {t(`homeV1.ecosystems.comingSoon.items.${eco.id}`)}
              </div>
              <small className="td-ecosystem-card__tagline">
                {t("homeV1.ecosystems.comingSoon.label")}
              </small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
