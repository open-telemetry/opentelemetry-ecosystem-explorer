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
 * SiblingNavigator — left rail on the detail page. Lists every sibling of
 * the same type within the current ecosystem (e.g. all 98 receivers when
 * looking at the Kafka Receiver), with the current entry highlighted.
 *
 * OnPageAnchors — the secondary navigator at the bottom of the rail, showing
 * the in-page H2 sections.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { DetailTabId } from "./tabs";

export interface SiblingItem {
  id: string;
  name: string;
  displayName: string;
  href: string;
}

export interface SiblingNavigatorProps {
  title: string;
  items: SiblingItem[];
  activeId: string;
}

export function SiblingNavigator({ title, items, activeId }: SiblingNavigatorProps) {
  const { t } = useTranslation("detail");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.displayName.toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div className="td-sibling-nav">
      <div className="td-sibling-nav__head">
        <div className="td-sibling-nav__title">{title}</div>
        <div className="td-sibling-nav__count">
          {t("siblingNav.count", { filtered: filtered.length, total: items.length })}
        </div>
      </div>
      <input
        type="search"
        className="td-sibling-nav__search"
        placeholder={t("siblingNav.filterPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t("siblingNav.filterAriaLabel", { title })}
      />
      <ul className="td-sibling-nav__list" role="list">
        {filtered.map((item) => (
          <li key={item.id} className="td-sibling-nav__item">
            <Link
              to={item.href}
              className={`td-sibling-nav__link ${
                item.id === activeId ? "td-sibling-nav__link--active" : ""
              }`}
              aria-current={item.id === activeId ? "page" : undefined}
            >
              <span className="td-sibling-nav__name">{item.displayName}</span>
              <code className="td-sibling-nav__slug">{item.name}</code>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="td-sibling-nav__empty">{t("siblingNav.empty")}</li>
        )}
      </ul>
    </div>
  );
}

export interface OnPageAnchor {
  id: string;
  label: string;
  // When set, the anchor drives a tab switch via `onSelectTab` instead of a
  // hash jump. Tab panels are mounted one at a time, so a plain `#id` link
  // can't scroll to a hidden tab — and its hash write would collide with the
  // tab deep-link hash. Section anchors (no `tab`) stay hash links.
  tab?: DetailTabId;
}

export interface OnPageAnchorsProps {
  anchors: OnPageAnchor[];
  activeId?: string;
  onSelectTab?: (tab: DetailTabId) => void;
}

export function OnPageAnchors({ anchors, activeId, onSelectTab }: OnPageAnchorsProps) {
  const { t } = useTranslation("detail");
  if (anchors.length === 0) return null;
  return (
    <nav className="td-on-page" aria-label={t("onPage.title")}>
      <div className="td-on-page__title">{t("onPage.title")}</div>
      <ul className="td-on-page__list">
        {anchors.map((a) => {
          const className = `td-on-page__link ${
            a.id === activeId ? "td-on-page__link--active" : ""
          }`;
          const { tab } = a;
          return (
            <li key={a.id}>
              {tab ? (
                <button type="button" className={className} onClick={() => onSelectTab?.(tab)}>
                  {a.label}
                </button>
              ) : (
                <a href={`#${a.id}`} className={className}>
                  {a.label}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
