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
 * DetailHeader — top card of the component detail page. Carries the
 * type-stripe (foundation primitive), eyebrow, title, slug, stability pill,
 * version, signal badges, and action links (GitHub + Docs).
 */

import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TYPE_STRIPE_COLORS } from "@/components/ui/type-stripe-colors";
import type { CollectorComponentType } from "@/components/ui/type-stripe-colors";
import { GitHubIcon } from "@/v1/components/icons/github-icon";

export interface DetailHeaderProps {
  type: CollectorComponentType;
  distribution: string;
  displayName: string;
  slug: string;
  description?: string | null;
  stability: string;
  version: string;
  signals: string[];
  hrefRepository?: string | null;
  hrefDocs?: string | null;
}

const PILL_CLASS: Record<string, string> = {
  stable: "td-pill td-pill--stable",
  beta: "td-pill td-pill--beta",
  alpha: "td-pill td-pill--alpha",
  deprecated: "td-pill td-pill--deprecated",
  unmaintained: "td-pill td-pill--deprecated",
};

export function DetailHeader({
  type,
  distribution,
  displayName,
  slug,
  description,
  stability,
  version,
  signals,
  hrefRepository,
  hrefDocs,
}: DetailHeaderProps) {
  const { t } = useTranslation("detail");
  const { t: tc } = useTranslation("collector");
  const stabilityLabel = tc(`detail.stabilityLabels.${stability}`, { defaultValue: stability });

  return (
    <header className="td-detail-header">
      <span
        aria-hidden
        className="td-detail-header__stripe"
        style={{ backgroundColor: TYPE_STRIPE_COLORS[type] }}
      />
      <div className="td-detail-header__eyebrow">
        <span className="td-detail-header__type">{type}</span>
        <span className="td-detail-header__dot">·</span>
        <span>{distribution}</span>
        <span className="td-detail-header__dot">·</span>
        <span>{version}</span>
      </div>
      <div className="td-detail-header__title-row">
        <h1 className="td-detail-header__title">{displayName}</h1>
        <span className={PILL_CLASS[stability] ?? "td-pill td-pill--neutral"}>
          {stabilityLabel}
        </span>
      </div>
      <code className="td-detail-header__slug">{slug}</code>
      {description && <p className="td-detail-header__description">{description}</p>}
      {signals.length > 0 && (
        <div className="td-detail-header__signals">
          {signals.map((sig) => (
            <span key={sig} className="td-detail-header__signal">
              {sig}
            </span>
          ))}
        </div>
      )}
      {(hrefRepository || hrefDocs) && (
        <div className="td-detail-header__actions">
          {hrefRepository && (
            <a
              className="td-btn td-btn--outline-dark"
              href={hrefRepository}
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubIcon className="h-4 w-4" />
              {t("header.source")}
            </a>
          )}
          {hrefDocs && (
            <a
              className="td-btn td-btn--outline-dark"
              href={hrefDocs}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              {t("header.docs")}
            </a>
          )}
        </div>
      )}
    </header>
  );
}
