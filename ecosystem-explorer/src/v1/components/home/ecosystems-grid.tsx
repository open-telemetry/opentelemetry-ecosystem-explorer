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

import { JavaIcon } from "@/components/icons/java-icon";
import { type Stability, StatusPill } from "@/components/ui/status-pill";

export type ActiveEcosystemId = "collector" | "java-agent";
export type ComingSoonEcosystemId = "python" | "go" | "js" | "dotnet";

export interface ActiveEcosystem {
  id: ActiveEcosystemId;
  name: string;
  tagline: string;
  description: string;
  stability: Stability;
  components: string;
  unit: "components" | "instrumentations";
  version: string;
  weeklyDelta: string;
  href: string;
  icon: ReactNode;
}

export interface ComingSoonEcosystem {
  id: ComingSoonEcosystemId;
  name: string;
}

const DEFAULT_ACTIVE: ActiveEcosystem[] = [
  {
    id: "collector",
    name: "OpenTelemetry Collector",
    tagline: "Vendor-agnostic agent",
    description:
      "Receive, process, and export telemetry data. 200+ receivers, processors, exporters, connectors and extensions.",
    stability: "stable",
    components: "200+",
    unit: "components",
    version: "v0.150.0",
    weeklyDelta: "12",
    href: "/collector",
    icon: <Network className="td-ecosystem-card__icon-svg" aria-hidden />,
  },
  {
    id: "java-agent",
    name: "OpenTelemetry Java Agent",
    tagline: "Auto-instrumentation",
    description:
      "Discover supported libraries, configuration options, and emitted telemetry for the Java auto-instrumentation agent.",
    stability: "stable",
    components: "187",
    unit: "instrumentations",
    version: "v2.10.0",
    weeklyDelta: "8",
    href: "/java-agent",
    icon: <JavaIcon className="td-ecosystem-card__icon-svg" />,
  },
];

const PLACEHOLDER_ICON = <Boxes className="td-ecosystem-card__placeholder-icon" aria-hidden />;

const DEFAULT_COMING_SOON: ComingSoonEcosystem[] = [
  { id: "python", name: "Python SDK" },
  { id: "go", name: "Go SDK" },
  { id: "js", name: "JS / Node" },
  { id: "dotnet", name: ".NET" },
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
  return (
    <section className="td-ecosystems-grid" aria-labelledby={headingId}>
      <div className="td-ecosystems-grid__container">
        <div className="td-section-header">
          <div>
            <h2 id={headingId} className="td-section-header__title">
              Ecosystems
            </h2>
            <p className="td-section-header__lead">
              Browse the projects that make up OpenTelemetry.
            </p>
          </div>
          <a
            className="td-section-header__action"
            href="https://opentelemetry.io/ecosystem/"
            target="_blank"
            rel="noopener noreferrer"
          >
            View all projects →
          </a>
        </div>

        <div className="td-ecosystems-grid__cards">
          {active.map((eco) => (
            <Link
              key={eco.id}
              to={eco.href}
              className="td-ecosystem-card"
              aria-label={`${eco.name} — ${eco.tagline}`}
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
                    <h3 className="td-ecosystem-card__name">{eco.name}</h3>
                    <p className="td-ecosystem-card__tagline">{eco.tagline}</p>
                  </div>
                </div>
                <StatusPill stability={eco.stability} />
              </div>
              <p className="td-ecosystem-card__description">{eco.description}</p>
              <div className="td-ecosystem-card__metrics">
                {(
                  [
                    [eco.components, eco.unit],
                    [eco.version, "latest"],
                    [eco.weeklyDelta, "updated this week"],
                  ] as const
                ).map(([value, label]) => (
                  <span key={label}>
                    <span className="td-ecosystem-card__metric-value">{value}</span>{" "}
                    <span className="td-ecosystem-card__metric-label">{label}</span>
                  </span>
                ))}
              </div>
            </Link>
          ))}

          {comingSoon.map((eco) => (
            <div
              key={eco.id}
              className="td-ecosystem-card td-ecosystem-card--placeholder"
              aria-label={`${eco.name} — coming soon`}
            >
              {PLACEHOLDER_ICON}
              <div className="td-ecosystem-card__name td-ecosystem-card__name--placeholder">
                {eco.name}
              </div>
              <small className="td-ecosystem-card__tagline">Coming soon</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
