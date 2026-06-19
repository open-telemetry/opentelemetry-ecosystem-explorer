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
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Menu, X, Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { OtelLogo } from "@/components/icons/otel-logo";
import { isEnabled } from "@/lib/feature-flags";
import { useTheme, type ThemeMode } from "@/theme-context";

const NAV_ITEMS = [
  { to: "/java-agent", labelKey: "header.nav.javaAgent" },
  { to: "/collector", labelKey: "header.nav.collector" },
  { to: "/about", labelKey: "header.nav.about" },
] as const;

function LanguageSwitcher() {
  const { i18n, t } = useTranslation("layout");
  return (
    <select
      value={i18n.resolvedLanguage ?? "en"}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="border-border/40 bg-background text-muted-foreground hover:text-foreground cursor-pointer rounded border px-2 py-1 text-xs transition-colors"
      aria-label={t("header.languageSwitcher")}
    >
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  );
}

const THEME_OPTIONS = [
  { mode: "light" as ThemeMode, label: "Light", Icon: Sun },
  { mode: "dark" as ThemeMode, label: "Dark", Icon: Moon },
  { mode: "auto" as ThemeMode, label: "Auto", Icon: Monitor },
] as const;

function ThemeSwitcher() {
  const { mode, setMode } = useTheme();
  const { t } = useTranslation("layout");
  const ActiveIcon = THEME_OPTIONS.find((o) => o.mode === mode)?.Icon ?? Monitor;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="border-border/40 bg-background text-muted-foreground hover:text-foreground focus:ring-primary/20 flex cursor-pointer items-center justify-center gap-1 rounded border px-2 py-1 transition-colors focus:ring-2 focus:outline-none"
        aria-label={t("header.themeSwitcher", "Toggle theme")}
      >
        <ActiveIcon className="h-4 w-4" />
        <ChevronDown className="h-3 w-3 opacity-50" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="border-border/60 bg-background/95 ring-border/5 z-[100] min-w-[8rem] overflow-hidden rounded-lg border p-1 shadow-xl ring-1 backdrop-blur-md"
        >
          {THEME_OPTIONS.map(({ mode: optMode, label, Icon }) => (
            <DropdownMenu.Item
              key={optMode}
              className={`data-[highlighted]:bg-primary/10 hover:bg-primary/10 focus:bg-primary/10 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors outline-none select-none ${
                mode === optMode ? "bg-primary/5 text-primary font-medium" : "text-foreground"
              }`}
              onSelect={() => setMode(optMode)}
            >
              <Icon className="h-4 w-4" />
              <span>{t(`theme.${optMode}`, label)}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function Header() {
  const { t } = useTranslation("layout");
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
      <header className="border-border bg-background/95 fixed top-0 right-0 left-0 z-50 h-16 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3">
            <OtelLogo className="text-primary h-6 w-6" />
            <span className="text-foreground font-semibold">{t("header.title")}</span>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                {t(item.labelKey)}
              </Link>
            ))}
            {isEnabled("I18N") && <LanguageSwitcher />}
            <ThemeSwitcher />
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
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
            {isEnabled("I18N") && (
              <li>
                <LanguageSwitcher />
              </li>
            )}
            <li>
              <ThemeSwitcher />
            </li>
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
