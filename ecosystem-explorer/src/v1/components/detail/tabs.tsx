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
 * DetailTabs — Bootstrap-style nav-tabs container for the four content
 * panels (Configuration / README / Attributes / Examples). Selected tab
 * round-trips through `location.hash` so a deep-linkable url like
 * `/collector/components/core/kafkareceiver#configuration` works.
 *
 * Tab-content primitives are co-located here to keep imports flat:
 *   - <ConfigurationTab>  table with empty-state fallback
 *   - <ReadmeTab>         markdown placeholder (v1 links out to the source)
 *   - <AttributesTab>     table with empty-state fallback
 *   - <ExamplesTab>       link-outs + snippet placeholders
 */

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

export type DetailTabId = "configuration" | "readme" | "attributes" | "examples";

const TAB_IDS: DetailTabId[] = ["configuration", "readme", "attributes", "examples"];

export interface DetailTabsProps {
  active: DetailTabId;
  onChange: (next: DetailTabId) => void;
  children: React.ReactNode;
}

export function DetailTabs({ active, onChange, children }: DetailTabsProps) {
  const { t } = useTranslation("detail");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Roving-tabindex keyboard support: arrows move between tabs (automatic
  // activation), Home/End jump to the ends. Without this the inactive tabs
  // (tabIndex=-1) are unreachable by keyboard.
  function onKeyDown(event: React.KeyboardEvent, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % TAB_IDS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TAB_IDS.length) % TAB_IDS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TAB_IDS.length - 1;
    else return;
    event.preventDefault();
    const nextId = TAB_IDS[next];
    onChange(nextId);
    tabRefs.current[nextId]?.focus();
  }

  // Hash-sync — on mount and on hash change, reflect the URL into `active`.
  useEffect(() => {
    function readHash() {
      const raw = window.location.hash.replace(/^#/, "");
      if (raw && TAB_IDS.includes(raw as DetailTabId)) onChange(raw as DetailTabId);
    }
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="td-tabs">
      <div role="tablist" aria-label={t("tabs.ariaLabel")} className="td-tabs__list">
        {TAB_IDS.map((id, index) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[id] = el;
            }}
            role="tab"
            type="button"
            id={`td-tab-${id}`}
            aria-selected={active === id}
            aria-controls={`td-panel-${id}`}
            tabIndex={active === id ? 0 : -1}
            className={`td-tabs__btn ${active === id ? "td-tabs__btn--active" : ""}`}
            onClick={() => onChange(id)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`td-panel-${active}`}
        aria-labelledby={`td-tab-${active}`}
        className="td-tabs__panel"
      >
        {children}
      </div>
    </section>
  );
}

/* ---------- Tab content ---------- */

export interface ConfigurationRow {
  key: string;
  type?: string;
  defaultValue?: string;
  description?: string;
}

export interface ConfigurationTabProps {
  rows: ConfigurationRow[] | null;
  hrefSource?: string | null;
}

export function ConfigurationTab({ rows, hrefSource }: ConfigurationTabProps) {
  const { t } = useTranslation("detail");
  if (rows === null || rows.length === 0) {
    return (
      <div className="td-empty" role="status">
        <p className="td-empty__title">{t("configuration.emptyTitle")}</p>
        <p className="td-empty__lead">{t("configuration.emptyLead")}</p>
        {hrefSource && (
          <a
            className="td-btn td-btn--outline-dark"
            href={hrefSource}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("configuration.openSource")}
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="td-table-wrap">
      <table className="td-table">
        <thead>
          <tr>
            <th scope="col">{t("configuration.columns.key")}</th>
            <th scope="col">{t("configuration.columns.type")}</th>
            <th scope="col">{t("configuration.columns.default")}</th>
            <th scope="col">{t("configuration.columns.description")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <code>{row.key}</code>
              </td>
              <td>{row.type ?? "—"}</td>
              <td>{row.defaultValue ?? "—"}</td>
              <td>{row.description ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface ReadmeTabProps {
  hrefSource?: string | null;
}

export function ReadmeTab({ hrefSource }: ReadmeTabProps) {
  const { t } = useTranslation("detail");
  return (
    <div className="td-empty" role="status">
      <p className="td-empty__title">{t("readme.emptyTitle")}</p>
      <p className="td-empty__lead">{t("readme.emptyLead")}</p>
      {hrefSource && (
        <a
          className="td-btn td-btn--outline-dark"
          href={hrefSource}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("readme.openSource")}
        </a>
      )}
    </div>
  );
}

export type AttributeKind = "metric" | "attribute" | "resource";

export interface AttributeRow {
  name: string;
  kind: AttributeKind;
  description?: string;
}

export interface AttributesTabProps {
  rows: AttributeRow[] | null;
}

export function AttributesTab({ rows }: AttributesTabProps) {
  const { t } = useTranslation("detail");
  if (rows === null || rows.length === 0) {
    return (
      <div className="td-empty" role="status">
        <p className="td-empty__title">{t("attributes.emptyTitle")}</p>
        <p className="td-empty__lead">{t("attributes.emptyLead")}</p>
      </div>
    );
  }
  return (
    <div className="td-table-wrap">
      <table className="td-table">
        <thead>
          <tr>
            <th scope="col">{t("attributes.columns.name")}</th>
            <th scope="col">{t("attributes.columns.kind")}</th>
            <th scope="col">{t("attributes.columns.description")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.kind}:${row.name}`}>
              <td>
                <code>{row.name}</code>
              </td>
              <td>{t(`attributes.kinds.${row.kind}`)}</td>
              <td>{row.description ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface ExampleSnippet {
  title: string;
  language?: string;
  code: string;
}

export interface ExamplesTabProps {
  snippets: ExampleSnippet[];
  hrefExamples?: string | null;
}

export function ExamplesTab({ snippets, hrefExamples }: ExamplesTabProps) {
  const { t } = useTranslation("detail");
  if (snippets.length === 0) {
    return (
      <div className="td-empty" role="status">
        <p className="td-empty__title">{t("examples.emptyTitle")}</p>
        <p className="td-empty__lead">{t("examples.emptyLead")}</p>
        {hrefExamples && (
          <a
            className="td-btn td-btn--outline-dark"
            href={hrefExamples}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("examples.openSource")}
          </a>
        )}
      </div>
    );
  }
  return (
    <div className="td-examples">
      {snippets.map((snippet) => (
        <article key={snippet.title} className="td-example">
          <h3 className="td-example__title">{snippet.title}</h3>
          <pre className="td-example__code">
            <code>{snippet.code}</code>
          </pre>
        </article>
      ))}
    </div>
  );
}
