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
 * Density views for the list page — Compact (default), Cards, Table.
 *
 * All three views consume the same `ListRow[]` shape produced by the list
 * route's data-fetching layer, so swapping the view is just a render
 * decision, not a data-shape decision.
 */

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { StatusPill } from "@/components/ui/status-pill";
import { TYPE_STRIPE_COLORS } from "@/components/ui/type-stripe-colors";
import type { CollectorComponentType } from "@/components/ui/type-stripe-colors";
import type { Distribution, Signal, StabilityFacet } from "@/v1/lib/list-filters";

export interface ListRow {
  id: string;
  name: string;
  displayName: string;
  type: CollectorComponentType;
  distribution: Distribution;
  description: string | null;
  stability: StabilityFacet;
  signals: Signal[];
  href: string;
}

export interface CompactRowProps {
  row: ListRow;
}

export function CompactRow({ row }: CompactRowProps) {
  return (
    <Link to={row.href} className="td-row td-row--compact">
      <span
        aria-hidden
        className="td-row__stripe"
        style={{ backgroundColor: TYPE_STRIPE_COLORS[row.type] }}
      />
      <div className="td-row__main">
        <div className="td-row__title-line">
          <strong className="td-row__name">{row.displayName}</strong>
          <code className="td-row__slug">{row.name}</code>
        </div>
        {row.description && <p className="td-row__description">{row.description}</p>}
      </div>
      <div className="td-row__meta">
        <span className="td-row__type">{row.type}</span>
        {row.signals.length > 0 && (
          <span className="td-row__signals">{row.signals.join(", ")}</span>
        )}
      </div>
      <StatusPill stability={row.stability} />
    </Link>
  );
}

export interface ListViewProps {
  rows: ListRow[];
}

export function CompactList({ rows }: ListViewProps) {
  return (
    <div className="td-list td-list--compact">
      {rows.map((row) => (
        <CompactRow key={row.id} row={row} />
      ))}
    </div>
  );
}

export function CardView({ rows }: ListViewProps) {
  return (
    <div className="td-list td-list--cards">
      {rows.map((row) => (
        <Link key={row.id} to={row.href} className="td-card">
          <span
            aria-hidden
            className="td-card__stripe"
            style={{ backgroundColor: TYPE_STRIPE_COLORS[row.type] }}
          />
          <div className="td-card__head">
            <strong className="td-card__name">{row.displayName}</strong>
            <StatusPill stability={row.stability} />
          </div>
          <code className="td-card__slug">{row.name}</code>
          {row.description && <p className="td-card__description">{row.description}</p>}
          <div className="td-card__meta">
            <span className="td-card__type">{row.type}</span>
            {row.signals.length > 0 && (
              <span className="td-card__signals">{row.signals.join(", ")}</span>
            )}
            <span className="td-card__dist">{row.distribution}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function TableView({ rows }: ListViewProps) {
  const { t } = useTranslation("list");
  return (
    <div className="td-table-wrap">
      <table className="td-table">
        <thead>
          <tr>
            <th scope="col">{t("views.table.columns.name")}</th>
            <th scope="col">{t("views.table.columns.type")}</th>
            <th scope="col">{t("views.table.columns.signals")}</th>
            <th scope="col">{t("views.table.columns.distribution")}</th>
            <th scope="col">{t("views.table.columns.stability")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="td-table__row" data-type={row.type}>
              <td>
                <Link to={row.href} className="td-table__name">
                  <span
                    aria-hidden
                    className="td-table__dot"
                    style={{ backgroundColor: TYPE_STRIPE_COLORS[row.type] }}
                  />
                  <strong>{row.displayName}</strong>
                  <code className="td-table__slug">{row.name}</code>
                </Link>
              </td>
              <td>{row.type}</td>
              <td>{row.signals.join(", ") || "—"}</td>
              <td>{row.distribution}</td>
              <td>
                <StatusPill stability={row.stability} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
