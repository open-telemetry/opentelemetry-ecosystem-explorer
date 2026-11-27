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
 * Density views for the Python catalogue: Compact, Cards, Table. They use the same `td-row`,
 * `td-card` and `td-table` classes as the Collector list, but take Python rows: a package has no
 * component type, signals or stability, so the collector-typed `ListRow` views do not fit.
 */

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { PythonRow } from "@/features/python/utils/catalogue";

// Python rows have no type colour; the stripe keeps the row grid aligned and uses a theme token.
const STRIPE_STYLE = { backgroundColor: "hsl(var(--primary-hsl))" };

/** A neutral pill for known values; "unknown" stays unhighlighted so it never reads as a no. */
export function PythonPills({ row }: { row: PythonRow }) {
  const { t } = useTranslation("python");
  return (
    <>
      <span
        className={`td-pill ${row.metrics === "supported" ? "td-pill--info" : ""}`}
        data-metrics={row.metrics}
      >
        {t(`metrics.${row.metrics}`)}
      </span>
      {row.semconv !== "unknown" && (
        <span className="td-pill td-pill--info" data-semconv={row.semconv}>
          {t(`semconv.${row.semconv}`, { defaultValue: row.semconv })}
        </span>
      )}
    </>
  );
}

export interface PythonViewProps {
  rows: PythonRow[];
}

export function PythonCompactList({ rows }: PythonViewProps) {
  const { t } = useTranslation("python");
  return (
    <div className="td-list td-list--compact">
      {rows.map((row) => (
        <Link key={row.name} to={row.href} className="td-row td-row--compact">
          <span aria-hidden className="td-row__stripe" style={STRIPE_STYLE} />
          <div className="td-row__main">
            <div className="td-row__title-line">
              <strong className="td-row__name">{row.name}</strong>
            </div>
            {row.description && <p className="td-row__description">{row.description}</p>}
          </div>
          <div className="td-row__meta">
            <span>{t("list.card.latest", { version: row.version })}</span>
          </div>
          <div className="td-row__meta">
            <PythonPills row={row} />
          </div>
        </Link>
      ))}
    </div>
  );
}

export function PythonCardView({ rows }: PythonViewProps) {
  const { t } = useTranslation("python");
  return (
    <div className="td-list td-list--cards">
      {rows.map((row) => (
        <Link key={row.name} to={row.href} className="td-card">
          <span aria-hidden className="td-card__stripe" style={STRIPE_STYLE} />
          <div className="td-card__head">
            <strong className="td-card__name">{row.name}</strong>
          </div>
          {row.description && <p className="td-card__description">{row.description}</p>}
          <div className="td-card__meta">
            <span>{t("list.card.latest", { version: row.version })}</span>
            <PythonPills row={row} />
            <span>{t("list.card.releases", { count: row.releaseCount })}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function PythonTableView({ rows }: PythonViewProps) {
  const { t } = useTranslation("python");
  return (
    <div className="td-table-wrap">
      <table className="td-table">
        <thead>
          <tr>
            <th scope="col">{t("list.table.name")}</th>
            <th scope="col">{t("list.table.latest")}</th>
            <th scope="col">{t("list.table.metrics")}</th>
            <th scope="col">{t("list.table.semconv")}</th>
            <th scope="col">{t("list.table.releases")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="td-table__row">
              <td>
                <Link to={row.href} className="td-table__name">
                  <span aria-hidden className="td-table__dot" style={STRIPE_STYLE} />
                  <strong>{row.name}</strong>
                </Link>
              </td>
              <td>{row.version}</td>
              <td>{t(`metrics.${row.metrics}`)}</td>
              <td>{t(`semconv.${row.semconv}`, { defaultValue: row.semconv })}</td>
              <td>{row.releaseCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
