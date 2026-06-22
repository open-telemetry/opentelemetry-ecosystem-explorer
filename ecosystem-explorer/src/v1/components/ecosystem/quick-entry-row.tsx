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
 * QuickEntryRow — three small "shortcut" cards on the ecosystem landing,
 * below the pipeline anatomy. Each item is a deep-link (internal or
 * external) into a curated view (e.g. "Most-used components", "Core vs.
 * Contrib", "Diff across versions").
 *
 * The component accepts 1-4 items; layout collapses to a responsive grid.
 */

import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export interface QuickEntryItem {
  id: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
  /** Lucide icon component or any ReactNode. */
  icon?: React.ReactNode;
}

export interface QuickEntryRowProps {
  /** Section heading; defaults to the `ecosystem` namespace's `quickEntry.defaultTitle`. */
  title?: string;
  items: QuickEntryItem[];
}

export function QuickEntryRow({ title, items }: QuickEntryRowProps) {
  const { t } = useTranslation("ecosystem");
  const heading = title ?? t("quickEntry.defaultTitle");

  return (
    <section className="td-quick-entry" aria-labelledby="quick-entry-title">
      <h2 id="quick-entry-title" className="td-quick-entry__title">
        {heading}
      </h2>
      <div className="td-quick-entry__grid">
        {items.map((item) =>
          item.external ? (
            <a
              key={item.id}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="td-quick-entry__card"
            >
              {item.icon && <div className="td-quick-entry__icon">{item.icon}</div>}
              <div className="td-quick-entry__head">
                <h3 className="td-quick-entry__card-title">{item.title}</h3>
                <ArrowRight className="td-quick-entry__arrow" aria-hidden focusable="false" />
              </div>
              <p className="td-quick-entry__description">{item.description}</p>
            </a>
          ) : (
            <Link key={item.id} to={item.href} className="td-quick-entry__card">
              {item.icon && <div className="td-quick-entry__icon">{item.icon}</div>}
              <div className="td-quick-entry__head">
                <h3 className="td-quick-entry__card-title">{item.title}</h3>
                <ArrowRight className="td-quick-entry__arrow" aria-hidden focusable="false" />
              </div>
              <p className="td-quick-entry__description">{item.description}</p>
            </Link>
          )
        )}
      </div>
    </section>
  );
}
