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
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { OpenTelemetryWordmark } from "@/components/icons/opentelemetry-wordmark";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/*
 * Markup mirrors opentelemetry.io's `themes/docsy/layouts/_partials/navbar.html`
 * (logo lockup + nav-scroll wrapper that gets `margin-left: auto` at md+).
 * All visuals live in `src/styles/navbar.css` — Tailwind utilities are
 * intentionally avoided here so the chrome stays in sync with the upstream
 * SCSS without rem-scaling guesswork.
 *
 * Mobile (< md / 768px) diverges from upstream: instead of upstream's
 * horizontal-scroll pattern we collapse the nav row behind a hamburger
 * toggle. The toggler sits inside the bar; the rest of the items move into
 * an overlay panel anchored to the bottom of the bar.
 */
export function NavBar() {
  const [isOpen, setIsOpen] = useState(false);

  // When internal links land inside the collapsed panel, close it from each
  // link's `onClick` rather than reintroducing a pathname-watching effect.

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <header className="td-navbar">
      <div className="td-navbar-container">
        <Link to="/" aria-label="OpenTelemetry — Home" className="navbar-brand">
          <OpenTelemetryWordmark />
        </Link>
        <button
          type="button"
          className="td-navbar-toggler"
          aria-controls="td-navbar-collapse"
          aria-expanded={isOpen}
          aria-label="Toggle navigation"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
        <div
          className="td-navbar-backdrop"
          data-state={isOpen ? "open" : "closed"}
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
        />
        <div
          id="td-navbar-collapse"
          className="td-navbar-collapse"
          data-state={isOpen ? "open" : "closed"}
        >
          <div className="td-navbar-nav-scroll">
            <nav aria-label="Primary">
              <ul className="navbar-nav">
                <li className="nav-item">
                  <a
                    className="nav-link"
                    href="https://opentelemetry.io/docs/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Docs
                  </a>
                </li>
                <li className="nav-item">
                  <ThemeToggle />
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
