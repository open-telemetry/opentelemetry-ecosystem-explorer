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
import { Link } from "react-router-dom";
import { OpenTelemetryWordmark } from "@/components/icons/opentelemetry-wordmark";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/*
 * Markup mirrors opentelemetry.io's `themes/docsy/layouts/_partials/navbar.html`
 * (logo lockup + nav-scroll wrapper that gets `margin-left: auto` at md+).
 * All visuals live in `src/styles/navbar.css` — Tailwind utilities are
 * intentionally avoided here so the chrome stays in sync with the upstream
 * SCSS without rem-scaling guesswork.
 */
export function NavBar() {
  return (
    <header className="td-navbar">
      <div className="td-navbar-container">
        <Link to="/" aria-label="OpenTelemetry — Home" className="navbar-brand">
          <OpenTelemetryWordmark />
        </Link>
        <div className="td-navbar-nav-scroll">
          <nav aria-label="Primary">
            <ul className="navbar-nav">
              <li className="nav-item">
                <a
                  className="nav-link"
                  href="https://opentelemetry.io/docs/"
                  target="_blank"
                  rel="noreferrer"
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
    </header>
  );
}
