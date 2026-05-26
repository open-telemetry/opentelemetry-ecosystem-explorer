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
 * SignalsRow — four signal cards (Traces / Metrics / Logs / Baggage)
 * matching opentelemetry.io's canonical signal taxonomy (deliberately NOT
 * "Profiles"). Each card links to a cross-ecosystem signal-filter URL
 * (`/collector/components?signal=<id>`); the destination list page treats
 * the query benignly until Phase 4 wires it. Dot colors are driven by
 * per-signal CSS modifiers in `signals-row.css`.
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
    description: "Measurements over time · 218 components",
    href: "/collector/components?signal=metrics",
  },
  {
    id: "logs",
    name: "Logs",
    description: "Timestamped records · 147 components",
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
          Cuts across ecosystems, matching opentelemetry.io&apos;s canonical signal taxonomy.
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
