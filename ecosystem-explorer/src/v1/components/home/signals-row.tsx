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
import { useTranslation } from "react-i18next";

interface Signal {
  id: "traces" | "metrics" | "logs" | "baggage";
  count?: number;
  href: string;
}

const SIGNALS: Signal[] = [
  { id: "traces", count: 312, href: "/collector/components?signal=traces" },
  { id: "metrics", count: 218, href: "/collector/components?signal=metrics" },
  { id: "logs", count: 147, href: "/collector/components?signal=logs" },
  { id: "baggage", href: "/collector/components?signal=baggage" },
];

export interface SignalsRowProps {
  /** Override the `<h2>` id (used by `aria-labelledby`). Defaults to `"signals-row-title"`. */
  headingId?: string;
}

export function SignalsRow({ headingId = "signals-row-title" }: SignalsRowProps) {
  const { t } = useTranslation("home");

  return (
    <section className="td-signals-row" aria-labelledby={headingId}>
      <div className="td-signals-row__container">
        <h2 id={headingId} className="td-signals-row__title">
          {t("homeV1.signals.title")}
        </h2>
        <p className="td-signals-row__lead">{t("homeV1.signals.lead")}</p>
        <div className="td-signals-row__cards">
          {SIGNALS.map((s) => {
            const name = t(`homeV1.signals.items.${s.id}.name`);
            const description =
              s.count === undefined
                ? t(`homeV1.signals.items.${s.id}.description`)
                : t(`homeV1.signals.items.${s.id}.description`, { count: s.count });
            return (
              <Link
                key={s.id}
                to={s.href}
                className="td-signal-card"
                aria-label={t("homeV1.signals.cardAriaLabel", { name, description })}
              >
                <span className={`td-signal-card__dot td-signal-card__dot--${s.id}`} aria-hidden />
                <div className="td-signal-card__name">{name}</div>
                <div className="td-signal-card__description">{description}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
