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
 * ReleaseCard — top-right card on the ecosystem landing hero. Shows the
 * current/latest version, optional release date, and a small delta strip
 * (+ added · ⟳ changed · ✕ deprecated). Renders an empty state when no
 * release info is available.
 */

import { CircleX, RotateCw, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface ReleaseDeltas {
  added: number;
  changed: number;
  deprecated: number;
}

export interface ReleaseCardProps {
  version: string | null;
  releaseDate?: string | null;
  deltas?: ReleaseDeltas | null;
  hrefChangelog?: string | null;
  className?: string;
}

export function ReleaseCard({
  version,
  releaseDate,
  deltas,
  hrefChangelog,
  className,
}: ReleaseCardProps) {
  const { t } = useTranslation("ecosystem");

  if (!version) {
    return (
      <aside className={`td-release-card td-release-card--empty ${className ?? ""}`}>
        <div className="td-release-card__eyebrow">{t("releaseCard.eyebrow")}</div>
        <p className="td-release-card__empty-msg">{t("releaseCard.empty")}</p>
      </aside>
    );
  }

  return (
    <aside
      className={`td-release-card ${className ?? ""}`}
      aria-label={t("releaseCard.ariaLabel", { version })}
    >
      <div className="td-release-card__eyebrow">{t("releaseCard.eyebrow")}</div>
      <div className="td-release-card__version">{version}</div>
      {releaseDate && <div className="td-release-card__date">{releaseDate}</div>}
      {deltas && (
        <ul className="td-release-card__deltas" aria-label={t("releaseCard.changesAriaLabel")}>
          <li className="td-release-card__delta">
            <Sparkles className="td-release-card__delta-icon" aria-hidden focusable="false" />
            <strong>{deltas.added}</strong> {t("releaseCard.added")}
          </li>
          <li className="td-release-card__delta">
            <RotateCw className="td-release-card__delta-icon" aria-hidden focusable="false" />
            <strong>{deltas.changed}</strong> {t("releaseCard.changed")}
          </li>
          <li className="td-release-card__delta">
            <CircleX className="td-release-card__delta-icon" aria-hidden focusable="false" />
            <strong>{deltas.deprecated}</strong> {t("releaseCard.deprecated")}
          </li>
        </ul>
      )}
      {hrefChangelog && (
        <a
          className="td-release-card__changelog"
          href={hrefChangelog}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("releaseCard.changelog")}
        </a>
      )}
    </aside>
  );
}
