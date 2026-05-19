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
 * SignalsRow — four signal cards (Traces / Metrics / Logs / Baggage) that
 * match opentelemetry.io's canonical signal taxonomy (deliberately NOT
 * "Profiles" — see `projects/84-ui-ux-design/01-home-page.md` task 5).
 *
 * Each card links to a placeholder cross-ecosystem signal-filter URL
 * (`/collector/components?signal=<id>`). The destination list-page wires the
 * URL contract in Phase 4; until then the list page can ignore the query
 * safely.
 *
 * Dot colors are driven by per-signal CSS modifiers in `signals-row.css` so
 * the JSX side stays declarative (no inline hex/hsl).
 *
 * Note for PR 6 (RecentActivityRail): when the recent-activity rail lands,
 * SignalsRow and RecentActivityRail will be co-mounted inside a shared
 * `td-two-col` wrapper. PR 5 ships SignalsRow as its own labelled section
 * (matching StatsBand/EcosystemsGrid); PR 6 owns the restructure.
 */

import { Link } from "react-router-dom";

interface Signal {
  id: "traces" | "metrics" | "logs" | "baggage";
  name: string;
  description: string;
  href: string;
}

const SIGNALS: Signal[] = [
  {
    id: "traces",
    name: "Traces",
    description: "Distributed traces · 312 components",
    href: "/collector/components?signal=traces",
  },
  {
    id: "metrics",
    name: "Metrics",
    description: "Measurements over time · 218",
    href: "/collector/components?signal=metrics",
  },
  {
    id: "logs",
    name: "Logs",
    description: "Timestamped records · 147",
    href: "/collector/components?signal=logs",
  },
  {
    id: "baggage",
    name: "Baggage",
    description: "Contextual metadata",
    href: "/collector/components?signal=baggage",
  },
];

export interface SignalsRowProps {
  /** Override the `<h2>` id (used by `aria-labelledby`). Defaults to `"signals-row-title"`. */
  headingId?: string;
}

export function SignalsRow({ headingId = "signals-row-title" }: SignalsRowProps) {
  return (
    <section className="td-signals-row" aria-labelledby={headingId}>
      <div className="td-signals-row__container">
        <h2 id={headingId} className="td-signals-row__title">
          Browse by signal
        </h2>
        <p className="td-signals-row__lead">
          Cuts across ecosystems — matches opentelemetry.io&apos;s canonical signal taxonomy.
        </p>
        <div className="td-signals-row__cards">
          {SIGNALS.map((s) => (
            <Link
              key={s.id}
              to={s.href}
              className="td-signal-card"
              aria-label={`${s.name} — ${s.description}`}
            >
              <span className={`td-signal-card__dot td-signal-card__dot--${s.id}`} aria-hidden />
              <div className="td-signal-card__name">{s.name}</div>
              <div className="td-signal-card__description">{s.description}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
