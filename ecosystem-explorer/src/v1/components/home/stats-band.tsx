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
 * StatsBand — OTel-purple counter strip on the home page. Self-scoped via
 * `--stats-band-bg-hsl` / `--stats-band-fg-hsl` (declared in
 * `src/v1/styles/tokens.css`), so the surface contract lives in one place
 * for both themes.
 *
 * Numbers + labels come from `src/v1/lib/home-stats.ts`. The `stats` prop
 * lets the showcase render alternative datasets without duplicating layout.
 */

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { HOME_STATS, type StatItem } from "@/v1/lib/home-stats";

export interface StatsBandProps {
  title?: string;
  stats?: StatItem[];
  /** Override the `<h2>` id (used by `aria-labelledby`). Defaults to `"stats-band-title"`. */
  headingId?: string;
}

export function StatsBand({
  title,
  stats = HOME_STATS,
  headingId = "stats-band-title",
}: StatsBandProps) {
  const { t } = useTranslation("home");
  const resolvedTitle = title ?? t("homeV1.stats.title");

  return (
    <section className="td-stats-band" aria-labelledby={headingId}>
      <div className="td-stats-band__container">
        <h2 id={headingId} className="td-stats-band__title">
          {resolvedTitle}
        </h2>
        <div className="td-stats-band__grid">
          {stats.map((stat) => {
            const label = t(`homeV1.stats.items.${stat.key}`, stat.label);
            return (
              <div key={stat.key} className="td-stats-band__item">
                <div className="td-stats-band__number">
                  {stat.external ? (
                    <a
                      href={stat.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${label}: ${stat.value}`}
                    >
                      {stat.value}
                    </a>
                  ) : (
                    <Link to={stat.href} aria-label={`${label}: ${stat.value}`}>
                      {stat.value}
                    </Link>
                  )}
                </div>
                <div className="td-stats-band__label">{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
