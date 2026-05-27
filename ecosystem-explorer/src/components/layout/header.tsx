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
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { OtelLogo } from "@/components/icons/otel-logo";

const NAV_ITEMS = [
  { to: "/java-agent", label: "Java Agent" },
  { to: "/collector", label: "Collector" },
  { to: "/about", label: "About" },
] as const;

export function Header() {
  const location = useLocation();

  // Storing the pathname the menu was opened on (rather than a plain boolean)
  // means navigation automatically closes the menu: the pathname changes, so
  // openForPath !== location.pathname, so menuOpen becomes false.  No effect
  // or ref read during render required.
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const menuOpen = openForPath === location.pathname;

  const openMenu = () => setOpenForPath(location.pathname);
  const closeMenu = () => setOpenForPath(null);

  return (
    <>
      <header className="border-border/30 bg-background/95 fixed top-0 right-0 left-0 z-50 h-16 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3">
            <OtelLogo className="text-primary h-6 w-6" />
            <span className="text-foreground font-semibold">OTel Explorer</span>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
            {NAV_ITEMS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="text-muted-foreground hover:text-foreground md:hidden"
            onClick={menuOpen ? closeMenu : openMenu}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        <nav
          id="mobile-nav"
          aria-label="Mobile main"
          hidden={!menuOpen}
          className="border-border/30 bg-background/95 border-b px-6 py-4 md:hidden"
        >
          <ul className="flex flex-col gap-4">
            {NAV_ITEMS.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {/* Backdrop: sits below the header (z-40 < z-50) so the mobile nav remains
          above it, but covers page content to focus attention on the menu and
          provide a tap-outside-to-close target. */}
      {menuOpen && (
        <div
          aria-hidden="true"
          data-testid="mobile-nav-backdrop"
          className="fixed inset-0 z-40 bg-black/50"
          onClick={closeMenu}
        />
      )}
    </>
  );
}
