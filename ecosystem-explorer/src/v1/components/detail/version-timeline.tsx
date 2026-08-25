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
 * Right-rail content for the detail page:
 *   - <VersionTimeline>     vertical list of recent versions
 *   - <DiffSelector>        from/to dropdowns + "Diff →" link
 *   - <CompatibilityCard>   the distributions a version ships in
 *
 * All three are presentation-only — data comes from the detail page route,
 * which also owns the URL scheme via the `buildHref` callbacks.
 */

import { ArrowRight } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export interface VersionEntry {
  version: string;
  /** Optional one-line summary of what changed for THIS component. */
  summary?: string;
  /** Stability at this version, used to colour the timeline dot. */
  stability?: string;
}

export interface VersionTimelineProps {
  versions: VersionEntry[];
  currentVersion: string;
  /** Builds the navigation href for a version entry. */
  buildHref: (version: string) => string;
  maxVisible?: number;
}

export function VersionTimeline({
  versions,
  currentVersion,
  buildHref,
  maxVisible = 6,
}: VersionTimelineProps) {
  const { t } = useTranslation("detail");
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? versions : versions.slice(0, maxVisible);
  return (
    <section className="td-timeline" aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="td-timeline__title">
        {t("timeline.title")}
      </h2>
      <ol className="td-timeline__list">
        {visible.map((v) => (
          <li
            key={v.version}
            className={`td-timeline__item ${
              v.version === currentVersion ? "td-timeline__item--current" : ""
            }`}
          >
            <span className="td-timeline__dot" aria-hidden />
            <div className="td-timeline__body">
              <Link
                to={buildHref(v.version)}
                className={`td-timeline__version ${
                  v.version === currentVersion ? "td-timeline__version--current" : ""
                }`}
                aria-current={v.version === currentVersion ? "true" : undefined}
              >
                {v.version}
              </Link>
              {v.summary && <div className="td-timeline__summary">{v.summary}</div>}
            </div>
          </li>
        ))}
      </ol>
      {versions.length > maxVisible && (
        <button
          type="button"
          className="td-timeline__expand"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? t("timeline.showFewer") : t("timeline.showAll", { count: versions.length })}
        </button>
      )}
    </section>
  );
}

export interface DiffSelectorProps {
  versions: string[];
  defaultFrom?: string;
  defaultTo?: string;
  /** Builds the navigation href for the chosen pair. */
  buildHref: (from: string, to: string) => string;
}

export function DiffSelector({ versions, defaultFrom, defaultTo, buildHref }: DiffSelectorProps) {
  const { t } = useTranslation("detail");
  const fromId = useId();
  const toId = useId();
  const [from, setFrom] = useState(defaultFrom ?? versions[1] ?? versions[0] ?? "");
  const [to, setTo] = useState(defaultTo ?? versions[0] ?? "");
  if (versions.length < 2) return null;
  return (
    <section className="td-diff-selector" aria-label={t("diffSelector.title")}>
      <h2 className="td-diff-selector__title">{t("diffSelector.title")}</h2>
      {/* Each select is named by its visible label rather than an aria-label:
          an aria-label replaces the accessible name outright, so a label
          reading "From" and a name reading "Diff from version" leaves voice
          control with no way to address the control it can see. The enclosing
          section supplies the missing context via its own label. */}
      <div className="td-diff-selector__row">
        <div className="td-diff-selector__label">
          <label htmlFor={fromId}>{t("diffSelector.from")}</label>
          <select
            id={fromId}
            className="td-facet__select"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <ArrowRight className="td-diff-selector__arrow" aria-hidden focusable="false" />
        <div className="td-diff-selector__label">
          <label htmlFor={toId}>{t("diffSelector.to")}</label>
          <select
            id={toId}
            className="td-facet__select"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Link to={buildHref(from, to)} className="td-btn td-btn--outline-dark">
        {t("diffSelector.submit")}
      </Link>
    </section>
  );
}

export interface CompatibilityCardProps {
  /** Distributions this version ships in (e.g. ["core", "contrib"]). */
  distributions?: string[];
}

export function CompatibilityCard({ distributions }: CompatibilityCardProps) {
  const { t } = useTranslation("detail");
  if (!distributions || distributions.length === 0) return null;
  return (
    <section className="td-compat" aria-labelledby="compat-title">
      <h2 id="compat-title" className="td-compat__title">
        {t("compat.title")}
      </h2>
      <dl className="td-compat__list">
        <div className="td-compat__row">
          <dt className="td-compat__label">{t("compat.distributions")}</dt>
          <dd className="td-compat__value">{distributions.join(", ")}</dd>
        </div>
      </dl>
    </section>
  );
}
