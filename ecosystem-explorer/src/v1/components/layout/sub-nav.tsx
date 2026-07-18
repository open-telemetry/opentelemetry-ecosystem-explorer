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
 * SubNav — breadcrumb row that sits below the navbar on inner pages.
 *
 * Mirrors opentelemetry.io's `.breadcrumb` pattern (Bootstrap), but tightened
 * to the explorer's chrome. The right-side `actions` slot is for page-level
 * controls (filter toggles, "Edit on GitHub", etc.). Renders nothing if both
 * `crumbs` and `actions` are empty so callers can mount it unconditionally.
 */
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface SubNavProps {
  crumbs: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function SubNav({ crumbs, actions, className }: SubNavProps) {
  if (crumbs.length === 0 && !actions) return null;

  return (
    <div className={className ? `td-subnav ${className}` : "td-subnav"}>
      <div className="td-subnav__container">
        {crumbs.length > 0 && (
          <nav className="td-subnav__breadcrumb" aria-label="Breadcrumb">
            <ol className="td-subnav__crumbs">
              {crumbs.map((crumb, idx) => {
                const isLast = idx === crumbs.length - 1;
                const ariaCurrent = isLast ? "page" : undefined;
                return (
                  <li key={idx} className="td-subnav__crumb">
                    {idx > 0 && (
                      <ChevronRight
                        className="td-subnav__separator"
                        aria-hidden
                        focusable="false"
                      />
                    )}
                    {isLast || !crumb.href ? (
                      <span
                        className="td-subnav__crumb-label td-subnav__crumb-label--current"
                        aria-current={ariaCurrent}
                      >
                        {crumb.label}
                      </span>
                    ) : (
                      <Link to={crumb.href} className="td-subnav__crumb-label">
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        {actions && <div className="td-subnav__actions">{actions}</div>}
      </div>
    </div>
  );
}
